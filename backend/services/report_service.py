"""报告对比与导出服务。"""

import re
from datetime import UTC, datetime
from html import escape
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.schemas.report import (
    EvalDatasetScore,
    EvalScoreMatrixRow,
    PerfMetricRow,
    PerfPercentileRow,
    ReportCompareRequest,
    ReportCompareResponse,
    ReportExportRequest,
    ReportExportResponse,
    ReportTaskListResponse,
    ReportTaskOption,
    ReportTaskSummary,
    ReportTrendPoint,
)
from core.config import get_settings
from db.models import EvalResult, EvalTask, PerfResult, PerfTask


def _utcnow() -> datetime:
    return datetime.now(UTC)


async def _load_eval_tasks(session: AsyncSession, task_ids: list[int] | None = None) -> list[EvalTask]:
    stmt = select(EvalTask).where(EvalTask.status == "succeeded").order_by(EvalTask.created_at.desc())
    stmt = stmt.where(EvalTask.id.in_(task_ids)) if task_ids else stmt.limit(30)
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def _load_perf_tasks(session: AsyncSession, task_ids: list[int] | None = None) -> list[PerfTask]:
    stmt = select(PerfTask).where(PerfTask.status == "succeeded").order_by(PerfTask.created_at.desc())
    stmt = stmt.where(PerfTask.id.in_(task_ids)) if task_ids else stmt.limit(30)
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def _load_eval_results(session: AsyncSession, task_id: int) -> list[EvalResult]:
    stmt = select(EvalResult).where(EvalResult.task_id == task_id).order_by(EvalResult.id.asc())
    result = await session.execute(stmt)
    return list(result.scalars().all())


def _avg_score(results: list[EvalResult]) -> float | None:
    scores = [score for row in results if (score := _eval_result_score(row)) is not None]
    return sum(scores) / len(scores) if scores else None


def _score_from_text(value: str) -> float | None:
    for pattern in (
        r"\bscore\s*=\s*([-+]?\d+(?:\.\d+)?)",
        r"['\"]score['\"]\s*:\s*([-+]?\d+(?:\.\d+)?)",
        r"\b(?:main_score|accuracy|acc|mean_acc|macro_score)\s*[=:]\s*([-+]?\d+(?:\.\d+)?)",
    ):
        match = re.search(pattern, value, flags=re.IGNORECASE)
        if match:
            return float(match.group(1))
    return None


def _eval_result_score(row: EvalResult) -> float | None:
    if row.score is not None:
        return row.score
    for value in (row.metrics or {}).values():
        if isinstance(value, int | float):
            return float(value)
        if isinstance(value, str):
            score = _score_from_text(value)
            if score is not None:
                return score
    return None


async def _perf_result(session: AsyncSession, task_id: int) -> PerfResult | None:
    stmt = select(PerfResult).where(PerfResult.task_id == task_id).order_by(PerfResult.id.desc())
    result = await session.execute(stmt)
    return result.scalars().first()


def _float_value(value: Any) -> float | None:
    return float(value) if isinstance(value, int | float) else None


def _percentile_rows(result: PerfResult) -> list[dict[str, Any]]:
    rows = result.percentiles.get("rows") if isinstance(result.percentiles, dict) else None
    return [row for row in rows if isinstance(row, dict)] if isinstance(rows, list) else []


async def list_report_tasks(
    session: AsyncSession,
    *,
    task_type: str,
    keyword: str | None = None,
    limit: int = 50,
) -> ReportTaskListResponse:
    """列出报告页可选择的已完成任务。"""
    q = (keyword or "").strip().lower()
    options: list[ReportTaskOption] = []

    if task_type == "eval":
        for task in (await _load_eval_tasks(session))[:limit]:
            if q and q not in task.name.lower() and q not in task.model_name.lower() and q not in task.model_id.lower():
                continue
            results = await _load_eval_results(session, task.id)  # type: ignore[arg-type]
            score = _avg_score(results)
            options.append(
                ReportTaskOption(
                    task_type="eval",
                    task_id=task.id,  # type: ignore[arg-type]
                    task_name=task.name,
                    model_name=task.model_name,
                    model_id=task.model_id,
                    status=task.status,
                    primary_metric=score,
                    primary_metric_name="平均分",
                    created_at=task.created_at,
                    finished_at=task.finished_at,
                )
            )
    else:
        for task in (await _load_perf_tasks(session))[:limit]:
            if q and q not in task.name.lower() and q not in task.model_name.lower() and q not in task.model_id.lower():
                continue
            result = await _perf_result(session, task.id)  # type: ignore[arg-type]
            options.append(
                ReportTaskOption(
                    task_type="perf",
                    task_id=task.id,  # type: ignore[arg-type]
                    task_name=task.name,
                    model_name=task.model_name,
                    model_id=task.model_id,
                    status=task.status,
                    primary_metric=result.request_throughput if result else None,
                    primary_metric_name="Req/s",
                    created_at=task.created_at,
                    finished_at=task.finished_at,
                )
            )

    return ReportTaskListResponse(task_type=task_type, tasks=options)


