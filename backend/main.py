"""FastAPI 应用入口。"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse
from loguru import logger

from api.health import router as health_router
from api.models import router as models_router
from core.config import get_settings
from core.logger import setup_logging
from db.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用启动与关闭生命周期钩子。"""
    setup_logging()
    settings = get_settings()
    logger.info(f"启动 {settings.app_name} v{settings.app_version}")
    logger.info(f"数据库：{settings.database_url}")
    logger.info(f"产物目录：{settings.outputs_dir}")
    logger.info(f"调试模式：{settings.debug}")

    await init_db()

    # TODO 阶段 6：启动 eval/perf worker

    yield

    logger.info(f"关闭 {settings.app_name}")


def create_app() -> FastAPI:
    """工厂函数：构造 FastAPI 应用。"""
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description="基于 EvalScope 的模型评估平台 — 质量评测、性能压测、历史对比",
        default_response_class=ORJSONResponse,
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health_router)
    app.include_router(models_router)

    @app.get("/", tags=["root"], summary="根路径")
    async def root() -> dict:
        return {
            "name": settings.app_name,
            "version": settings.app_version,
            "docs": "/docs",
            "health": "/api/health",
        }

    return app


app = create_app()
