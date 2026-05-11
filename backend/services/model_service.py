"""模型管理业务层 — 与 DB 交互，处理加密 / 唯一性 / 转换。"""

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from api.schemas.model import ModelCreate, ModelRead
from core.security import decrypt_secret, encrypt_secret, mask_secret
from db.models import Model


class ModelAlreadyExistsError(Exception):
    """同名模型已存在。"""


class ModelNotFoundError(Exception):
    """模型不存在。"""


def _to_read(model: Model, plain_key: str | None = None) -> ModelRead:
    """ORM 对象转出参 schema，自动脱敏。"""
    if plain_key is None:
        try:
            plain_key = decrypt_secret(model.api_key_encrypted)
        except ValueError:
            plain_key = ""
    return ModelRead(
        id=model.id,  # type: ignore[arg-type]
        name=model.name,
        model_id=model.model_id,
        api_url=model.api_url,
        api_key_preview=mask_secret(plain_key),
        description=model.description,
        tags=model.tags or [],
        created_at=model.created_at,
        updated_at=model.updated_at,
    )


async def create_model(session: AsyncSession, payload: ModelCreate) -> ModelRead:
    """创建模型。"""
    encrypted = encrypt_secret(payload.api_key)
    obj = Model(
        name=payload.name.strip(),
        model_id=payload.model_id.strip(),
        api_url=str(payload.api_url),
        api_key_encrypted=encrypted,
        description=payload.description,
        tags=payload.tags or [],
    )
    session.add(obj)
    try:
        await session.commit()
    except IntegrityError as e:
        await session.rollback()
        raise ModelAlreadyExistsError(f"模型名 '{payload.name}' 已存在") from e
    await session.refresh(obj)
    return _to_read(obj, plain_key=payload.api_key)


async def list_models(session: AsyncSession) -> list[ModelRead]:
    """列出全部模型（按创建时间倒序）。"""
    stmt = select(Model).order_by(Model.created_at.desc())
    result = await session.execute(stmt)
    objs = result.scalars().all()
    return [_to_read(o) for o in objs]


async def get_model(session: AsyncSession, model_pk: int) -> Model:
    """获取 ORM 对象（service 内部使用）。"""
    obj = await session.get(Model, model_pk)
    if obj is None:
        raise ModelNotFoundError(f"模型 id={model_pk} 不存在")
    return obj


async def get_model_read(session: AsyncSession, model_pk: int) -> ModelRead:
    """获取出参 schema。"""
    obj = await get_model(session, model_pk)
    return _to_read(obj)


async def delete_model(session: AsyncSession, model_pk: int) -> None:
    """删除模型。"""
    obj = await get_model(session, model_pk)
    await session.delete(obj)
    await session.commit()


async def get_plain_api_key(session: AsyncSession, model_pk: int) -> tuple[Model, str]:
    """内部使用：取出模型对象与明文 key（用于连通性测试 / 评测调用）。"""
    obj = await get_model(session, model_pk)
    try:
        plain_key = decrypt_secret(obj.api_key_encrypted)
    except ValueError as e:
        raise ValueError(
            f"模型 '{obj.name}' 的 API key 无法解密，可能是 SECRET_KEY 已变更"
        ) from e
    return obj, plain_key


async def touch_updated_at(session: AsyncSession, model_pk: int) -> None:
    """刷新 updated_at（成功测试连通性后调用）。"""
    obj = await get_model(session, model_pk)
    obj.updated_at = datetime.now(UTC)
    await session.commit()
