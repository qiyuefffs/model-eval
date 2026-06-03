"""性能压测详细指标分析与 vLLM Prometheus 指标采样。"""

from __future__ import annotations

import asyncio
import csv
import json
import math
import re
import sqlite3
import time
from dataclasses import dataclass, field
from html import escape
from io import StringIO
from pathlib import Path
from statistics import mean
from typing import Any
from urllib.parse import urlsplit, urlunsplit

import httpx
import orjson
from loguru import logger

PROMETHEUS_LINE_RE = re.compile(
    r"^(?P<name>[A-Za-z_:][A-Za-z0-9_:]*)(?:\{(?P<labels>[^}]*)\})?\s+"
    r"(?P<value>[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?|[-+]?Inf|NaN)$"
)
LABEL_RE = re.compile(r'([A-Za-z_][A-Za-z0-9_]*)="((?:\\.|[^"])*)"')

COUNTER_ALIASES = {
    "prompt_tokens": ("vllm:prompt_tokens", "vllm:prompt_tokens_total"),
    "generation_tokens": ("vllm:generation_tokens", "vllm:generation_tokens_total"),
    "preemptions": ("vllm:num_preemptions", "vllm:num_preemptions_total"),
}
GAUGE_ALIASES = {
    "running_requests": ("vllm:num_requests_running",),
    "waiting_requests": ("vllm:num_requests_waiting",),
    "kv_cache_usage": ("vllm:kv_cache_usage_perc", "vllm:gpu_cache_usage_perc"),
}
HISTOGRAM_ALIASES = {
    "queue_time": ("vllm:request_queue_time_seconds",),
    "prefill_time": ("vllm:request_prefill_time_seconds",),
    "decode_time": ("vllm:request_decode_time_seconds",),
    "e2e_latency": ("vllm:e2e_request_latency_seconds",),
}


def infer_metrics_url(api_url: str) -> str:
    """根据 OpenAI 兼容 API URL 推断 vLLM Prometheus 地址。"""
    parts = urlsplit(api_url)
    return urlunsplit((parts.scheme, parts.netloc, "/metrics", "", ""))


def redact_benchmark_args(work_dir: str | None) -> None:
    """移除 EvalScope 输出参数文件中的鉴权信息。"""
    if not work_dir:
        return
    path = Path(work_dir) / "benchmark_args.json"
    if not path.exists():
        return
    try:
        data = orjson.loads(path.read_bytes())
        if not isinstance(data, dict):
            return
        data["api_key"] = "***"
        headers = data.get("headers")
        if isinstance(headers, dict) and "Authorization" in headers:
            headers["Authorization"] = "***"
        path.write_bytes(orjson.dumps(data, option=orjson.OPT_INDENT_2))
    except (OSError, orjson.JSONDecodeError) as e:
        logger.warning(f"压测参数脱敏失败：{path}：{e}")


def _percentile(values: list[float], percentile: int) -> float | None:
    clean = sorted(value for value in values if math.isfinite(value))
    if not clean:
        return None
    index = max(0, min(len(clean) - 1, math.ceil(len(clean) * percentile / 100) - 1))
    return round(clean[index], 6)


def _summary_value(summary: dict[str, Any], key: str) -> float | None:
    value = summary.get(key)
    return float(value) if isinstance(value, int | float) else None


