"""数据库连接 — 异步 SQLAlchemy/SQLModel engine + session 工厂。"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from loguru import logger
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlmodel import SQLModel

from core.config import get_settings

_settings = get_settings()

# 异步 engine — SQLite 用 aiosqlite，PostgreSQL 用 asyncpg
async_engine = create_async_engine(
    _settings.database_url,
    echo=False,  # 调试时改 True 看 SQL
    future=True,
    # SQLite 单文件并发限制：每连接独立线程，避免锁竞争
    connect_args={"check_same_thread": False} if "sqlite" in _settings.database_url else {},
)

# session 工厂
async_session_factory = async_sessionmaker(
    async_engine,
    class_=AsyncSession,
    expire_on_commit=False,  # 防止 commit 后访问对象属性触发额外查询
    autoflush=False,
)


async def init_db() -> None:
    """启动时建表 — 开发期使用，后续上 alembic 迁移后移除。"""
    # 触发 SQLModel 注册所有表的元数据
    from db import models  # noqa: F401

    async with async_engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
        if "sqlite" in _settings.database_url:
            await _ensure_sqlite_dev_columns(conn)
    logger.info(f"数据库初始化完成：{_settings.database_url}")


async def _ensure_sqlite_dev_columns(conn) -> None:
    """开发期轻量补列，避免 create_all 不修改既有 SQLite 表结构。"""
    result = await conn.execute(text("PRAGMA table_info(perf_tasks)"))
    columns = {row[1] for row in result.fetchall()}
    migrations = {
        "perf_dataset": "ALTER TABLE perf_tasks ADD COLUMN perf_dataset VARCHAR(60) NOT NULL DEFAULT 'prompt'",
        "custom_dataset_id": "ALTER TABLE perf_tasks ADD COLUMN custom_dataset_id INTEGER",
        "dataset_path": "ALTER TABLE perf_tasks ADD COLUMN dataset_path VARCHAR(1000)",
    }
    for column, ddl in migrations.items():
        if column not in columns:
            await conn.execute(text(ddl))
            logger.info(f"SQLite 开发库补列完成：perf_tasks.{column}")


@asynccontextmanager
async def session_scope() -> AsyncIterator[AsyncSession]:
    """脚本/worker 用的 session 上下文管理器（FastAPI 依赖注入用 get_session）。"""
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def get_session() -> AsyncIterator[AsyncSession]:
    """FastAPI 依赖项 — 每个请求一个 session。"""
    async with async_session_factory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
