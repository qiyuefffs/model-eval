"""自定义数据集相关 schema。"""

from datetime import datetime

from pydantic import BaseModel, Field


class CustomDatasetRead(BaseModel):
    """自定义数据集响应。"""

    id: int
    name: str
    dataset_type: str
    file_name: str
    file_format: str
    row_count: int
    description: str | None
    tags: list[str]
    created_at: datetime
    updated_at: datetime


class DatasetValidationPreview(BaseModel):
    """数据集上传校验预览。"""

    row_count: int = Field(..., description="样本数量")
    file_format: str = Field(..., description="json 或 jsonl")