def analyze_client_metrics(work_dir: str | None, summary: dict[str, Any]) -> dict[str, Any]:
    """从 EvalScope 逐请求 SQLite 结果计算客户端详细指标。"""
    if not work_dir:
        return {"available": False, "reason": "任务没有输出目录"}
    db_path = Path(work_dir) / "benchmark_data.db"
    if not db_path.exists():
        return {"available": False, "reason": "未找到 benchmark_data.db"}

    with sqlite3.connect(db_path) as conn:
        rows = conn.execute(
            """
            SELECT success, latency, first_chunk_latency, prompt_tokens,
                   completion_tokens, time_per_output_token, inter_token_latencies
            FROM result
            """
        ).fetchall()

    success_rows = [row for row in rows if row[0]]
    prompt_tokens = [float(row[3] or 0) for row in success_rows]
    completion_tokens = [float(row[4] or 0) for row in success_rows]
    latency = [float(row[1]) for row in success_rows if row[1] is not None]
    ttft_ms = [float(row[2]) * 1000 for row in success_rows if row[2] is not None]
    tpot_ms = [float(row[5]) * 1000 for row in success_rows if row[5] is not None]
    decode_tps = [1 / float(row[5]) for row in success_rows if row[5] and row[5] > 0]
    output_tps = [
        float(row[4]) / float(row[1]) for row in success_rows if row[1] and row[1] > 0 and row[4] is not None
    ]
    e2e_tps = [
        (float(row[3] or 0) + float(row[4] or 0)) / float(row[1])
        for row in success_rows
        if row[1] and row[1] > 0
    ]
    itl_ms: list[float] = []
    for row in success_rows:
        try:
            itl_ms.extend(float(value) * 1000 for value in json.loads(row[6] or "[]"))
        except (TypeError, ValueError, json.JSONDecodeError):
            continue

    duration = _summary_value(summary, "Test Duration (s)")
    return {
        "available": True,
        "total_requests": len(rows),
        "success_requests": len(success_rows),
        "failed_requests": len(rows) - len(success_rows),
        "test_duration_s": duration,
        "total_prompt_tokens": round(sum(prompt_tokens), 6),
        "avg_prompt_tokens": round(mean(prompt_tokens), 6) if prompt_tokens else None,
        "total_generated_tokens": round(sum(completion_tokens), 6),
        "avg_generated_tokens": round(mean(completion_tokens), 6) if completion_tokens else None,
        "output_throughput_tps": _summary_value(summary, "Output Throughput (tok/s)"),
        "total_throughput_tps": _summary_value(summary, "Total Throughput (tok/s)"),
        "single_request_output_tps_p50": _percentile(output_tps, 50),
        "decode_tps_p50": _percentile(decode_tps, 50),
        "e2e_tps_p50": _percentile(e2e_tps, 50),
        "latency_s": {f"p{p}": _percentile(latency, p) for p in (50, 95, 99)},
        "ttft_ms": {f"p{p}": _percentile(ttft_ms, p) for p in (50, 95, 99)},
        "tpot_ms": {f"p{p}": _percentile(tpot_ms, p) for p in (50, 95, 99)},
        "itl_ms": {f"p{p}": _percentile(itl_ms, p) for p in (50, 95, 99)},
    }


def parse_prometheus_metrics(text: str) -> dict[str, float]:
    """解析 Prometheus exposition text，并聚合同名指标的 label 序列。"""
    metrics: dict[str, float] = {}
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        match = PROMETHEUS_LINE_RE.match(line)
        if not match:
            continue
        value = float(match.group("value"))
        if not math.isfinite(value):
            continue
        name = match.group("name")
        labels = dict(LABEL_RE.findall(match.group("labels") or ""))
        key = f"{name}|le={labels['le']}" if "le" in labels else name
        metrics[key] = metrics.get(key, 0.0) + value
    return metrics


def _pick_metric(metrics: dict[str, float], aliases: tuple[str, ...]) -> float | None:
    for name in aliases:
        if name in metrics:
            return metrics[name]
    return None


def _delta(first: dict[str, float], last: dict[str, float], aliases: tuple[str, ...]) -> float | None:
    start = _pick_metric(first, aliases)
    end = _pick_metric(last, aliases)
    return max(0.0, end - start) if start is not None and end is not None else None


def _histogram_delta(first: dict[str, float], last: dict[str, float], aliases: tuple[str, ...]) -> dict[str, float]:
    for name in aliases:
        count = _delta(first, last, (f"{name}_count",))
        total = _delta(first, last, (f"{name}_sum",))
        if count is not None and total is not None:
            return {
                "count": count,
                "sum": total,
                "avg": total / count if count else 0.0,
                **_histogram_percentiles(first, last, name, count),
            }
    return {}


