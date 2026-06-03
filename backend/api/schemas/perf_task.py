"""性能压测任务相关 schema。"""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

PerfTaskStatus = Literal["pending", "running", "succeeded", "failed"]


class PerfTaskCreate(BaseModel):
    """创建性能压测任务的请求体。"""

    name: str = Field(..., min_length=1, max_length=160, description="任务名称")
    model_pk: int = Field(..., ge=1, description="模型主键 id")
    request_count: int = Field(default=100, ge=1, le=100000, description="请求总数")
    concurrency: int = Field(default=1, ge=1, le=4096, description="并发数")
    rate: float = Field(default=-1.0, description="-1 表示 closed-loop 不限速")
    perf_dataset: Literal["prompt", "openqa", "custom"] = Field(default="prompt", description="压测数据源")
    custom_dataset_id: int | None = Field(default=None, ge=1, description="自定义数据集 id")
    prompt: str = Field(default="你好，请用一句话介绍自己。", min_length=1, max_length=8000)
    max_tokens: int = Field(default=1024, ge=1, le=20000)
    temperature: float = Field(default=0.0, ge=0.0, le=2.0)
    stream: bool = Field(default=True)
    connect_timeout: int | None = Field(default=None, ge=1)
    read_timeout: int | None = Field(default=None, ge=1)
    total_timeout: int | None = Field(default=21600, ge=1)
    metrics_url: str | None = Field(
        default=None,
        max_length=1000,
        description="vLLM Prometheus /metrics 地址；留空时根据模型 API URL 自动推断",
    )
    description: str | None = Field(default=None, max_length=2000)
    tags: list[str] = Field(default_factory=list, max_length=20)


class PerfResultRead(BaseModel):
    """性能压测结果摘要。"""

    id: int
    task_id: int
    total_requests: int
    succeed_requests: int
    failed_requests: int
    request_throughput: float | None
    output_token_throughput: float | None
    total_token_throughput: float | None
    avg_latency: float | None
    avg_ttft: float | None
    avg_tpot: float | None
    success_rate: float | None
    metrics: dict[str, Any]
    percentiles: dict[str, Any]
    detailed_metrics: dict[str, Any]
    created_at: datetime


class PerfTaskRead(BaseModel):
    """性能压测任务响应。"""

    id: int
    name: str
    model_pk: int
    model_name: str
    model_id: str
    status: PerfTaskStatus
    request_count: int
    concurrency: int
    rate: float
    perf_dataset: str
    custom_dataset_id: int | None
    dataset_path: str | None
    prompt: str
    max_tokens: int
    temperature: float
    stream: bool
    connect_timeout: int | None
    read_timeout: int | None
    total_timeout: int | None
    metrics_url: str | None
    work_dir: str | None
    log_path: str | None
    result_summary: dict[str, Any] | None
    percentile_summary: dict[str, Any] | None
    error_message: str | None
    description: str | None
    tags: list[str]
    created_at: datetime
    updated_at: datetime
    started_at: datetime | None
    finished_at: datetime | None
    result: PerfResultRead | None = None