async def compare_reports(session: AsyncSession, payload: ReportCompareRequest) -> ReportCompareResponse:
    """按任务类型和任务 id 聚合图表友好数据。"""
    generated_at = _utcnow()
    task_ids = payload.task_ids[:8]
    summaries: list[ReportTaskSummary] = []
    trends: list[ReportTrendPoint] = []
    eval_scores: list[EvalDatasetScore] = []
    eval_matrix: list[EvalScoreMatrixRow] = []
    perf_metrics: list[PerfMetricRow] = []
    perf_percentiles: list[PerfPercentileRow] = []

    if payload.task_type == "eval":
        for task in await _load_eval_tasks(session, task_ids):
            results = await _load_eval_results(session, task.id)  # type: ignore[arg-type]
            avg_score = _avg_score(results)
            summaries.append(
                ReportTaskSummary(
                    task_type="eval",
                    task_id=task.id,  # type: ignore[arg-type]
                    task_name=task.name,
                    model_name=task.model_name,
                    model_id=task.model_id,
                    created_at=task.created_at,
                    finished_at=task.finished_at,
                    primary_metric=avg_score,
                    primary_metric_name="平均分",
                )
            )
            score_map: dict[str, float | None] = {}
            for row in results:
                score = _eval_result_score(row)
                score_map[row.dataset_name] = score
                eval_scores.append(
                    EvalDatasetScore(
                        task_id=task.id,  # type: ignore[arg-type]
                        task_name=task.name,
                        model_name=task.model_name,
                        dataset_name=row.dataset_name,
                        metric_name=row.metric_name,
                        score=score,
                        metrics=row.metrics or {},
                    )
                )
            eval_matrix.append(
                EvalScoreMatrixRow(
                    task_id=task.id,  # type: ignore[arg-type]
                    task_name=task.name,
                    model_name=task.model_name,
                    scores=score_map,
                )
            )
            if avg_score is not None:
                trends.append(
                    ReportTrendPoint(
                        task_type="eval",
                        task_id=task.id,  # type: ignore[arg-type]
                        model_name=task.model_name,
                        metric_name="avg_score",
                        metric_value=avg_score,
                        created_at=task.created_at,
                    )
                )
    else:
        for task in await _load_perf_tasks(session, task_ids):
            result = await _perf_result(session, task.id)  # type: ignore[arg-type]
            if result is None:
                continue
            summaries.append(
                ReportTaskSummary(
                    task_type="perf",
                    task_id=task.id,  # type: ignore[arg-type]
                    task_name=task.name,
                    model_name=task.model_name,
                    model_id=task.model_id,
                    created_at=task.created_at,
                    finished_at=task.finished_at,
                    primary_metric=result.request_throughput,
                    primary_metric_name="Req/s",
                )
            )
            perf_metrics.append(
                PerfMetricRow(
                    task_id=task.id,  # type: ignore[arg-type]
                    task_name=task.name,
                    model_name=task.model_name,
                    total_requests=result.total_requests,
                    succeed_requests=result.succeed_requests,
                    failed_requests=result.failed_requests,
                    success_rate=result.success_rate,
                    request_throughput=result.request_throughput,
                    total_token_throughput=result.total_token_throughput,
                    avg_latency=result.avg_latency,
                    avg_ttft=result.avg_ttft,
                    avg_tpot=result.avg_tpot,
                    metrics=result.metrics or {},
                )
            )
            for row in _percentile_rows(result):
                perf_percentiles.append(
                    PerfPercentileRow(
                        task_id=task.id,  # type: ignore[arg-type]
                        task_name=task.name,
                        model_name=task.model_name,
                        percentile=str(row.get("percentile", "")),
                        latency=_float_value(row.get("latency")),
                        ttft=_float_value(row.get("ttft")),
                        tpot=_float_value(row.get("tpot")),
                        output_throughput=_float_value(row.get("output_throughput")),
                        total_throughput=_float_value(row.get("total_throughput")),
                    )
                )
            for metric_name, metric_value in {
                "request_throughput": result.request_throughput,
                "avg_ttft": result.avg_ttft,
                "avg_tpot": result.avg_tpot,
                "success_rate": result.success_rate,
            }.items():
                if metric_value is not None:
                    trends.append(
                        ReportTrendPoint(
                            task_type="perf",
                            task_id=task.id,  # type: ignore[arg-type]
                            model_name=task.model_name,
                            metric_name=metric_name,
                            metric_value=metric_value,
                            created_at=task.created_at,
                        )
                    )

    summaries.sort(key=lambda item: item.created_at, reverse=True)
    trends.sort(key=lambda item: item.created_at)
    return ReportCompareResponse(
        task_type=payload.task_type,
        generated_at=generated_at,
        tasks=summaries,
        eval_dataset_scores=eval_scores,
        eval_matrix=eval_matrix,
        perf_metrics=perf_metrics,
        perf_percentiles=perf_percentiles,
        trends=trends,
    )