def _histogram_percentiles(
    first: dict[str, float],
    last: dict[str, float],
    name: str,
    count: float,
) -> dict[str, float | None]:
    buckets: list[tuple[float, float]] = []
    prefix = f"{name}_bucket|le="
    for key, end_value in last.items():
        if not key.startswith(prefix):
            continue
        raw_limit = key.removeprefix(prefix)
        if raw_limit == "+Inf":
            continue
        try:
            limit = float(raw_limit)
        except ValueError:
            continue
        delta = max(0.0, end_value - first.get(key, 0.0))
        buckets.append((limit, delta))
    buckets.sort()
    result: dict[str, float | None] = {}
    for percentile in (50, 95, 99):
        target = count * percentile / 100
        result[f"p{percentile}"] = next((limit for limit, cumulative in buckets if cumulative >= target), None)
    return result


@dataclass
class VllmMetricsSampler:
    """在压测期间定时抓取 vLLM `/metrics`。"""

    metrics_url: str
    output_path: Path
    interval_seconds: float = 1.0
    snapshots: list[dict[str, Any]] = field(default_factory=list)
    error: str | None = None
    _stop_event: asyncio.Event = field(default_factory=asyncio.Event)

    async def run(self) -> None:
        async with httpx.AsyncClient(timeout=3.0) as client:
            while not self._stop_event.is_set():
                await self._scrape(client)
                try:
                    await asyncio.wait_for(self._stop_event.wait(), timeout=self.interval_seconds)
                except TimeoutError:
                    continue
            await self._scrape(client)
        self._write_snapshots()

    async def _scrape(self, client: httpx.AsyncClient) -> None:
        try:
            response = await client.get(self.metrics_url)
            response.raise_for_status()
            metrics = parse_prometheus_metrics(response.text)
            if metrics:
                self.snapshots.append({"timestamp": time.time(), "metrics": metrics})
        except (httpx.HTTPError, ValueError) as e:
            self.error = str(e)

    def stop(self) -> None:
        self._stop_event.set()

    def _write_snapshots(self) -> None:
        self.output_path.parent.mkdir(parents=True, exist_ok=True)
        lines = [orjson.dumps(snapshot).decode("utf-8") for snapshot in self.snapshots]
        self.output_path.write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")


def analyze_server_metrics(sampler: VllmMetricsSampler) -> dict[str, Any]:
    """由 vLLM 采样快照计算服务端详细指标。"""
    if len(sampler.snapshots) < 2:
        return {
            "available": False,
            "metrics_url": sampler.metrics_url,
            "reason": sampler.error or "未采集到足够的 vLLM /metrics 快照",
        }
    first = sampler.snapshots[0]["metrics"]
    last = sampler.snapshots[-1]["metrics"]
    prompt_tokens = _delta(first, last, COUNTER_ALIASES["prompt_tokens"])
    generation_tokens = _delta(first, last, COUNTER_ALIASES["generation_tokens"])
    prefill = _histogram_delta(first, last, HISTOGRAM_ALIASES["prefill_time"])
    decode = _histogram_delta(first, last, HISTOGRAM_ALIASES["decode_time"])
    queue = _histogram_delta(first, last, HISTOGRAM_ALIASES["queue_time"])
    e2e = _histogram_delta(first, last, HISTOGRAM_ALIASES["e2e_latency"])
    return {
        "available": True,
        "metrics_url": sampler.metrics_url,
        "sample_count": len(sampler.snapshots),
        "prompt_tokens": prompt_tokens,
        "generation_tokens": generation_tokens,
        "prefill_tps": prompt_tokens / prefill["sum"] if prompt_tokens is not None and prefill.get("sum") else None,
        "decode_tps": generation_tokens / decode["sum"] if generation_tokens is not None and decode.get("sum") else None,
        "queue_time_s": queue,
        "prefill_time_s": prefill,
        "decode_time_s": decode,
        "e2e_latency_s": e2e,
        "max_running_requests": _max_gauge(sampler.snapshots, GAUGE_ALIASES["running_requests"]),
        "max_waiting_requests": _max_gauge(sampler.snapshots, GAUGE_ALIASES["waiting_requests"]),
        "max_kv_cache_usage": _max_gauge(sampler.snapshots, GAUGE_ALIASES["kv_cache_usage"]),
        "preemptions": _delta(first, last, COUNTER_ALIASES["preemptions"]),
    }


def _max_gauge(snapshots: list[dict[str, Any]], aliases: tuple[str, ...]) -> float | None:
    values = [
        value
        for snapshot in snapshots
        if (value := _pick_metric(snapshot["metrics"], aliases)) is not None
    ]
    return max(values) if values else None


