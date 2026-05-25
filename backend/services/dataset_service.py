"""自定义数据集上传、校验与持久化。"""

import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import orjson
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from api.schemas.dataset import CustomDatasetRead, DatasetValidationPreview
from core.config import get_settings
from db.models import CustomDataset

SUPPORTED_DATASET_TYPES = {"general_qa", "general_mcq", "general_fc"}
SUPPORTED_FILE_FORMATS = {"json", "jsonl"}


class DatasetAlreadyExistsError(Exception):
    """同名数据集已存在。"""


class DatasetNotFoundError(Exception):
    """数据集不存在。"""


class DatasetValidationError(Exception):
    """数据集格式校验失败。"""


def _to_read(dataset: CustomDataset) -> CustomDatasetRead:
    return CustomDatasetRead(
        id=dataset.id,  # type: ignore[arg-type]
        name=dataset.name,
        dataset_type=dataset.dataset_type,
        file_name=dataset.file_name,
        file_format=dataset.file_format,
        row_count=dataset.row_count,
        description=dataset.description,
        tags=dataset.tags or [],
        created_at=dataset.created_at,
        updated_at=dataset.updated_at,
    )


def _normalize_name(name: str) -> str:
    value = name.strip()
    if not value:
        raise DatasetValidationError("数据集名称不能为空")
    if len(value) > 120:
        raise DatasetValidationError("数据集名称不能超过 120 个字符")
    return value


def _parse_tags(raw_tags: str | None) -> list[str]:
    if not raw_tags:
        return []
    tags = [tag.strip() for tag in re.split(r"[,，]", raw_tags) if tag.strip()]
    return tags[:20]


def _detect_format(filename: str) -> str:
    suffix = Path(filename).suffix.lower().lstrip(".")
    if suffix not in SUPPORTED_FILE_FORMATS:
        raise DatasetValidationError("仅支持 .json / .jsonl 文件")
    return suffix


def _load_records(content: bytes, file_format: str) -> list[dict[str, Any]]:
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError as e:
        raise DatasetValidationError("文件必须使用 UTF-8 编码") from e

    try:
        if file_format == "jsonl":
            records = [orjson.loads(line) for line in text.splitlines() if line.strip()]
        else:
            raw = orjson.loads(text)
            records = raw.get("data") if isinstance(raw, dict) and isinstance(raw.get("data"), list) else raw
    except orjson.JSONDecodeError as e:
        raise DatasetValidationError(f"JSON 解析失败：{e}") from e

    if not isinstance(records, list) or not records:
        raise DatasetValidationError("数据集必须是非空数组，或 JSONL 非空记录")

    if not all(isinstance(item, dict) for item in records):
        raise DatasetValidationError("每条样本必须是 JSON 对象")

    return records


def _has_any(record: dict[str, Any], keys: set[str]) -> bool:
    return any(key in record and record[key] not in (None, "") for key in keys)


def _validate_general_qa(record: dict[str, Any], index: int) -> None:
    if not _has_any(record, {"question", "query", "prompt", "input"}):
        raise DatasetValidationError(f"第 {index} 条 general_qa 样本缺少 question/query/prompt/input")
    if not _has_any(record, {"answer", "response", "output", "target"}):
        raise DatasetValidationError(f"第 {index} 条 general_qa 样本缺少 answer/response/output/target")


def _validate_general_mcq(record: dict[str, Any], index: int) -> None:
    if not _has_any(record, {"question", "query", "prompt", "input"}):
        raise DatasetValidationError(f"第 {index} 条 general_mcq 样本缺少题干字段")
    if not _has_any(record, {"choices", "options"}):
        raise DatasetValidationError(f"第 {index} 条 general_mcq 样本缺少 choices/options")
    if not _has_any(record, {"answer", "label", "target"}):
        raise DatasetValidationError(f"第 {index} 条 general_mcq 样本缺少 answer/label/target")


