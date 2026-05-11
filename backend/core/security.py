"""安全工具 — API key 对称加密。

使用 Fernet (AES-128-CBC + HMAC-SHA256)。
主密钥 SECRET_KEY 允许任意字符串：通过 SHA256 → base64url 转为合法 Fernet key，
开发期可直接用 dev 密钥；生产环境务必通过 .env 覆盖为强密钥。
"""

import base64
import hashlib
from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken

from .config import get_settings


@lru_cache(maxsize=1)
def _get_fernet() -> Fernet:
    """根据配置中的 SECRET_KEY 派生 Fernet 实例。"""
    secret = get_settings().secret_key.encode("utf-8")
    # 任意长度 SECRET_KEY → SHA256 摘要 → urlsafe-base64 → Fernet key（32 字节）
    digest = hashlib.sha256(secret).digest()
    fernet_key = base64.urlsafe_b64encode(digest)
    return Fernet(fernet_key)


def encrypt_secret(plaintext: str) -> str:
    """加密敏感字符串（如 API key），返回 base64url 字符串。"""
    if not plaintext:
        return ""
    token = _get_fernet().encrypt(plaintext.encode("utf-8"))
    return token.decode("utf-8")


def decrypt_secret(ciphertext: str) -> str:
    """解密。若密文损坏 / 主密钥不匹配则抛 ValueError。"""
    if not ciphertext:
        return ""
    try:
        plain = _get_fernet().decrypt(ciphertext.encode("utf-8"))
    except InvalidToken as e:
        raise ValueError("解密失败：密文损坏或 SECRET_KEY 已变更") from e
    return plain.decode("utf-8")


def mask_secret(plaintext: str, prefix: int = 4, suffix: int = 4) -> str:
    """返回脱敏后的展示值，如 sk-abc...xyz9。"""
    if not plaintext:
        return ""
    if len(plaintext) <= prefix + suffix:
        return "*" * len(plaintext)
    return f"{plaintext[:prefix]}...{plaintext[-suffix:]}"