def build_detailed_metrics(work_dir: str | None, summary: dict[str, Any], sampler: VllmMetricsSampler) -> dict[str, Any]:
    """合并客户端和服务端详细指标。"""
    return {
        "client": analyze_client_metrics(work_dir, summary),
        "server": analyze_server_metrics(sampler),
    }


# 完整 CSV 导出的中文映射 ----------------------------------------------------

# 测试摘要：(中文标签, EvalScope 指标 key)
SUMMARY_LABELS: tuple[tuple[str, str], ...] = (
    ("测试时长 (s)", "Test Duration (s)"),
    ("并发数", "Concurrency"),
    ("请求速率 (req/s)", "Request Rate (req/s)"),
    ("总请求数", "Total Requests"),
    ("成功请求数", "Success Requests"),
    ("失败请求数", "Failed Requests"),
    ("请求吞吐 (req/s)", "Req Throughput (req/s)"),
    ("平均延迟 (s)", "Avg Latency (s)"),
    ("平均输入 Tokens", "Avg Input Tokens"),
    ("平均输出 Tokens", "Avg Output Tokens"),
    ("输出吞吐 (tok/s)", "Output Throughput (tok/s)"),
    ("输入吞吐 (tok/s)", "Input Throughput (tok/s)"),
    ("总吞吐 (tok/s)", "Total Throughput (tok/s)"),
    ("TTFT 首 token 延迟 (ms)", "TTFT (ms)"),
    ("TPOT 每 token 耗时 (ms)", "TPOT (ms)"),
    ("ITL token 间延迟 (ms)", "ITL (ms)"),
    ("平均对话轮次", "Avg Turns/Request"),
    ("KV Cache 命中率 (%)", "KV Cache Hit Rate (%)"),
    ("每轮解码 Tokens", "Decoded Tok/Iter"),
    ("投机接受率", "Spec. Accept Rate"),
)

# 客户端指标：(中文标签, detailed_metrics.client 内嵌套 key 路径)
CLIENT_LABELS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("总请求数", ("total_requests",)),
    ("成功请求数", ("success_requests",)),
    ("失败请求数", ("failed_requests",)),
    ("测试时长 (s)", ("test_duration_s",)),
    ("总输入 Tokens", ("total_prompt_tokens",)),
    ("平均输入 Tokens", ("avg_prompt_tokens",)),
    ("总生成 Tokens", ("total_generated_tokens",)),
    ("平均生成 Tokens", ("avg_generated_tokens",)),
    ("输出吞吐 (tok/s)", ("output_throughput_tps",)),
    ("总吞吐 (tok/s)", ("total_throughput_tps",)),
    ("单请求输出 TPS (P50)", ("single_request_output_tps_p50",)),
    ("解码 TPS (P50)", ("decode_tps_p50",)),
    ("端到端 TPS (P50)", ("e2e_tps_p50",)),
    ("延迟 P50 (s)", ("latency_s", "p50")),
    ("延迟 P95 (s)", ("latency_s", "p95")),
    ("延迟 P99 (s)", ("latency_s", "p99")),
    ("TTFT P50 (ms)", ("ttft_ms", "p50")),
    ("TTFT P95 (ms)", ("ttft_ms", "p95")),
    ("TTFT P99 (ms)", ("ttft_ms", "p99")),
    ("TPOT P50 (ms)", ("tpot_ms", "p50")),
    ("TPOT P95 (ms)", ("tpot_ms", "p95")),
    ("TPOT P99 (ms)", ("tpot_ms", "p99")),
    ("ITL P50 (ms)", ("itl_ms", "p50")),
    ("ITL P95 (ms)", ("itl_ms", "p95")),
    ("ITL P99 (ms)", ("itl_ms", "p99")),
)