def _fmt(value: float | None) -> str:
    return "-" if value is None else f"{value:.4f}"


def _fmt_percent(value: float | None) -> str:
    return "-" if value is None else f"{value * 100:.2f}%"


def _md(value: Any) -> str:
    text = "-" if value is None else str(value)
    return text.replace("|", "\\|").replace("\n", " ")


def _task_type_label(task_type: str) -> str:
    return "质量评测" if task_type == "eval" else "性能压测"


def _file_stem(report: ReportCompareResponse) -> str:
    task_ids = "-".join(str(task.task_id) for task in report.tasks) or "empty"
    return f"{report.task_type}-report-{report.generated_at.strftime('%Y%m%d%H%M%S')}-{task_ids}"


def _append_task_summary(lines: list[str], report: ReportCompareResponse) -> None:
    lines.extend(
        [
            "## 任务摘要",
            "",
            "| 任务 ID | 任务 | 模型 | 指标 | 创建时间 | 完成时间 |",
            "|---:|---|---|---:|---|---|",
        ]
    )
    for task in report.tasks:
        metric = f"{_fmt(task.primary_metric)} {task.primary_metric_name or ''}".strip()
        lines.append(
            f"| {task.task_id} | {_md(task.task_name)} | {_md(task.model_name)} | {_md(metric)} | "
            f"{task.created_at.isoformat()} | {_md(task.finished_at.isoformat() if task.finished_at else None)} |"
        )
    lines.append("")


def _eval_datasets(report: ReportCompareResponse) -> list[str]:
    return sorted({dataset for row in report.eval_matrix for dataset in row.scores})


def _row_average(scores: dict[str, float | None]) -> float | None:
    values = [value for value in scores.values() if value is not None]
    return sum(values) / len(values) if values else None


def _append_eval_chart_points(lines: list[str], report: ReportCompareResponse) -> None:
    datasets = _eval_datasets(report)
    lines.extend(
        [
            "### 平均分对比数据",
            "",
            "| 任务 ID | 任务 | 模型 | 平均分 |",
            "|---:|---|---|---:|",
        ]
    )
    for task in report.tasks:
        lines.append(f"| {task.task_id} | {_md(task.task_name)} | {_md(task.model_name)} | {_fmt(task.primary_metric)} |")

    if datasets:
        lines.extend(
            [
                "",
                "### Dataset 雷达 / 维度覆盖数据",
                "",
                "> 与前端一致：缺失 Dataset 分数使用该任务自身平均分作为雷达基线；原始分数仍在矩阵和明细中保留。",
                "",
            ]
        )
        lines.append("| 任务 ID | 任务 | 模型 | " + " | ".join(_md(dataset) for dataset in datasets) + " |")
        lines.append("|---:|---|---|" + "|".join("---:" for _ in datasets) + "|")
        for row in report.eval_matrix:
            baseline = _row_average(row.scores)
            values = " | ".join(_fmt(row.scores.get(dataset, baseline)) for dataset in datasets)
            lines.append(f"| {row.task_id} | {_md(row.task_name)} | {_md(row.model_name)} | {values} |")

        lines.extend(["", "### Dataset 热力图原始数据", ""])
        lines.append("| 任务 ID | 任务 | 模型 | " + " | ".join(_md(dataset) for dataset in datasets) + " |")
        lines.append("|---:|---|---|" + "|".join("---:" for _ in datasets) + "|")
        for row in report.eval_matrix:
            values = " | ".join(_fmt(row.scores.get(dataset)) for dataset in datasets)
            lines.append(f"| {row.task_id} | {_md(row.task_name)} | {_md(row.model_name)} | {values} |")