def _validate_general_fc(record: dict[str, Any], index: int) -> None:
    if not _has_any(record, {"messages", "conversation", "prompt"}):
        raise DatasetValidationError(f"第 {index} 条 general_fc 样本缺少 messages/conversation/prompt")
    if not _has_any(record, {"tools", "functions", "function"}):
        raise DatasetValidationError(f"第 {index} 条 general_fc 样本缺少 tools/functions/function")


def validate_dataset_content(
    *,
    content: bytes,
    filename: str,
    dataset_type: str,
) -> DatasetValidationPreview:
    """校验上传内容，并返回样本数与文件格式。"""
    if dataset_type not in SUPPORTED_DATASET_TYPES:
        raise DatasetValidationError("dataset_type 仅支持 general_qa/general_mcq/general_fc")

    file_format = _detect_format(filename)
    records = _load_records(content, file_format)

    validators = {
        "general_qa": _validate_general_qa,
        "general_mcq": _validate_general_mcq,
        "general_fc": _validate_general_fc,
    }
    validator = validators[dataset_type]
    for index, record in enumerate(records, start=1):
        validator(record, index)

    return DatasetValidationPreview(row_count=len(records), file_format=file_format)


def _build_storage_path(name: str, file_format: str, dataset_type: str) -> Path:
    settings = get_settings()
    slug = re.sub(r"[^a-zA-Z0-9_-]+", "-", name).strip("-") or "dataset"
    timestamp = datetime.now(UTC).strftime("%Y%m%d%H%M%S")
    target_dir = settings.custom_datasets_dir / dataset_type
    target_dir.mkdir(parents=True, exist_ok=True)
    return target_dir / f"{timestamp}-{slug}.{file_format}"


async def create_dataset(
    session: AsyncSession,
    *,
    name: str,
    dataset_type: str,
    filename: str,
    content: bytes,
    description: str | None,
    raw_tags: str | None,
) -> CustomDatasetRead:
    """校验并创建自定义数据集。"""
    dataset_name = _normalize_name(name)
    preview = validate_dataset_content(content=content, filename=filename, dataset_type=dataset_type)
    storage_path = _build_storage_path(dataset_name, preview.file_format, dataset_type)
    storage_path.write_bytes(content)

    obj = CustomDataset(
        name=dataset_name,
        dataset_type=dataset_type,
        file_name=filename,
        file_path=str(storage_path),
        file_format=preview.file_format,
        row_count=preview.row_count,
        description=description,
        tags=_parse_tags(raw_tags),
    )
    session.add(obj)
    try:
        await session.commit()
    except IntegrityError as e:
        await session.rollback()
        storage_path.unlink(missing_ok=True)
        raise DatasetAlreadyExistsError(f"数据集名 '{dataset_name}' 已存在") from e

    await session.refresh(obj)
    return _to_read(obj)


async def list_datasets(
    session: AsyncSession,
    *,
    dataset_type: str | None = None,
    tag: str | None = None,
) -> list[CustomDatasetRead]:
    """列出自定义数据集。"""
    stmt = select(CustomDataset).order_by(CustomDataset.created_at.desc())
    if dataset_type:
        stmt = stmt.where(CustomDataset.dataset_type == dataset_type)

    result = await session.execute(stmt)
    items = [_to_read(item) for item in result.scalars().all()]
    if tag:
        q = tag.strip().lower()
        items = [item for item in items if any(q == t.lower() for t in item.tags)]
    return items


async def delete_dataset(session: AsyncSession, dataset_pk: int) -> None:
    """删除数据集记录与对应文件。"""
    obj = await session.get(CustomDataset, dataset_pk)
    if obj is None:
        raise DatasetNotFoundError(f"数据集 id={dataset_pk} 不存在")

    file_path = Path(obj.file_path)
    await session.delete(obj)
    await session.commit()
    file_path.unlink(missing_ok=True)