# 服务端指标：(中文标签, detailed_metrics.server 内嵌套 key 路径)
SERVER_LABELS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("采样次数", ("sample_count",)),
    ("输入 Tokens", ("prompt_tokens",)),
    ("生成 Tokens", ("generation_tokens",)),
    ("Prefill TPS", ("prefill_tps",)),
    ("Decode TPS", ("decode_tps",)),
    ("队列耗时均值 (s)", ("queue_time_s", "avg")),
    ("Prefill 耗时均值 (s)", ("prefill_time_s", "avg")),
    ("Decode 耗时均值 (s)", ("decode_time_s", "avg")),
    ("E2E 延迟均值 (s)", ("e2e_latency_s", "avg")),
    ("最大运行请求数", ("max_running_requests",)),
    ("最大等待请求数", ("max_waiting_requests",)),
    ("最大 KV Cache 使用率", ("max_kv_cache_usage",)),
    ("抢占次数", ("preemptions",)),
)

# 分位数明细宽表：(中文标签, 分位行内 key)
PERCENTILE_LABELS: tuple[tuple[str, str], ...] = (
    ("延迟 (s)", "latency"),
    ("TTFT (ms)", "ttft"),
    ("TPOT (ms)", "tpot"),
    ("ITL (ms)", "itl"),
    ("输入 Tokens", "input_tokens"),
    ("输出 Tokens", "output_tokens"),
    ("输出吞吐 (tok/s)", "output_throughput"),
    ("输入吞吐 (tok/s)", "input_throughput"),
    ("总吞吐 (tok/s)", "total_throughput"),
    ("解码吞吐 (tok/s)", "decode_throughput"),
)
PERCENTILE_ORDER: tuple[str, ...] = ("1%", "5%", "10%", "25%", "50%", "75%", "90%", "95%", "99%")


def _csv_val(value: Any) -> str:
    """把指标值格式化成简洁的 CSV 文本。"""
    if value is None:
        return "-"
    if isinstance(value, bool):
        return "是" if value else "否"
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float):
        if not math.isfinite(value):
            return "-"
        if value.is_integer():
            return str(int(value))
        return f"{round(value, 4):.4f}".rstrip("0").rstrip(".")
    return str(value)


def _nested(data: Any, keys: tuple[str, ...]) -> Any:
    cur = data
    for key in keys:
        if not isinstance(cur, dict):
            return None
        cur = cur.get(key)
    return cur


def export_metrics_csv(task: Any, result: Any) -> str:
    """导出单个压测任务的完整指标 CSV（中文标签、分组清晰）。"""
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(["分组", "指标", "数值"])

    rate = task.rate
    for label, value in (
        ("任务 ID", task.id),
        ("任务名称", task.name),
        ("模型名称", task.model_name),
        ("模型 ID", task.model_id),
        ("请求总数", task.request_count),
        ("并发数", task.concurrency),
        ("请求速率 (req/s)", "不限速" if rate is None or rate <= 0 else rate),
        ("最大生成 Tokens", task.max_tokens),
        ("压测数据集", task.perf_dataset),
    ):
        writer.writerow(["任务参数", label, _csv_val(value)])

    metrics = result.metrics or {}
    seen: set[str] = set()
    for label, key in SUMMARY_LABELS:
        if key in metrics:
            seen.add(key)
            writer.writerow(["测试摘要", label, _csv_val(metrics[key])])
    for key, value in metrics.items():  # 未覆盖到的 EvalScope 指标保底输出
        if key not in seen:
            writer.writerow(["测试摘要", key, _csv_val(value)])

    detailed = result.detailed_metrics or {}
    client = detailed.get("client") if isinstance(detailed.get("client"), dict) else {}
    if client.get("available"):
        for label, path in CLIENT_LABELS:
            writer.writerow(["客户端指标", label, _csv_val(_nested(client, path))])
    else:
        writer.writerow(["客户端指标", "可用", "否"])
        writer.writerow(["客户端指标", "原因", _csv_val(client.get("reason"))])

    server = detailed.get("server") if isinstance(detailed.get("server"), dict) else {}
    writer.writerow(["服务端指标", "可用", "是" if server.get("available") else "否"])
    writer.writerow(["服务端指标", "Metrics 地址", _csv_val(server.get("metrics_url"))])
    if server.get("available"):
        for label, path in SERVER_LABELS:
            writer.writerow(["服务端指标", label, _csv_val(_nested(server, path))])
    else:
        writer.writerow(["服务端指标", "原因", _csv_val(server.get("reason"))])

    rows_by_pct = {
        str(row.get("percentile")): row
        for row in (result.percentiles or {}).get("rows", [])
        if isinstance(row, dict)
    }
    if rows_by_pct:
        writer.writerow([])
        writer.writerow(["分位数明细", "指标", *PERCENTILE_ORDER])
        for label, key in PERCENTILE_LABELS:
            cells = [_csv_val(rows_by_pct.get(pct, {}).get(key)) for pct in PERCENTILE_ORDER]
            writer.writerow(["分位数明细", label, *cells])

    return "\ufeff" + output.getvalue()


