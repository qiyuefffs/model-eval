"""报告对比与导出相关 schema。"""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

ReportTaskType = Literal["eval", "perf"]


class ReportTaskOption(BaseModel):
    """报告页左侧可选择任务。"""

    task_type: ReportTaskType
    task_id: int
    task_name: str
    model_name: str
    model_id: str
    status: str
    primary_metric: float | None = None
    primary_metric_name: str | None = None
    created_at: datetime
    finished_at: datetime | None = None


class ReportTaskListResponse(BaseModel):
    """报告任务候选列表响应。"""

    task_type: ReportTaskType
    tasks: list[ReportTaskOption]


class ReportCompareRequest(BaseModel):
    """报告对比请求。"""

    task_type: ReportTaskType = Field(description="报告类型：质量评测或性能压测")
    task_ids: list[int] = Field(default_factory=list, max_length=8, description="选择的任务 id，最多 8 个")


class ReportTaskSummary(BaseModel):
    """选中任务摘要。"""

    task_type: ReportTaskType
    task_id: int
    task_name: str
    model_name: str
    model_id: str
    created_at: datetime
    finished_at: datetime | None = None
    primary_metric: float | None = None
    primary_metric_name: str | None = None


class EvalDatasetScore(BaseModel):
    """质量评测数据集分数。"""

    task_id: int
    task_name: str
    model_name: str
    dataset_name: str
    metric_name: str | None = None
    score: float | None = None
    metrics: dict[str, Any] = Field(default_factory=dict)


class EvalScoreMatrixRow(BaseModel):
    """质量评测矩阵行。"""

    task_id: int
    task_name: str
    model_name: str
    scores: dict[str, float | None] = Field(default_factory=dict)


class PerfMetricRow(BaseModel):
    """性能压测核心指标。"""

    task_id: int
    task_name: str
    model_name: str
    total_requests: int
    succeed_requests: int
    failed_requests: int
    success_rate: float | None = None
    request_throughput: float | None = None
    total_token_throughput: float | None = None
    avg_latency: float | None = None
    avg_ttft: float | None = None
    avg_tpot: float | None = None
    concurrency: int | None = None
    max_tokens: int | None = None
    metrics: dict[str, Any] = Field(default_factory=dict)
    detailed_metrics: dict[str, Any] = Field(default_factory=dict)


class PerfPercentileRow(BaseModel):
    """性能压测 percentile 行。"""

    task_id: int
    task_name: str
    model_name: str
    percentile: str
    latency: float | None = None
    ttft: float | None = None
    tpot: float | None = None
    output_throughput: float | None = None
    total_throughput: float | None = None


class ReportTrendPoint(BaseModel):
    """趋势图数据点。"""

    task_type: ReportTaskType
    task_id: int
    model_name: str
    metric_name: str
    metric_value: float
    created_at: datetime


class ReportCompareResponse(BaseModel):
    """报告对比响应。"""

    task_type: ReportTaskType
    generated_at: datetime
    tasks: list[ReportTaskSummary]
    eval_dataset_scores: list[EvalDatasetScore] = Field(default_factory=list)
    eval_matrix: list[EvalScoreMatrixRow] = Field(default_factory=list)
    perf_metrics: list[PerfMetricRow] = Field(default_factory=list)
    perf_percentiles: list[PerfPercentileRow] = Field(default_factory=list)
    trends: list[ReportTrendPoint] = Field(default_factory=list)


class ReportExportRequest(ReportCompareRequest):
    """报告导出请求。"""

    format: Literal["markdown", "html"] = "markdown"


class ReportExportResponse(BaseModel):
    """报告导出响应。"""

    format: Literal["markdown", "html"]
    file_path: str
    content: str
    generated_at: datetime