def _append_eval_markdown(lines: list[str], report: ReportCompareResponse) -> None:
    lines.extend(["## 质量评测结果", ""])
    _append_eval_chart_points(lines, report)
    datasets = _eval_datasets(report)
    if datasets:
        lines.extend(["", "### Dataset 分数矩阵", ""])
        lines.append("| 任务 ID | 任务 | 模型 | " + " | ".join(_md(dataset) for dataset in datasets) + " |")
        lines.append("|---:|---|---|" + "|".join("---:" for _ in datasets) + "|")
        for row in report.eval_matrix:
            values = " | ".join(_fmt(row.scores.get(dataset)) for dataset in datasets)
            lines.append(f"| {row.task_id} | {_md(row.task_name)} | {_md(row.model_name)} | {values} |")

    if report.trends:
        lines.extend(["", "### 平均分趋势", "", "| 任务 ID | 模型 | 平均分 | 创建时间 |", "|---:|---|---:|---|"])
        for point in report.trends:
            lines.append(
                f"| {point.task_id} | {_md(point.model_name)} | {_fmt(point.metric_value)} | {point.created_at.isoformat()} |"
            )
    lines.extend(
        [
            "",
            "### Dataset 分数明细",
            "",
            "| 任务 ID | 任务 | 模型 | 数据集 | 指标 | 分数 |",
            "|---:|---|---|---|---|---:|",
        ]
    )
    for row in report.eval_dataset_scores:
        lines.append(
            f"| {row.task_id} | {_md(row.task_name)} | {_md(row.model_name)} | {_md(row.dataset_name)} | "
            f"{_md(row.metric_name)} | {_fmt(row.score)} |"
        )
    lines.append("")


def _perf_scale_values(report: ReportCompareResponse) -> tuple[float, float, float, float]:
    max_req = max((row.request_throughput or 0 for row in report.perf_metrics), default=1)
    max_token = max((row.total_token_throughput or 0 for row in report.perf_metrics), default=1)
    ttft_values = [row.avg_ttft for row in report.perf_metrics if row.avg_ttft]
    tpot_values = [row.avg_tpot for row in report.perf_metrics if row.avg_tpot]
    min_ttft = min(ttft_values, default=1)
    min_tpot = min(tpot_values, default=1)
    return max(max_req, 1), max(max_token, 1), min_ttft, min_tpot


def _perf_radar_points(report: ReportCompareResponse) -> list[list[Any]]:
    max_req, max_token, min_ttft, min_tpot = _perf_scale_values(report)
    rows: list[list[Any]] = []
    for row in report.perf_metrics:
        rows.append(
            [
                row.task_id,
                row.task_name,
                row.model_name,
                _fmt(((row.request_throughput or 0) / max_req) * 100),
                _fmt(((row.total_token_throughput or 0) / max_token) * 100),
                _fmt((row.success_rate or 0) * 100),
                _fmt((min_ttft / row.avg_ttft) * 100 if row.avg_ttft else 0),
                _fmt((min_tpot / row.avg_tpot) * 100 if row.avg_tpot else 0),
            ]
        )
    return rows


