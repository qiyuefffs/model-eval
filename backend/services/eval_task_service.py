"""质量评测任务服务层。"""

from __future__ import annotations

import math
import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import orjson
from evalscope import TaskConfig, run_task
from evalscope.constants import EvalType
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.schemas.eval_task import EvalResultRead, EvalTaskCreate, EvalTaskRead
from core.config import get_settings
from db.models import CustomDataset, EvalResult, EvalTask, Model
from services.model_service import ModelNotFoundError, get_plain_api_key

TERMINAL_STATUSES = {"succeeded", "failed"}


class EvalTaskNotFoundError(Exception):
    """评测任务不存在。"""


class EvalTaskValidationError(Exception):
    """评测任务参数不合法。"""


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _jsonable(value: Any) -> Any:
    """把 EvalScope 返回值转换成 SQLite JSON 可存储结构。"""
    try:
        return orjson.loads(orjson.dumps(value, default=str))
    except TypeError:
        return str(value)


def _to_result_read(result: EvalResult) -> EvalResultRead:
    return EvalResultRead(
        id=result.id,  # type: ignore[arg-type]
        task_id=result.task_id,
        dataset_name=result.dataset_name,
        metric_name=result.metric_name,
        score=result.score,
        metrics=result.metrics or {},
        created_at=result.created_at,
    )


async def _load_results(session: AsyncSession, task_id: int) -> list[EvalResultRead]:
    stmt = select(EvalResult).where(EvalResult.task_id == task_id).order_by(EvalResult.id.asc())
    result = await session.execute(stmt)
    return [_to_result_read(item) for item in result.scalars().all()]


def _to_read(task: EvalTask, results: list[EvalResultRead] | None = None) -> EvalTaskRead:
    return EvalTaskRead(
        id=task.id,  # type: ignore[arg-type]
        name=task.name,
        model_pk=task.model_pk,
        model_name=task.model_name,
        model_id=task.model_id,
        status=task.status,  # type: ignore[arg-type]
        benchmark_names=task.benchmark_names or [],
        custom_dataset_ids=task.custom_dataset_ids or [],
        dataset_args=task.dataset_args or {},
        generation_config=task.generation_config or {},
        eval_backend=task.eval_backend,
        eval_batch_size=task.eval_batch_size,
        limit=task.limit,
        work_dir=task.work_dir,
        log_path=task.log_path,
        result_summary=task.result_summary,
        error_message=task.error_message,
        description=task.description,
        tags=task.tags or [],
        created_at=task.created_at,
        updated_at=task.updated_at,
        started_at=task.started_at,
        finished_at=task.finished_at,
        results=results or [],
    )


def _normalize_limit(limit: float | None) -> int | float | None:
    if limit is None:
        return None
    return int(limit) if math.isclose(limit, int(limit)) else limit


def _safe_evalscope_model_id(model_id: str) -> str:
    """EvalScope 会把 model_id 拼进缓存路径，这里避免本地路径或斜杠穿透 work_dir。"""
    name = Path(model_id).name or model_id
    safe_name = re.sub(r"[^A-Za-z0-9._-]+", "_", name).strip("._-")
    return safe_name or "model"


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


def _extract_score(metrics: dict[str, Any]) -> tuple[str | None, float | None]:
    for key in ("score", "main_score", "accuracy", "acc", "Rouge-L-R", "rouge-l-r"):
        value = metrics.get(key)
        if isinstance(value, int | float):
            return key, float(value)
        if isinstance(value, str):
            score = _score_from_text(value)
            if score is not None:
                return "score", score
    for key, value in metrics.items():
        if isinstance(value, int | float):
            return key, float(value)
        if isinstance(value, str):
            score = _score_from_text(value)
            if score is not None:
                return "score", score
    return None, None


