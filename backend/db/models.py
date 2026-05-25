"""数据库表定义 — SQLModel 同时充当 ORM 模型与 Pydantic 校验。

Task / EvalResult / PerfResult 将在阶段 6/8 加入。
"""

from datetime import UTC, datetime

from sqlalchemy import JSON, Column, Float, String, Text
from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(UTC)


class Model(SQLModel, table=True):
    """已注册的模型（仅云端 API 形态）。

    通过 URI + API Key 注册，所有评测/压测从此表选择目标。
    """

    __tablename__ = "models"

    id: int | None = Field(default=None, primary_key=True)

    name: str = Field(
        sa_column=Column(String(120), unique=True, nullable=False, index=True),
        description="显示名（用户自定义，全表唯一）",
    )

    model_id: str = Field(
        sa_column=Column(String(200), nullable=False),
        description="平台侧模型 ID，例如 deepseek-chat / qwen-plus",
    )

    api_url: str = Field(
        sa_column=Column(String(500), nullable=False),
        description="OpenAI 兼容的 chat completions 端点 URL",
    )

    api_key_encrypted: str = Field(
        sa_column=Column(Text, nullable=False),
        description="Fernet 加密后的 API key，不向前端明文返回",
    )

    description: str | None = Field(
        default=None,
        sa_column=Column(Text, nullable=True),
        description="备注信息",
    )

    tags: list[str] = Field(
        default_factory=list,
        sa_column=Column(JSON, nullable=False, default=list),
        description="标签：如 ['云端', '中文', '推理']",
    )

    created_at: datetime = Field(default_factory=_utcnow, nullable=False)
    updated_at: datetime = Field(default_factory=_utcnow, nullable=False)


class CustomDataset(SQLModel, table=True):
    """用户上传的自定义评测数据集。"""

    __tablename__ = "custom_datasets"

    id: int | None = Field(default=None, primary_key=True)

    name: str = Field(
        sa_column=Column(String(120), unique=True, nullable=False, index=True),
        description="数据集名称，全表唯一",
    )

    dataset_type: str = Field(
        sa_column=Column(String(40), nullable=False, index=True),
        description="EvalScope general_* 数据集类型",
    )

    file_name: str = Field(
        sa_column=Column(String(255), nullable=False),
        description="原始上传文件名",
    )

    file_path: str = Field(
        sa_column=Column(String(1000), nullable=False),
        description="服务端保存路径",
    )

    file_format: str = Field(
        sa_column=Column(String(20), nullable=False),
        description="json 或 jsonl",
    )

    row_count: int = Field(default=0, nullable=False, description="样本数量")

    description: str | None = Field(
        default=None,
        sa_column=Column(Text, nullable=True),
        description="备注信息",
    )

    tags: list[str] = Field(
        default_factory=list,
        sa_column=Column(JSON, nullable=False, default=list),
        description="标签",
    )

    created_at: datetime = Field(default_factory=_utcnow, nullable=False)
    updated_at: datetime = Field(default_factory=_utcnow, nullable=False)


class EvalTask(SQLModel, table=True):
    """质量评测任务。"""

    __tablename__ = "eval_tasks"

    id: int | None = Field(default=None, primary_key=True)

    name: str = Field(
        sa_column=Column(String(160), nullable=False, index=True),
        description="评测任务名称",
    )

    model_pk: int = Field(nullable=False, index=True, description="关联 models.id")
    model_name: str = Field(sa_column=Column(String(120), nullable=False), description="模型名称快照")
    model_id: str = Field(sa_column=Column(String(200), nullable=False), description="模型 ID 快照")

    status: str = Field(
        default="pending",
        sa_column=Column(String(30), nullable=False, index=True),
        description="pending/running/succeeded/failed",
    )

    benchmark_names: list[str] = Field(
        default_factory=list,
        sa_column=Column(JSON, nullable=False, default=list),
        description="EvalScope 内置 benchmark 名称",
    )

    custom_dataset_ids: list[int] = Field(
        default_factory=list,
        sa_column=Column(JSON, nullable=False, default=list),
        description="自定义数据集 id 列表",
    )

    dataset_args: dict = Field(
        default_factory=dict,
        sa_column=Column(JSON, nullable=False, default=dict),
        description="传给 EvalScope 的 dataset_args",
    )

    generation_config: dict = Field(
        default_factory=dict,
        sa_column=Column(JSON, nullable=False, default=dict),
        description="生成参数",
    )

    eval_backend: str = Field(default="Native", sa_column=Column(String(80), nullable=False))
    eval_batch_size: int = Field(default=1, nullable=False)
    limit: float | None = Field(default=None, sa_column=Column(Float, nullable=True))

    work_dir: str | None = Field(default=None, sa_column=Column(String(1000), nullable=True))
    log_path: str | None = Field(default=None, sa_column=Column(String(1000), nullable=True))
    result_summary: dict | None = Field(default=None, sa_column=Column(JSON, nullable=True))
    error_message: str | None = Field(default=None, sa_column=Column(Text, nullable=True))

    description: str | None = Field(default=None, sa_column=Column(Text, nullable=True))
    tags: list[str] = Field(default_factory=list, sa_column=Column(JSON, nullable=False, default=list))

    created_at: datetime = Field(default_factory=_utcnow, nullable=False)
    updated_at: datetime = Field(default_factory=_utcnow, nullable=False)
    started_at: datetime | None = Field(default=None, nullable=True)
    finished_at: datetime | None = Field(default=None, nullable=True)


