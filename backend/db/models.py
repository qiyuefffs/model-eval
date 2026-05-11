"""数据库表定义 — SQLModel 同时充当 ORM 模型与 Pydantic 校验。

阶段 1 只引入 Model 表（模型注册）。Task / EvalResult / PerfResult 将在阶段 6/8 加入。
"""

from datetime import UTC, datetime

from sqlalchemy import JSON, Column, String, Text
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
