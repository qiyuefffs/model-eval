"""质量评测任务相关 schema。"""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator

EvalTaskStatus = Literal["pending", "running", "succeeded", "failed"]


class EvalTaskCreate(BaseModel):
    """创建质量评测任务的请求体。"""

    name: str = Field(..., min_length=1, max_length=160, description="任务名称")
    model_pk: int = Field(..., ge=1, description="模型主键 id")
    benchmark_names: list[str] = Field(default_factory=list, description="内置 benchmark 名称")
    custom_dataset_ids: list[int] = Field(default_factory=list, description="自定义数据集 id")
    eval_backend: str = Field(default="Native", max_length=80)
    eval_batch_size: int = Field(default=1, ge=1, le=64)
    limit: float | None = Field(default=None, gt=0, description="最大样本数或比例")
    generation_config: dict[str, Any] = Field(default_factory=dict, description="EvalScope 生成参数")
    dataset_args: dict[str, Any] = Field(default_factory=dict, description="附加 dataset_args")
    description: str | None = Field(default=None, max_length=2000)
    tags: list[str] = Field(default_factory=list, max_length=20)

    @model_validator(mode="after")
    def validate_dataset_selection(self) -> "EvalTaskCreate":
        if not self.benchmark_names and not self.custom_dataset_ids:
            raise ValueError("至少选择一个内置 benchmark 或自定义数据集")
        return self


class EvalResultRead(BaseModel):
    """评测结果摘要。"""

    id: int
    task_id: int
    dataset_name: str
    metric_name: str | None
    score: float | None
    metrics: dict[str, Any]
    created_at: datetime


class EvalTaskRead(BaseModel):
    """质量评测任务响应。"""

    id: int
    name: str
    model_pk: int
    model_name: str
    model_id: str
    status: EvalTaskStatus
    benchmark_names: list[str]
    custom_dataset_ids: list[int]
    dataset_args: dict[str, Any]
    generation_config: dict[str, Any]
    eval_backend: str
    eval_batch_size: int
    limit: float | None
    work_dir: str | None
    log_path: str | None
    result_summary: dict[str, Any] | None
    error_message: str | None
    description: str | None
    tags: list[str]
    created_at: datetime
    updated_at: datetime
    started_at: datetime | None
    finished_at: datetime | None
    results: list[EvalResultRead] = Field(default_factory=list)