class EvalResult(SQLModel, table=True):
    """质量评测结果摘要。"""

    __tablename__ = "eval_results"

    id: int | None = Field(default=None, primary_key=True)
    task_id: int = Field(nullable=False, index=True, description="关联 eval_tasks.id")

    dataset_name: str = Field(sa_column=Column(String(160), nullable=False, index=True))
    metric_name: str | None = Field(default=None, sa_column=Column(String(120), nullable=True))
    score: float | None = Field(default=None, sa_column=Column(Float, nullable=True))
    metrics: dict = Field(default_factory=dict, sa_column=Column(JSON, nullable=False, default=dict))

    created_at: datetime = Field(default_factory=_utcnow, nullable=False)


class PerfTask(SQLModel, table=True):
    """性能压测任务。"""

    __tablename__ = "perf_tasks"

    id: int | None = Field(default=None, primary_key=True)

    name: str = Field(sa_column=Column(String(160), nullable=False, index=True))
    model_pk: int = Field(nullable=False, index=True, description="关联 models.id")
    model_name: str = Field(sa_column=Column(String(120), nullable=False), description="模型名称快照")
    model_id: str = Field(sa_column=Column(String(200), nullable=False), description="模型 ID 快照")

    status: str = Field(
        default="pending",
        sa_column=Column(String(30), nullable=False, index=True),
        description="pending/running/succeeded/failed",
    )

    request_count: int = Field(default=100, nullable=False)
    concurrency: int = Field(default=1, nullable=False)
    rate: float = Field(default=-1.0, nullable=False, description="-1 表示 closed-loop 不限速")
    perf_dataset: str = Field(
        default="prompt",
        sa_column=Column(String(60), nullable=False, default="prompt"),
        description="prompt/openqa/custom",
    )
    custom_dataset_id: int | None = Field(default=None, nullable=True)
    dataset_path: str | None = Field(default=None, sa_column=Column(String(1000), nullable=True))
    prompt: str = Field(sa_column=Column(Text, nullable=False), description="压测提示词")
    max_tokens: int = Field(default=1024, nullable=False)
    temperature: float = Field(default=0.0, nullable=False)
    stream: bool = Field(default=True, nullable=False)
    connect_timeout: int | None = Field(default=None, nullable=True)
    read_timeout: int | None = Field(default=None, nullable=True)
    total_timeout: int | None = Field(default=21600, nullable=True)

    work_dir: str | None = Field(default=None, sa_column=Column(String(1000), nullable=True))
    log_path: str | None = Field(default=None, sa_column=Column(String(1000), nullable=True))
    result_summary: dict | None = Field(default=None, sa_column=Column(JSON, nullable=True))
    percentile_summary: dict | None = Field(default=None, sa_column=Column(JSON, nullable=True))
    error_message: str | None = Field(default=None, sa_column=Column(Text, nullable=True))

    description: str | None = Field(default=None, sa_column=Column(Text, nullable=True))
    tags: list[str] = Field(default_factory=list, sa_column=Column(JSON, nullable=False, default=list))

    created_at: datetime = Field(default_factory=_utcnow, nullable=False)
    updated_at: datetime = Field(default_factory=_utcnow, nullable=False)
    started_at: datetime | None = Field(default=None, nullable=True)
    finished_at: datetime | None = Field(default=None, nullable=True)


class PerfResult(SQLModel, table=True):
    """性能压测结果摘要。"""

    __tablename__ = "perf_results"

    id: int | None = Field(default=None, primary_key=True)
    task_id: int = Field(nullable=False, index=True, description="关联 perf_tasks.id")

    total_requests: int = Field(default=0, nullable=False)
    succeed_requests: int = Field(default=0, nullable=False)
    failed_requests: int = Field(default=0, nullable=False)
    request_throughput: float | None = Field(default=None, sa_column=Column(Float, nullable=True))
    output_token_throughput: float | None = Field(default=None, sa_column=Column(Float, nullable=True))
    total_token_throughput: float | None = Field(default=None, sa_column=Column(Float, nullable=True))
    avg_latency: float | None = Field(default=None, sa_column=Column(Float, nullable=True))
    avg_ttft: float | None = Field(default=None, sa_column=Column(Float, nullable=True))
    avg_tpot: float | None = Field(default=None, sa_column=Column(Float, nullable=True))
    success_rate: float | None = Field(default=None, sa_column=Column(Float, nullable=True))
    metrics: dict = Field(default_factory=dict, sa_column=Column(JSON, nullable=False, default=dict))
    percentiles: dict = Field(default_factory=dict, sa_column=Column(JSON, nullable=False, default=dict))

    created_at: datetime = Field(default_factory=_utcnow, nullable=False)
