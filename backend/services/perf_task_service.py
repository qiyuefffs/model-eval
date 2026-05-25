"""性能压测任务服务层。"""

from __future__ import annotations

import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import orjson
from evalscope.perf.arguments import Arguments
from evalscope.perf.benchmark import run_benchmark
from evalscope.perf.utils.perf_constants import Metrics
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.schemas.perf_task import PerfResultRead, PerfTaskCreate, PerfTaskRead
from core.config import get_settings
from db.models import CustomDataset, PerfResult, PerfTask
from services.model_service import ModelNotFoundError, get_plain_api_key

TERMINAL_STATUSES = {"succeeded", "failed"}

METRIC_KEY_ALIASES = {
    "time_taken": Metrics.TIME_TAKEN_FOR_TESTS,
    "concurrency": Metrics.NUMBER_OF_CONCURRENCY,
    "request_rate": Metrics.REQUEST_RATE,
    "total_requests": Metrics.TOTAL_REQUESTS,
    "succeed_requests": Metrics.SUCCEED_REQUESTS,
    "failed_requests": Metrics.FAILED_REQUESTS,
    "request_throughput": Metrics.REQUEST_THROUGHPUT,
    "avg_latency": Metrics.AVERAGE_LATENCY,
    "avg_input_tokens": Metrics.AVERAGE_INPUT_TOKENS_PER_REQUEST,
    "output_token_throughput": Metrics.OUTPUT_TOKEN_THROUGHPUT,
    "total_token_throughput": Metrics.TOTAL_TOKEN_THROUGHPUT,
    "avg_ttft": Metrics.AVERAGE_TIME_TO_FIRST_TOKEN,
    "avg_tpot": Metrics.AVERAGE_TIME_PER_OUTPUT_TOKEN,
    "avg_itl": Metrics.AVERAGE_INTER_TOKEN_LATENCY,
    "avg_output_tokens": Metrics.AVERAGE_OUTPUT_TOKENS_PER_REQUEST,
    "input_token_throughput": Metrics.INPUT_TOKEN_THROUGHPUT,
    "avg_turns": Metrics.AVERAGE_INPUT_TURNS_PER_REQUEST,
    "avg_cached_percent": Metrics.AVERAGE_CACHED_PERCENT,
    "avg_decoded_tokens_per_iter": Metrics.AVERAGE_DECODED_TOKENS_PER_ITER,
    "approx_spec_acceptance_rate": Metrics.APPROX_SPECULATIVE_ACCEPTANCE_RATE,
}

PERCENTILE_KEY_ALIASES = {
    "percentile": "percentile",
    "latency": "latency",
    "ttft": "ttft",
    "itl": "itl",
    "tpot": "tpot",
    "input_tokens": "input_tokens",
    "output_tokens": "output_tokens",
    "output_throughput": "output_throughput",
    "input_throughput": "input_throughput",
    "total_throughput": "total_throughput",
    "decode_throughput": "decode_throughput",
}


class PerfTaskNotFoundError(Exception):
    """性能压测任务不存在。"""


class PerfTaskValidationError(Exception):
    """性能压测任务参数不合法。"""


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _jsonable(value: Any) -> Any:
    try:
        return orjson.loads(orjson.dumps(value, default=str))
    except TypeError:
        return str(value)


def _parse_value(value: str) -> int | float | str | None:
    if value == "None":
        return None
    try:
        number = float(value)
    except ValueError:
        return value.strip("'\"")
    return int(number) if number.is_integer() else number


def _object_to_dict(value: Any) -> dict[str, Any] | None:
    if isinstance(value, dict):
        return value
    if hasattr(value, "model_dump"):
        dumped = value.model_dump()
        return dumped if isinstance(dumped, dict) else None
    if hasattr(value, "dict"):
        dumped = value.dict()
        return dumped if isinstance(dumped, dict) else None
    if hasattr(value, "__dict__"):
        return {key: item for key, item in vars(value).items() if not key.startswith("_")}
    return None


