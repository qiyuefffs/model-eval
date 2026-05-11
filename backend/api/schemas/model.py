"""模型管理相关的请求 / 响应 schema。

入参与出参分离：
- 入参允许写 api_key（明文）
- 出参一律不返回 api_key 明文，只返回脱敏值 api_key_preview
"""

from datetime import datetime

from pydantic import BaseModel, Field, HttpUrl


class ModelCreate(BaseModel):
    """注册新模型的请求体。"""

    name: str = Field(..., min_length=1, max_length=120, description="显示名，全表唯一")
    model_id: str = Field(
        ..., min_length=1, max_length=200, description="平台侧模型 ID，如 deepseek-chat"
    )
    api_url: HttpUrl = Field(..., description="OpenAI 兼容的 chat completions 端点 URL")
    api_key: str = Field(..., min_length=1, description="API Key，存储时会加密")
    description: str | None = Field(default=None, max_length=2000)
    tags: list[str] = Field(default_factory=list, max_length=20)


class ModelRead(BaseModel):
    """模型详情响应（出参，不含明文 key）。"""

    id: int
    name: str
    model_id: str
    api_url: str
    api_key_preview: str = Field(..., description="脱敏后的 API key，如 sk-a...xyz9")
    description: str | None
    tags: list[str]
    created_at: datetime
    updated_at: datetime


class ConnectivityTestResult(BaseModel):
    """连通性测试结果。"""

    ok: bool = Field(..., description="连通性测试是否通过")
    latency_ms: float | None = Field(None, description="单次请求耗时（毫秒）")
    http_status: int | None = Field(None, description="HTTP 状态码")
    detail: str = Field(..., description="详细信息：成功时为 'OK' 或返回内容片段，失败时为错误描述")
