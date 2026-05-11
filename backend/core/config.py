"""应用配置 — 基于 pydantic-settings，支持 .env 文件与环境变量覆盖。"""

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    """全局应用配置。"""

    model_config = SettingsConfigDict(
        env_file=PROJECT_ROOT / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # === 应用基础 ===
    app_name: str = "EvalPlatform"
    app_version: str = "0.1.0"
    debug: bool = Field(default=True, description="调试模式：开启后日志更详细、CORS 放开")
    log_level: str = "INFO"

    # === 服务端口 ===
    host: str = "0.0.0.0"
    port: int = 8000

    # === 数据库 ===
    database_url: str = Field(
        default=f"sqlite+aiosqlite:///{PROJECT_ROOT / 'platform.db'}",
        description="数据库连接串；默认 SQLite，后期可换 PostgreSQL",
    )

    # === 评测产物根目录 ===
    outputs_dir: Path = Field(default=PROJECT_ROOT / "outputs")
    reports_dir: Path = Field(default=PROJECT_ROOT / "reports")
    custom_datasets_dir: Path = Field(default=PROJECT_ROOT / "custom_datasets")

    # === 安全：API key 对称加密主密钥 ===
    # 生产环境务必通过 .env 覆盖；为空时启动报错（保护历史 key 不被新密钥误解密）
    secret_key: str = Field(
        default="dev-secret-key-please-change-in-production-32bytes",
        description="Fernet 主密钥，32 字节 base64url；用于加密模型 API key",
    )

    # === CORS ===
    cors_origins: list[str] = Field(
        default=[
            "http://localhost:5173",
            "http://localhost:3000",
            "http://127.0.0.1:5173",
        ]
    )

    # === 评测任务并发 ===
    eval_worker_concurrency: int = Field(default=1, description="质量评测队列并发数")
    perf_worker_concurrency: int = Field(default=1, description="性能压测队列并发数")

    def ensure_dirs(self) -> None:
        """确保所有目录存在。"""
        for d in (self.outputs_dir, self.reports_dir, self.custom_datasets_dir):
            d.mkdir(parents=True, exist_ok=True)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """获取全局单例配置。"""
    settings = Settings()
    settings.ensure_dirs()
    return settings