def _summarize_results(task_id: int, raw_result: Any) -> list[EvalResult]:
    json_result = _jsonable(raw_result)
    if not isinstance(json_result, dict):
        return [
            EvalResult(
                task_id=task_id,
                dataset_name="overall",
                metric_name=None,
                score=None,
                metrics={"result": json_result},
            )
        ]

    rows: list[EvalResult] = []
    for dataset_name, metrics in json_result.items():
        metric_dict = metrics if isinstance(metrics, dict) else {"value": metrics}
        metric_name, score = _extract_score(metric_dict)
        rows.append(
            EvalResult(
                task_id=task_id,
                dataset_name=str(dataset_name),
                metric_name=metric_name,
                score=score,
                metrics=metric_dict,
            )
        )
    return rows


async def _load_custom_datasets(
    session: AsyncSession,
    custom_dataset_ids: list[int],
) -> list[CustomDataset]:
    datasets: list[CustomDataset] = []
    for dataset_pk in custom_dataset_ids:
        obj = await session.get(CustomDataset, dataset_pk)
        if obj is None:
            raise EvalTaskValidationError(f"自定义数据集 id={dataset_pk} 不存在")
        datasets.append(obj)
    return datasets


def _compose_dataset_args(
    task: EvalTask,
    custom_datasets: list[CustomDataset],
) -> tuple[list[str], dict[str, Any]]:
    dataset_names = list(task.benchmark_names or [])
    dataset_args = dict(task.dataset_args or {})
    seen_custom_types: set[str] = set()

    for dataset in custom_datasets:
        if dataset.dataset_type in seen_custom_types or dataset.dataset_type in dataset_names:
            raise EvalTaskValidationError(
                f"一次评测暂不支持重复的自定义数据集类型：{dataset.dataset_type}"
            )
        seen_custom_types.add(dataset.dataset_type)
        dataset_names.append(dataset.dataset_type)
        dataset_args[dataset.dataset_type] = {
            **dict(dataset_args.get(dataset.dataset_type, {})),
            "local_path": dataset.file_path,
        }

    return dataset_names, dataset_args


async def create_eval_task(session: AsyncSession, payload: EvalTaskCreate) -> EvalTaskRead:
    """创建评测任务，仅入库为 pending，入队由 API 层调用。"""
    try:
        model, _plain_key = await get_plain_api_key(session, payload.model_pk)
    except ModelNotFoundError:
        raise
    except ValueError as e:
        raise EvalTaskValidationError(str(e)) from e

    await _load_custom_datasets(session, payload.custom_dataset_ids)
    settings = get_settings()

    obj = EvalTask(
        name=payload.name.strip(),
        model_pk=payload.model_pk,
        model_name=model.name,
        model_id=model.model_id,
        benchmark_names=[name.strip() for name in payload.benchmark_names if name.strip()],
        custom_dataset_ids=payload.custom_dataset_ids,
        dataset_args=payload.dataset_args,
        generation_config=payload.generation_config,
        eval_backend=payload.eval_backend,
        eval_batch_size=payload.eval_batch_size,
        limit=payload.limit,
        work_dir=str(settings.outputs_dir / "eval_tasks" / "pending"),
        log_path=None,
        description=payload.description,
        tags=payload.tags or [],
    )
    session.add(obj)
    await session.commit()
    await session.refresh(obj)

    task_dir = settings.outputs_dir / "eval_tasks" / str(obj.id)
    task_dir.mkdir(parents=True, exist_ok=True)
    log_dir = settings.outputs_dir.parent / "logs" / "eval_tasks"
    log_dir.mkdir(parents=True, exist_ok=True)
    obj.work_dir = str(task_dir)
    obj.log_path = str(log_dir / f"{obj.id}.log")
    await session.commit()
    await session.refresh(obj)
    return _to_read(obj)