def _append_perf_chart_points(lines: list[str], report: ReportCompareResponse) -> None:
    lines.extend(
        [
            "### 吞吐对比数据",
            "",
            "| 任务 ID | 任务 | 模型 | Req/s | Token/s |",
            "|---:|---|---|---:|---:|",
        ]
    )
    for row in report.perf_metrics:
        lines.append(
            f"| {row.task_id} | {_md(row.task_name)} | {_md(row.model_name)} | "
            f"{_fmt(row.request_throughput)} | {_fmt(row.total_token_throughput)} |"
        )

    lines.extend(
        [
            "",
            "### 延迟趋势对比数据",
            "",
            "| 任务 ID | 任务 | 模型 | Avg Lat(ms) | TTFT(ms) | TPOT(ms) |",
            "|---:|---|---|---:|---:|---:|",
        ]
    )
    for row in report.perf_metrics:
        lines.append(
            f"| {row.task_id} | {_md(row.task_name)} | {_md(row.model_name)} | {_fmt(row.avg_latency)} | "
            f"{_fmt(row.avg_ttft)} | {_fmt(row.avg_tpot)} |"
        )

    lines.extend(
        [
            "",
            "### 成功率对比数据",
            "",
            "| 任务 ID | 任务 | 模型 | 成功率 | 成功请求 | 失败请求 |",
            "|---:|---|---|---:|---:|---:|",
        ]
    )
    for row in report.perf_metrics:
        lines.append(
            f"| {row.task_id} | {_md(row.task_name)} | {_md(row.model_name)} | {_fmt_percent(row.success_rate)} | "
            f"{row.succeed_requests} | {row.failed_requests} |"
        )

    lines.extend(
        [
            "",
            "### 性能综合雷达归一化数据",
            "",
            "| 任务 ID | 任务 | 模型 | Req/s | Token/s | 成功率 | 低 TTFT | 低 TPOT |",
            "|---:|---|---|---:|---:|---:|---:|---:|",
        ]
    )
    for row in _perf_radar_points(report):
        lines.append("| " + " | ".join(_md(value) for value in row) + " |")

    lines.extend(
        [
            "",
            "### 性能指标热力图归一化数据",
            "",
            "| 任务 ID | 任务 | 模型 | Req/s | Token/s | 成功率 | TTFT 反向得分 | TPOT 反向得分 |",
            "|---:|---|---|---:|---:|---:|---:|---:|",
        ]
    )
    for row in _perf_radar_points(report):
        lines.append("| " + " | ".join(_md(value) for value in row) + " |")


def _append_perf_markdown(lines: list[str], report: ReportCompareResponse) -> None:
    lines.extend(["## 性能压测结果", ""])
    _append_perf_chart_points(lines, report)
    lines.extend(
        [
            "",
            "### 核心指标",
            "",
            "| 任务 ID | 任务 | 模型 | 请求 | 成功 | 失败 | 成功率 | Req/s | Token/s | Avg Lat(ms) | TTFT(ms) | TPOT(ms) |",
            "|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
        ]
    )
    for row in report.perf_metrics:
        lines.append(
            f"| {row.task_id} | {_md(row.task_name)} | {_md(row.model_name)} | {row.total_requests} | "
            f"{row.succeed_requests} | {row.failed_requests} | {_fmt_percent(row.success_rate)} | "
            f"{_fmt(row.request_throughput)} | {_fmt(row.total_token_throughput)} | {_fmt(row.avg_latency)} | "
            f"{_fmt(row.avg_ttft)} | {_fmt(row.avg_tpot)} |"
        )

    if report.perf_percentiles:
        lines.extend(
            [
                "",
                "### Percentile 明细",
                "",
                "| 任务 ID | 任务 | 模型 | P | Latency | TTFT | TPOT | Output Thpt | Total Thpt |",
                "|---:|---|---|---|---:|---:|---:|---:|---:|",
            ]
        )
        for row in report.perf_percentiles:
            lines.append(
                f"| {row.task_id} | {_md(row.task_name)} | {_md(row.model_name)} | {_md(row.percentile)} | "
                f"{_fmt(row.latency)} | {_fmt(row.ttft)} | {_fmt(row.tpot)} | "
                f"{_fmt(row.output_throughput)} | {_fmt(row.total_throughput)} |"
            )
    lines.append("")


def _render_markdown(report: ReportCompareResponse) -> str:
    lines = [
        "# EvalPlatform 对比报告",
        "",
        f"- 生成时间：{report.generated_at.isoformat()}",
        f"- 报告类型：{_task_type_label(report.task_type)}",
        f"- 任务数量：{len(report.tasks)}",
        "",
    ]
    _append_task_summary(lines, report)
    if report.task_type == "eval":
        _append_eval_markdown(lines, report)
    else:
        _append_perf_markdown(lines, report)
    return "\n".join(lines) + "\n"