# ---------------------------------------------------------------------------
# \u7cbe\u7b80\u6307\u6807\u77e9\u9635\uff08\u884c=\u6307\u6807\uff0c\u5217=\u5e76\u53d1/\u4efb\u52a1\uff09\u2014\u2014\u7528\u4e8e Markdown / HTML \u5bfc\u51fa
# ---------------------------------------------------------------------------

# \u6bcf\u884c\uff1a(\u663e\u793a\u540d, PerfMatrixColumn \u5c5e\u6027\u540d, \u683c\u5f0f)\uff1b\u683c\u5f0f\u53d6 text / int / f2 / f4\u3002
PERF_THROUGHPUT_ROWS: tuple[tuple[str, str, str], ...] = (
    ("Backend", "backend", "text"),
    ("Concurrency", "concurrency", "int"),
    ("Total Requests", "total_requests", "int"),
    ("Failed Requests", "failed_requests", "int"),
    ("Target Prompt Tokens", "target_prompt_tokens", "int"),
    ("Actual Prompt Tokens", "actual_prompt_tokens", "int"),
    ("Max New Tokens", "max_new_tokens", "int"),
    ("Test Duration (s)", "test_duration_s", "f4"),
    ("Total Generated Tokens", "total_generated_tokens", "int"),
    ("Total Throughput (tok/s)", "total_throughput", "f2"),
    ("Single Request TPS (tok/s)", "single_request_tps", "f2"),
    ("Prefill TPS (tok/s)", "prefill_tps", "f2"),
    ("Decode TPS Median (tok/s)", "decode_tps_median", "f2"),
    ("E2E TPS Median (tok/s)", "e2e_tps_median", "f2"),
)
PERF_LATENCY_ROWS: tuple[tuple[str, str, str], ...] = (
    ("TTFT P50 (s)", "ttft_p50", "f4"),
    ("TTFT P95 (s)", "ttft_p95", "f4"),
    ("TTFT P99 (s)", "ttft_p99", "f4"),
    ("E2E Latency P50 (s)", "e2e_p50", "f4"),
    ("E2E Latency P95 (s)", "e2e_p95", "f4"),
    ("E2E Latency P99 (s)", "e2e_p99", "f4"),
)


@dataclass
class PerfMatrixColumn:
    """\u7cbe\u7b80\u77e9\u9635\u7684\u4e00\u5217\uff08\u5bf9\u5e94\u4e00\u4e2a\u538b\u6d4b\u4efb\u52a1/\u5e76\u53d1\u6863\u4f4d\uff09\u3002"""

    header: str
    backend: str = "vllm"
    concurrency: int | None = None
    total_requests: int | None = None
    failed_requests: int | None = None
    target_prompt_tokens: float | None = None
    actual_prompt_tokens: float | None = None
    max_new_tokens: int | None = None
    test_duration_s: float | None = None
    total_generated_tokens: float | None = None
    total_throughput: float | None = None
    single_request_tps: float | None = None
    prefill_tps: float | None = None
    decode_tps_median: float | None = None
    e2e_tps_median: float | None = None
    ttft_p50: float | None = None
    ttft_p95: float | None = None
    ttft_p99: float | None = None
    e2e_p50: float | None = None
    e2e_p95: float | None = None
    e2e_p99: float | None = None
    avg_input_tokens: float | None = None  # \u4ec5\u7528\u4e8e\u751f\u6210\u6d4b\u8bd5\u573a\u666f\u8bf4\u660e


def _num(value: Any) -> float | None:
    return float(value) if isinstance(value, int | float) else None


