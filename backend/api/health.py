"""健康检查接口。"""

from datetime import UTC, datetime

from fastapi import APIRouter
from pydantic import BaseModel

from core.config import get_settings

router = APIRouter(prefix="/api", tags=["health"])


class HealthResponse(BaseModel):
    status: str
    app_name: str
    version: str
    timestamp: str


@router.get("/health", response_model=HealthResponse, summary="健康检查")
async def health_check() -> HealthResponse:
    """返回服务健康状态，前端用此判断后端是否在线。"""
    settings = get_settings()
    return HealthResponse(
        status="ok",
        app_name=settings.app_name,
        version=settings.app_version,
        timestamp=datetime.now(UTC).isoformat(),
    )