def _parse_metric_string(value: str) -> dict[str, Any]:
    parsed: dict[str, Any] = {}
    for key, raw in re.findall(r"([A-Za-z_][A-Za-z0-9_]*)=([^ ]+)", value):
        parsed[key] = _parse_value(raw)
    return parsed


def _normalize_metric_keys(metrics: dict[str, Any]) -> dict[str, Any]:
    normalized: dict[str, Any] = {}
    for key, value in metrics.items():
        normalized[METRIC_KEY_ALIASES.get(key, key)] = value
    return normalized


def _normalize_metrics(value: Any) -> dict[str, Any]:
    raw = _object_to_dict(value)
    if raw is None:
        raw = {"result": value}
    if set(raw) == {"result"} and isinstance(raw["result"], str):
        raw = _parse_metric_string(raw["result"])
    return _normalize_metric_keys(raw)


def _parse_percentile_rows(value: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for row_text in re.findall(r"PercentileRow\((.*?)\)", value):
        row: dict[str, Any] = {}
        for key, raw in re.findall(r"([A-Za-z_][A-Za-z0-9_]*)=('[^']*'|[^,]+)", row_text):
            row[PERCENTILE_KEY_ALIASES.get(key, key)] = _parse_value(raw.strip())
        rows.append(row)
    return rows


def _normalize_percentiles(value: Any) -> dict[str, Any]:
    raw = _object_to_dict(value)
    if raw is None:
        raw = {"result": value}
    if set(raw) == {"result"} and isinstance(raw["result"], str):
        rows = _parse_percentile_rows(raw["result"])
        return {"rows": rows} if rows else raw
    rows = raw.get("rows")
    if isinstance(rows, list):
        return {"rows": [_object_to_dict(row) or {"result": str(row)} for row in rows]}
    return raw


def _metric(metrics: dict[str, Any], key: str) -> float | None:
    value = metrics.get(key)
    return float(value) if isinstance(value, int | float) else None


def _int_metric(metrics: dict[str, Any], key: str) -> int:
    value = metrics.get(key)
    return int(value) if isinstance(value, int | float) else 0


def _to_result_read(result: PerfResult) -> PerfResultRead:
    metrics = _normalize_metrics(result.metrics or {})
    percentiles = _normalize_percentiles(result.percentiles or {})
    total_requests = _int_metric(metrics, Metrics.TOTAL_REQUESTS) or result.total_requests
    succeed_requests = _int_metric(metrics, Metrics.SUCCEED_REQUESTS) or result.succeed_requests
    failed_requests = _int_metric(metrics, Metrics.FAILED_REQUESTS) or result.failed_requests
    success_rate = succeed_requests / total_requests if total_requests > 0 else result.success_rate
    return PerfResultRead(
        id=result.id,  # type: ignore[arg-type]
        task_id=result.task_id,
        total_requests=total_requests,
        succeed_requests=succeed_requests,
        failed_requests=failed_requests,
        request_throughput=_metric(metrics, Metrics.REQUEST_THROUGHPUT) or result.request_throughput,
        output_token_throughput=_metric(metrics, Metrics.OUTPUT_TOKEN_THROUGHPUT) or result.output_token_throughput,
        total_token_throughput=_metric(metrics, Metrics.TOTAL_TOKEN_THROUGHPUT) or result.total_token_throughput,
        avg_latency=_metric(metrics, Metrics.AVERAGE_LATENCY) or result.avg_latency,
        avg_ttft=_metric(metrics, Metrics.AVERAGE_TIME_TO_FIRST_TOKEN) or result.avg_ttft,
        avg_tpot=_metric(metrics, Metrics.AVERAGE_TIME_PER_OUTPUT_TOKEN) or result.avg_tpot,
        success_rate=success_rate,
        metrics=metrics,
        percentiles=percentiles,
        created_at=result.created_at,
    )


async def _load_result(session: AsyncSession, task_id: int) -> PerfResultRead | None:
    stmt = select(PerfResult).where(PerfResult.task_id == task_id).order_by(PerfResult.id.desc())
    result = await session.execute(stmt)
    obj = result.scalars().first()
    return _to_result_read(obj) if obj else None


def _to_read(task: PerfTask, result: PerfResultRead | None = None) -> PerfTaskRead:
    return PerfTaskRead(
        id=task.id,  # type: ignore[arg-type]
        name=task.name,
        model_pk=task.model_pk,
        model_name=task.model_name,
        model_id=task.model_id,
        status=task.status,  # type: ignore[arg-type]
        request_count=task.request_count,
        concurrency=task.concurrency,
        rate=task.rate,
        perf_dataset=task.perf_dataset,
        custom_dataset_id=task.custom_dataset_id,
        dataset_path=task.dataset_path,
        prompt=task.prompt,
        max_tokens=task.max_tokens,
        temperature=task.temperature,
        stream=task.stream,
        connect_timeout=task.connect_timeout,
        read_timeout=task.read_timeout,
        total_timeout=task.total_timeout,
        work_dir=task.work_dir,
        log_path=task.log_path,
        result_summary=task.result_summary,
        percentile_summary=task.percentile_summary,
        error_message=task.error_message,
        description=task.description,
        tags=task.tags or [],
        created_at=task.created_at,
        updated_at=task.updated_at,
        started_at=task.started_at,
        finished_at=task.finished_at,
        result=result,
    )


def _build_result(task_id: int, metrics: dict[str, Any], percentiles: dict[str, Any]) -> PerfResult:
    total = _int_metric(metrics, Metrics.TOTAL_REQUESTS)
    succeeded = _int_metric(metrics, Metrics.SUCCEED_REQUESTS)
    failed = _int_metric(metrics, Metrics.FAILED_REQUESTS)
    success_rate = succeeded / total if total > 0 else None
    return PerfResult(
        task_id=task_id,
        total_requests=total,
        succeed_requests=succeeded,
        failed_requests=failed,
        request_throughput=_metric(metrics, Metrics.REQUEST_THROUGHPUT),
        output_token_throughput=_metric(metrics, Metrics.OUTPUT_TOKEN_THROUGHPUT),
        total_token_throughput=_metric(metrics, Metrics.TOTAL_TOKEN_THROUGHPUT),
        avg_latency=_metric(metrics, Metrics.AVERAGE_LATENCY),
        avg_ttft=_metric(metrics, Metrics.AVERAGE_TIME_TO_FIRST_TOKEN),
        avg_tpot=_metric(metrics, Metrics.AVERAGE_TIME_PER_OUTPUT_TOKEN),
        success_rate=success_rate,
        metrics=metrics,
        percentiles=percentiles,
    )


def _pick_prompt(record: dict[str, Any]) -> str | None:
    for key in ("question", "query", "prompt", "input"):
        value = record.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    messages = record.get("messages") or record.get("conversation")
    if isinstance(messages, list) and messages:
        last = messages[-1]
        if isinstance(last, dict):
            content = last.get("content")
            if isinstance(content, str) and content.strip():
                return content.strip()
    return None


def _load_custom_prompts(dataset: CustomDataset) -> list[str]:
    path = Path(dataset.file_path)
    text = path.read_text(encoding="utf-8")
    if dataset.file_format == "jsonl":
        raw_records = [orjson.loads(line) for line in text.splitlines() if line.strip()]
    else:
        raw = orjson.loads(text)
        raw_records = raw.get("data") if isinstance(raw, dict) and isinstance(raw.get("data"), list) else raw

    if not isinstance(raw_records, list):
        raise PerfTaskValidationError(f"自定义数据集 '{dataset.name}' 不是有效样本数组")

    prompts = [_pick_prompt(record) for record in raw_records if isinstance(record, dict)]
    return [prompt for prompt in prompts if prompt]


async def _prepare_dataset_path(session: AsyncSession, task: PerfTask) -> str | None:
    if task.perf_dataset != "custom":
        return None
    if task.custom_dataset_id is None:
        raise PerfTaskValidationError("选择 custom 压测数据源时必须提供 custom_dataset_id")

    dataset = await session.get(CustomDataset, task.custom_dataset_id)
    if dataset is None:
        raise PerfTaskValidationError(f"自定义数据集 id={task.custom_dataset_id} 不存在")

    prompts = _load_custom_prompts(dataset)
    if not prompts:
        raise PerfTaskValidationError(f"自定义数据集 '{dataset.name}' 没有可用于压测的 prompt 字段")

    work_dir = Path(task.work_dir or get_settings().outputs_dir)
    work_dir.mkdir(parents=True, exist_ok=True)
    prompt_path = work_dir / "perf_prompts.txt"
    prompt_path.write_text("\n".join(prompts), encoding="utf-8")
    return str(prompt_path)


async def create_perf_task(session: AsyncSession, payload: PerfTaskCreate) -> PerfTaskRead:
    """创建性能压测任务，仅入库为 pending，入队由 API 层调用。"""
    try:
        model, _plain_key = await get_plain_api_key(session, payload.model_pk)
    except ModelNotFoundError:
        raise
    except ValueError as e:
        raise PerfTaskValidationError(str(e)) from e

    if payload.perf_dataset == "custom":
        if payload.custom_dataset_id is None:
            raise PerfTaskValidationError("选择自定义压测数据集时必须指定 custom_dataset_id")
        if await session.get(CustomDataset, payload.custom_dataset_id) is None:
            raise PerfTaskValidationError(f"自定义数据集 id={payload.custom_dataset_id} 不存在")

    settings = get_settings()
    obj = PerfTask(
        name=payload.name.strip(),
        model_pk=payload.model_pk,
        model_name=model.name,
        model_id=model.model_id,
        request_count=payload.request_count,
        concurrency=payload.concurrency,
        rate=payload.rate,
        perf_dataset=payload.perf_dataset,
        custom_dataset_id=payload.custom_dataset_id,
        prompt=payload.prompt,
        max_tokens=payload.max_tokens,
        temperature=payload.temperature,
        stream=payload.stream,
        connect_timeout=payload.connect_timeout,
        read_timeout=payload.read_timeout,
        total_timeout=payload.total_timeout,
        work_dir=str(settings.outputs_dir / "perf_tasks" / "pending"),
        description=payload.description,
        tags=payload.tags or [],
    )
    session.add(obj)
    await session.commit()
    await session.refresh(obj)

    task_dir = settings.outputs_dir / "perf_tasks" / str(obj.id)
    task_dir.mkdir(parents=True, exist_ok=True)
    log_dir = settings.outputs_dir.parent / "logs" / "perf_tasks"
    log_dir.mkdir(parents=True, exist_ok=True)
    obj.work_dir = str(task_dir)
    obj.log_path = str(log_dir / f"{obj.id}.log")
    await session.commit()
    await session.refresh(obj)
    return _to_read(obj)


async def list_perf_tasks(
    session: AsyncSession,
    *,
    status: str | None = None,
    model_pk: int | None = None,
) -> list[PerfTaskRead]:
    stmt = select(PerfTask).order_by(PerfTask.created_at.desc())
    if status:
        stmt = stmt.where(PerfTask.status == status)
    if model_pk:
        stmt = stmt.where(PerfTask.model_pk == model_pk)

    result = await session.execute(stmt)
    tasks = result.scalars().all()
    return [_to_read(item, await _load_result(session, item.id)) for item in tasks]


async def get_perf_task_read(session: AsyncSession, task_id: int) -> PerfTaskRead:
    task = await session.get(PerfTask, task_id)
    if task is None:
        raise PerfTaskNotFoundError(f"性能压测任务 id={task_id} 不存在")
    return _to_read(task, await _load_result(session, task_id))


async def list_runnable_task_ids(session: AsyncSession) -> list[int]:
    stmt = select(PerfTask.id).where(PerfTask.status.in_(("pending", "running"))).order_by(
        PerfTask.created_at.asc()
    )
    result = await session.execute(stmt)
    return [task_id for task_id in result.scalars().all() if task_id is not None]


async def mark_task_running(session: AsyncSession, task_id: int) -> PerfTask:
    task = await session.get(PerfTask, task_id)
    if task is None:
        raise PerfTaskNotFoundError(f"性能压测任务 id={task_id} 不存在")
    if task.status in TERMINAL_STATUSES:
        return task
    now = _utcnow()
    task.status = "running"
    task.started_at = task.started_at or now
    task.updated_at = now
    task.error_message = None
    await session.commit()
    await session.refresh(task)
    return task


async def mark_task_failed(session: AsyncSession, task_id: int, message: str) -> None:
    task = await session.get(PerfTask, task_id)
    if task is None:
        return
    now = _utcnow()
    task.status = "failed"
    task.error_message = message
    task.updated_at = now
    task.finished_at = now
    await session.commit()


async def run_perf_task(task_id: int) -> None:
    """执行单个性能压测任务，并把结果写回数据库。"""
    from db.database import session_scope

    async with session_scope() as session:
        task = await mark_task_running(session, task_id)
        if task.status in TERMINAL_STATUSES:
            return
        model, plain_key = await get_plain_api_key(session, task.model_pk)
        dataset_path = await _prepare_dataset_path(session, task)
        if dataset_path:
            task.dataset_path = dataset_path
            await session.commit()

    log_path = Path(task.log_path or "")
    if log_path:
        log_path.parent.mkdir(parents=True, exist_ok=True)
        log_path.write_text(f"[{_utcnow().isoformat()}] 开始性能压测任务 #{task_id}\n", encoding="utf-8")

    use_prompt = task.perf_dataset == "prompt"
    args = Arguments(
        model=model.model_id,
        model_id=model.model_id,
        api="openai",
        url=model.api_url,
        api_key=plain_key,
        number=task.request_count,
        parallel=task.concurrency,
        rate=task.rate,
        open_loop=task.rate > 0,
        prompt=task.prompt if use_prompt else None,
        dataset="custom" if task.perf_dataset == "custom" else task.perf_dataset,
        dataset_path=task.dataset_path,
        max_tokens=task.max_tokens,
        temperature=task.temperature,
        stream=task.stream,
        connect_timeout=task.connect_timeout,
        read_timeout=task.read_timeout,
        total_timeout=task.total_timeout,
        outputs_dir=task.work_dir or str(get_settings().outputs_dir),
        no_timestamp=True,
        enable_progress_tracker=True,
    )
    # EvalScope 1.7.0 的 Arguments 会把这些值规范成 list，但 run_benchmark 单次路径按标量使用。
    args.number = task.request_count
    args.parallel = -1 if task.rate > 0 else task.concurrency
    args.rate = task.rate

    metrics, percentiles = await run_benchmark(args)
    result_summary = _normalize_metrics(metrics)
    percentile_summary = _normalize_percentiles(percentiles)

    async with session_scope() as session:
        task = await session.get(PerfTask, task_id)
        if task is None:
            return
        await session.execute(delete(PerfResult).where(PerfResult.task_id == task_id))
        session.add(_build_result(task_id, result_summary, percentile_summary))
        now = _utcnow()
        task.status = "succeeded"
        task.result_summary = result_summary
        task.percentile_summary = percentile_summary
        task.updated_at = now
        task.finished_at = now
        await session.commit()

    if log_path:
        with log_path.open("a", encoding="utf-8") as f:
            f.write(f"[{_utcnow().isoformat()}] 性能压测任务 #{task_id} 完成\n")