def _fmt_matrix(value: Any, fmt: str) -> str:
    if value is None:
        return "-"
    if fmt == "text":
        return str(value)
    number = _num(value)
    if number is None:
        return "-"
    if fmt == "int":
        return str(int(round(number)))
    if fmt == "f2":
        return f"{number:.2f}"
    return f"{number:.4f}"


def build_perf_matrix_column(
    *,
    header: str,
    concurrency: int | None,
    max_tokens: int | None,
    total_requests: int | None,
    failed_requests: int | None,
    total_token_throughput: float | None,
    metrics: dict[str, Any] | None,
    detailed_metrics: dict[str, Any] | None,
) -> PerfMatrixColumn:
    """\u628a\u5355\u4e2a\u4efb\u52a1\u7684\u6307\u6807\u63d0\u53d6\u6210\u7cbe\u7b80\u77e9\u9635\u5217\uff08\u542b\u56de\u9000\u903b\u8f91\uff09\u3002"""
    metrics = metrics or {}
    detailed = detailed_metrics or {}
    client = detailed.get("client") if isinstance(detailed.get("client"), dict) else {}
    server = detailed.get("server") if isinstance(detailed.get("server"), dict) else {}

    avg_input = _num(metrics.get("Avg Input Tokens"))
    actual_prompt = _num(client.get("avg_prompt_tokens"))
    if actual_prompt is None:
        actual_prompt = avg_input
    # \u5e73\u53f0\u65e0\u663e\u5f0f target \u8f93\u5165\u957f\u5ea6\uff0c\u7528\u5e73\u5747\u8f93\u5165 tokens \u4ee3\u66ff\u3002
    target_prompt = avg_input if avg_input is not None else actual_prompt

    test_duration = _num(client.get("test_duration_s"))
    if test_duration is None:
        test_duration = _num(metrics.get("Test Duration (s)"))

    total_thpt = total_token_throughput
    if total_thpt is None:
        total_thpt = _num(client.get("total_throughput_tps"))

    ttft = client.get("ttft_ms") if isinstance(client.get("ttft_ms"), dict) else {}
    latency = client.get("latency_s") if isinstance(client.get("latency_s"), dict) else {}

    def ms_to_s(value: Any) -> float | None:
        number = _num(value)
        return number / 1000 if number is not None else None

    return PerfMatrixColumn(
        header=header,
        concurrency=concurrency,
        total_requests=total_requests,
        failed_requests=failed_requests,
        target_prompt_tokens=target_prompt,
        actual_prompt_tokens=actual_prompt,
        max_new_tokens=max_tokens,
        test_duration_s=test_duration,
        total_generated_tokens=_num(client.get("total_generated_tokens")),
        total_throughput=total_thpt,
        single_request_tps=_num(client.get("single_request_output_tps_p50")),
        prefill_tps=_num(server.get("prefill_tps")),
        decode_tps_median=_num(client.get("decode_tps_p50")),
        e2e_tps_median=_num(client.get("e2e_tps_p50")),
        ttft_p50=ms_to_s(ttft.get("p50")),
        ttft_p95=ms_to_s(ttft.get("p95")),
        ttft_p99=ms_to_s(ttft.get("p99")),
        e2e_p50=_num(latency.get("p50")),
        e2e_p95=_num(latency.get("p95")),
        e2e_p99=_num(latency.get("p99")),
        avg_input_tokens=avg_input,
    )


def perf_scenario_note(column: PerfMatrixColumn) -> str:
    """\u751f\u6210\u300c\u6d4b\u8bd5\u573a\u666f\u300d\u8bf4\u660e\uff08\u4ec5\u5728\u5355\u5217\u65f6\u5c55\u793a\uff09\u3002"""
    parts: list[str] = []
    if column.avg_input_tokens is not None:
        parts.append(f"\u8f93\u5165 ~{int(round(column.avg_input_tokens))} tokens")
    if column.max_new_tokens is not None:
        parts.append(f"\u8f93\u51fa {int(column.max_new_tokens)} tokens")
    return "\u6d4b\u8bd5\u573a\u666f\uff1a" + "\uff0c".join(parts) if parts else ""