def _html_table(headers: list[str], rows: list[list[Any]]) -> str:
    head = "".join(f"<th>{escape(header)}</th>" for header in headers)
    body = "".join(
        "<tr>" + "".join(f"<td>{escape('-' if value is None else str(value))}</td>" for value in row) + "</tr>"
        for row in rows
    )
    return f"<table><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table>"


def _render_html(report: ReportCompareResponse) -> str:
    task_rows = [
        [
            task.task_id,
            task.task_name,
            task.model_name,
            f"{_fmt(task.primary_metric)} {task.primary_metric_name or ''}".strip(),
            task.created_at.isoformat(),
            task.finished_at.isoformat() if task.finished_at else "-",
        ]
        for task in report.tasks
    ]
    sections = [
        "<h1>EvalPlatform 对比报告</h1>",
        "<section class='meta'>"
        f"<p><strong>生成时间：</strong>{escape(report.generated_at.isoformat())}</p>"
        f"<p><strong>报告类型：</strong>{escape(_task_type_label(report.task_type))}</p>"
        f"<p><strong>任务数量：</strong>{len(report.tasks)}</p>"
        "</section>",
        "<h2>任务摘要</h2>",
        _html_table(["任务 ID", "任务", "模型", "指标", "创建时间", "完成时间"], task_rows),
    ]

    if report.task_type == "eval":
        datasets = _eval_datasets(report)
        average_rows = [
            [task.task_id, task.task_name, task.model_name, _fmt(task.primary_metric)]
            for task in report.tasks
        ]
        radar_rows = [
            [
                row.task_id,
                row.task_name,
                row.model_name,
                *[_fmt(row.scores.get(dataset, _row_average(row.scores))) for dataset in datasets],
            ]
            for row in report.eval_matrix
        ]
        heatmap_rows = [
            [row.task_id, row.task_name, row.model_name, *[_fmt(row.scores.get(dataset)) for dataset in datasets]]
            for row in report.eval_matrix
        ]
        eval_rows = [
            [row.task_id, row.task_name, row.model_name, row.dataset_name, row.metric_name or "-", _fmt(row.score)]
            for row in report.eval_dataset_scores
        ]
        sections.extend(
            [
                "<h2>质量评测结果</h2>",
                "<h3>平均分对比数据</h3>",
                _html_table(["任务 ID", "任务", "模型", "平均分"], average_rows),
                "<h3>Dataset 雷达 / 维度覆盖数据</h3>",
                "<p class='hint'>缺失 Dataset 分数使用该任务自身平均分作为雷达基线；原始分数见热力图和矩阵数据。</p>",
                _html_table(["任务 ID", "任务", "模型", *datasets], radar_rows) if datasets else "",
                "<h3>Dataset 热力图原始数据</h3>",
                _html_table(["任务 ID", "任务", "模型", *datasets], heatmap_rows) if datasets else "",
                "<h3>Dataset 分数明细</h3>",
                _html_table(["任务 ID", "任务", "模型", "数据集", "指标", "分数"], eval_rows),
            ]
        )
        if datasets:
            matrix_rows = [
                [row.task_id, row.task_name, row.model_name, *[_fmt(row.scores.get(dataset)) for dataset in datasets]]
                for row in report.eval_matrix
            ]
            sections.extend(
                [
                    "<h3>Dataset 分数矩阵</h3>",
                    _html_table(["任务 ID", "任务", "模型", *datasets], matrix_rows),
                ]
            )
    else:
        metric_rows = [
            [
                row.task_id,
                row.task_name,
                row.model_name,
                row.total_requests,
                row.succeed_requests,
                row.failed_requests,
                _fmt_percent(row.success_rate),
                _fmt(row.request_throughput),
                _fmt(row.total_token_throughput),
                _fmt(row.avg_latency),
                _fmt(row.avg_ttft),
                _fmt(row.avg_tpot),
            ]
            for row in report.perf_metrics
        ]
        sections.extend(
            [
                "<h2>性能压测结果</h2>",
                "<h3>吞吐对比数据</h3>",
                _html_table(
                    ["任务 ID", "任务", "模型", "Req/s", "Token/s"],
                    [
                        [
                            row.task_id,
                            row.task_name,
                            row.model_name,
                            _fmt(row.request_throughput),
                            _fmt(row.total_token_throughput),
                        ]
                        for row in report.perf_metrics
                    ],
                ),
                "<h3>延迟趋势对比数据</h3>",
                _html_table(
                    ["任务 ID", "任务", "模型", "Avg Lat", "TTFT", "TPOT"],
                    [
                        [
                            row.task_id,
                            row.task_name,
                            row.model_name,
                            _fmt(row.avg_latency),
                            _fmt(row.avg_ttft),
                            _fmt(row.avg_tpot),
                        ]
                        for row in report.perf_metrics
                    ],
                ),
                "<h3>成功率对比数据</h3>",
                _html_table(
                    ["任务 ID", "任务", "模型", "成功率", "成功请求", "失败请求"],
                    [
                        [
                            row.task_id,
                            row.task_name,
                            row.model_name,
                            _fmt_percent(row.success_rate),
                            row.succeed_requests,
                            row.failed_requests,
                        ]
                        for row in report.perf_metrics
                    ],
                ),
                "<h3>性能综合雷达归一化数据</h3>",
                _html_table(
                    ["任务 ID", "任务", "模型", "Req/s", "Token/s", "成功率", "低 TTFT", "低 TPOT"],
                    _perf_radar_points(report),
                ),
                "<h3>性能指标热力图归一化数据</h3>",
                _html_table(
                    ["任务 ID", "任务", "模型", "Req/s", "Token/s", "成功率", "TTFT 反向得分", "TPOT 反向得分"],
                    _perf_radar_points(report),
                ),
                "<h3>核心指标</h3>",
                _html_table(
                    ["任务 ID", "任务", "模型", "请求", "成功", "失败", "成功率", "Req/s", "Token/s", "Avg Lat", "TTFT", "TPOT"],
                    metric_rows,
                ),
            ]
        )
        if report.perf_percentiles:
            percentile_rows = [
                [
                    row.task_id,
                    row.task_name,
                    row.model_name,
                    row.percentile,
                    _fmt(row.latency),
                    _fmt(row.ttft),
                    _fmt(row.tpot),
                    _fmt(row.output_throughput),
                    _fmt(row.total_throughput),
                ]
                for row in report.perf_percentiles
            ]
            sections.extend(
                [
                    "<h3>Percentile 明细</h3>",
                    _html_table(["任务 ID", "任务", "模型", "P", "Latency", "TTFT", "TPOT", "Output Thpt", "Total Thpt"], percentile_rows),
                ]
            )

    return (
        "<!doctype html><html><head><meta charset='utf-8'>"
        "<title>EvalPlatform 对比报告</title>"
        "<style>"
        "body{font-family:Manrope,system-ui,sans-serif;padding:32px;background:#0a0e14;color:#e6e1cf;line-height:1.6}"
        "h1,h2,h3{color:#f5f2e8} h1{margin-top:0} .meta{color:#b3b1ad;margin-bottom:28px}"
        "table{width:100%;border-collapse:collapse;margin:12px 0 28px;background:#111821;border:1px solid #293241}"
        "th,td{padding:10px 12px;border-bottom:1px solid #293241;text-align:left;font-size:13px}"
        "th{color:#50c878;background:#17202b} tr:hover td{background:#162230}"
        "</style></head><body>"
        + "\n".join(sections)
        + "</body></html>"
    )


async def export_report(session: AsyncSession, payload: ReportExportRequest) -> ReportExportResponse:
    """生成报告文件并返回内容。"""
    report = await compare_reports(
        session,
        ReportCompareRequest(task_type=payload.task_type, task_ids=payload.task_ids),
    )
    markdown = _render_markdown(report)
    content = _render_html(report) if payload.format == "html" else markdown

    settings = get_settings()
    settings.reports_dir.mkdir(parents=True, exist_ok=True)
    suffix = "html" if payload.format == "html" else "md"
    file_path = settings.reports_dir / f"{_file_stem(report)}.{suffix}"
    file_path.write_text(content, encoding="utf-8")
    return ReportExportResponse(
        format=payload.format,
        file_path=str(file_path),
        content=content,
        generated_at=report.generated_at,
    )
