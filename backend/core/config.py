"""应用配置 — 基于 pydantic-settings，支持 .env 文件与环境变量覆盖。"""

from functools import lru_cache
from pathlib import Path

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent

DEFAULT_SECRET_KEY = "dev-secret-key-please-change-in-production-32bytes"


class Settings(BaseSettings):
    """全局应用配置。"""

    model_config = SettingsConfigDict(
        env_file=PROJECT_ROOT / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # === 应用基础 ===
    app_name: str = "ModelGauge"
    app_version: str = "0.1.0"
    debug: bool = Field(default=True, description="调试模式：开启后日志更详细、CORS 放开")
    log_level: str = "INFO"

    # === 服务端口 ===
    host: str = "0.0.0.0"
    port: int = 8001

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
    # 开发期沿用默认值即可；生产（debug=False）必须通过 .env 覆盖，否则启动直接报错
    # （默认值是公开的，等同明文存储 API key；见下方 _check_secret_key）
    secret_key: str = Field(
        default=DEFAULT_SECRET_KEY,
        description="Fernet 主密钥（任意字符串，内部 SHA256 派生）；用于加密模型 API key",
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

    @model_validator(mode="after")
    def _check_secret_key(self) -> "Settings":
        """生产环境（debug=False）禁止沿用公开的默认密钥。"""
        if not self.debug and (not self.secret_key or self.secret_key == DEFAULT_SECRET_KEY):
            raise ValueError(
                "生产环境必须在 .env 设置自定义 SECRET_KEY（当前为默认值或空）。"
                "默认密钥是公开的，会导致已加密的模型 API key 等同明文。"
            )
        return self

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