def render_perf_matrix_markdown(columns: list[PerfMatrixColumn], scenario_note: str = "") -> list[str]:
    """\u6e32\u67d3\u7cbe\u7b80\u77e9\u9635\u4e3a Markdown \u884c\u5217\u8868\uff08\u541e\u5410\u7ec4 + \u5ef6\u8fdf\u7ec4\u4e24\u5f20\u8868\uff09\u3002"""
    if not columns:
        return ["> \u6682\u65e0\u53ef\u7528\u7684\u6027\u80fd\u6307\u6807\u3002"]
    header_cells = ["\u6307\u6807", *[col.header for col in columns]]
    align = "|---|" + "|".join("---:" for _ in columns) + "|"
    lines: list[str] = []
    if scenario_note:
        lines += [f"> {scenario_note}", ""]
    for title, rows in (("\u541e\u5410\u91cf\u6307\u6807 \u5355\u4f4d: tok/s", PERF_THROUGHPUT_ROWS), ("\u5ef6\u8fdf\u6307\u6807 \u5355\u4f4d: \u79d2", PERF_LATENCY_ROWS)):
        lines += [f"### {title}", "", "| " + " | ".join(header_cells) + " |", align]
        for label, attr, fmt in rows:
            cells = [_fmt_matrix(getattr(col, attr), fmt) for col in columns]
            lines.append(f"| {label} | " + " | ".join(cells) + " |")
        lines.append("")
    return lines


def _perf_html_table(columns: list[PerfMatrixColumn], rows: tuple[tuple[str, str, str], ...]) -> str:
    head = "<th>\u6307\u6807</th>" + "".join(f"<th>{escape(col.header)}</th>" for col in columns)
    body = ""
    for label, attr, fmt in rows:
        cells = "".join(f"<td>{escape(_fmt_matrix(getattr(col, attr), fmt))}</td>" for col in columns)
        body += f"<tr><td>{escape(label)}</td>{cells}</tr>"
    return f"<table><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table>"


def render_perf_matrix_html_sections(columns: list[PerfMatrixColumn], scenario_note: str = "") -> list[str]:
    """\u6e32\u67d3\u7cbe\u7b80\u77e9\u9635\u4e3a HTML \u7247\u6bb5\u5217\u8868\uff0c\u4f9b\u62a5\u544a\u9875\u62fc\u63a5\u3002"""
    if not columns:
        return ["<p class='hint'>\u6682\u65e0\u53ef\u7528\u7684\u6027\u80fd\u6307\u6807\u3002</p>"]
    sections: list[str] = []
    if scenario_note:
        sections.append(f"<p class='hint'>{escape(scenario_note)}</p>")
    sections += [
        "<h3>\u541e\u5410\u91cf\u6307\u6807 \u5355\u4f4d: tok/s</h3>",
        _perf_html_table(columns, PERF_THROUGHPUT_ROWS),
        "<h3>\u5ef6\u8fdf\u6307\u6807 \u5355\u4f4d: \u79d2</h3>",
        _perf_html_table(columns, PERF_LATENCY_ROWS),
    ]
    return sections


def render_perf_matrix_document(columns: list[PerfMatrixColumn], scenario_note: str, title: str) -> str:
    """\u6e32\u67d3\u72ec\u7acb\u7684 HTML \u6587\u6863\uff08\u5355\u4efb\u52a1\u5bfc\u51fa\u7528\uff09\u3002"""
    body = "\n".join([f"<h2>{escape(title)}</h2>", *render_perf_matrix_html_sections(columns, scenario_note)])
    return (
        "<!doctype html><html><head><meta charset='utf-8'>"
        f"<title>{escape(title)}</title>"
        "<style>"
        "body{font-family:Inter,system-ui,sans-serif;padding:32px;background:#080d1a;color:#f2f5ff;line-height:1.6}"
        "h2,h3{color:#f2f5ff} .hint{color:#a8b3cf}"
        "table{width:100%;border-collapse:collapse;margin:12px 0 28px;background:#0e1628;border:1px solid #1c2a47}"
        "th,td{padding:10px 12px;border-bottom:1px solid #1c2a47;text-align:left;font-size:13px}"
        "th{color:#aab4ff;background:#15213a} tr:hover td{background:#14203a}"
        "</style></head><body>"
        + body
        + "</body></html>"
    )
