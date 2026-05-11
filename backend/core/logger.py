"""日志配置 — 基于 loguru，统一替换 uvicorn 与 stdlib logging。"""

import logging
import sys

from loguru import logger

from .config import get_settings


class InterceptHandler(logging.Handler):
    """将 stdlib logging 重定向到 loguru。"""

    def emit(self, record: logging.LogRecord) -> None:
        try:
            level = logger.level(record.levelname).name
        except ValueError:
            level = record.levelno

        frame, depth = logging.currentframe(), 2
        while frame and frame.f_code.co_filename == logging.__file__:
            frame = frame.f_back
            depth += 1

        logger.opt(depth=depth, exception=record.exc_info).log(level, record.getMessage())


def setup_logging() -> None:
    """初始化日志：移除默认 handler、添加彩色控制台 + 文件输出、接管 uvicorn。"""
    settings = get_settings()

    logger.remove()

    fmt = (
        "<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | "
        "<level>{level:<7}</level> | "
        "<cyan>{name}:{function}:{line}</cyan> - <level>{message}</level>"
    )

    logger.add(
        sys.stdout,
        level=settings.log_level,
        format=fmt,
        colorize=True,
        backtrace=settings.debug,
        diagnose=settings.debug,
    )

    log_file = settings.outputs_dir.parent / "logs" / "backend_{time:YYYY-MM-DD}.log"
    log_file.parent.mkdir(parents=True, exist_ok=True)
    logger.add(
        log_file,
        level="INFO",
        format=fmt,
        rotation="00:00",
        retention="30 days",
        encoding="utf-8",
    )

    logging.basicConfig(handlers=[InterceptHandler()], level=0, force=True)
    for name in ("uvicorn", "uvicorn.access", "uvicorn.error", "fastapi"):
        logging.getLogger(name).handlers = [InterceptHandler()]
        logging.getLogger(name).propagate = False