async def list_eval_tasks(
    session: AsyncSession,
    *,
    status: str | None = None,
    model_pk: int | None = None,
) -> list[EvalTaskRead]:
    """列出评测任务，按创建时间倒序。"""
    stmt = select(EvalTask).order_by(EvalTask.created_at.desc())
    if status:
        stmt = stmt.where(EvalTask.status == status)
    if model_pk:
        stmt = stmt.where(EvalTask.model_pk == model_pk)

    result = await session.execute(stmt)
    tasks = result.scalars().all()
    return [_to_read(item, await _load_results(session, item.id)) for item in tasks]


async def get_eval_task_read(session: AsyncSession, task_id: int) -> EvalTaskRead:
    """获取评测任务详情。"""
    task = await session.get(EvalTask, task_id)
    if task is None:
        raise EvalTaskNotFoundError(f"评测任务 id={task_id} 不存在")
    return _to_read(task, await _load_results(session, task_id))


async def list_runnable_task_ids(session: AsyncSession) -> list[int]:
    """恢复启动前处于 pending/running 的任务。"""
    stmt = select(EvalTask.id).where(EvalTask.status.in_(("pending", "running"))).order_by(
        EvalTask.created_at.asc()
    )
    result = await session.execute(stmt)
    return [task_id for task_id in result.scalars().all() if task_id is not None]


async def mark_task_running(session: AsyncSession, task_id: int) -> EvalTask:
    task = await session.get(EvalTask, task_id)
    if task is None:
        raise EvalTaskNotFoundError(f"评测任务 id={task_id} 不存在")
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
    task = await session.get(EvalTask, task_id)
    if task is None:
        return
    now = _utcnow()
    task.status = "failed"
    task.error_message = message
    task.updated_at = now
    task.finished_at = now
    await session.commit()


async def run_eval_task(task_id: int) -> None:
    """执行单个评测任务，并把结果写回数据库。"""
    from db.database import session_scope

    async with session_scope() as session:
        task = await mark_task_running(session, task_id)
        if task.status in TERMINAL_STATUSES:
            return

        model = await session.get(Model, task.model_pk)
        if model is None:
            raise EvalTaskValidationError(f"模型 id={task.model_pk} 不存在")
        _model, plain_key = await get_plain_api_key(session, task.model_pk)
        custom_datasets = await _load_custom_datasets(session, task.custom_dataset_ids or [])
        dataset_names, dataset_args = _compose_dataset_args(task, custom_datasets)

    log_path = Path(task.log_path or "")
    if log_path:
        log_path.parent.mkdir(parents=True, exist_ok=True)
        log_path.write_text(f"[{_utcnow().isoformat()}] 开始评测任务 #{task_id}\n", encoding="utf-8")

    task_config = TaskConfig(
        model=model.model_id,
        model_id=_safe_evalscope_model_id(model.model_id),
        api_url=model.api_url,
        api_key=plain_key,
        eval_type=EvalType.OPENAI_API,
        datasets=dataset_names,
        dataset_args=dataset_args,
        eval_backend=task.eval_backend,
        eval_batch_size=task.eval_batch_size,
        limit=_normalize_limit(task.limit),
        generation_config=task.generation_config or {},
        work_dir=task.work_dir or str(get_settings().outputs_dir),
        no_timestamp=True,
        enable_progress_tracker=True,
        ignore_errors=False,
    )

    raw_result = await __import__("asyncio").to_thread(run_task, task_config)
    result_summary = _jsonable(raw_result)
    result_rows = _summarize_results(task_id, raw_result)

    async with session_scope() as session:
        task = await session.get(EvalTask, task_id)
        if task is None:
            return
        await session.execute(delete(EvalResult).where(EvalResult.task_id == task_id))
        for row in result_rows:
            session.add(row)
        now = _utcnow()
        task.status = "succeeded"
        task.result_summary = result_summary
        task.dataset_args = dataset_args
        task.updated_at = now
        task.finished_at = now
        await session.commit()

    if log_path:
        with log_path.open("a", encoding="utf-8") as f:
            f.write(f"[{_utcnow().isoformat()}] 评测任务 #{task_id} 完成\n")
