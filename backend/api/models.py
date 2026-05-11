"""模型管理 REST 路由 — /api/models/*"""

from fastapi import APIRouter, Depends, HTTPException, Path, status
from sqlalchemy.ext.asyncio import AsyncSession

from api.schemas.model import ConnectivityTestResult, ModelCreate, ModelRead
from db.database import get_session
from services import model_service
from services.connectivity import test_openai_compatible

router = APIRouter(prefix="/api/models", tags=["models"])


@router.post(
    "",
    response_model=ModelRead,
    status_code=status.HTTP_201_CREATED,
    summary="注册新模型",
    description="通过 URI + API Key 注册一个云端 OpenAI 兼容模型。API Key 会被加密存储。",
)
async def create_model_endpoint(
    payload: ModelCreate,
    session: AsyncSession = Depends(get_session),
) -> ModelRead:
    try:
        return await model_service.create_model(session, payload)
    except model_service.ModelAlreadyExistsError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e)) from e


@router.get(
    "",
    response_model=list[ModelRead],
    summary="模型列表",
    description="返回所有已注册模型，按创建时间倒序。API Key 仅返回脱敏预览。",
)
async def list_models_endpoint(session: AsyncSession = Depends(get_session)) -> list[ModelRead]:
    return await model_service.list_models(session)


@router.get(
    "/{model_pk}",
    response_model=ModelRead,
    summary="模型详情",
)
async def get_model_endpoint(
    model_pk: int = Path(..., ge=1, description="模型主键 id"),
    session: AsyncSession = Depends(get_session),
) -> ModelRead:
    try:
        return await model_service.get_model_read(session, model_pk)
    except model_service.ModelNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e


@router.delete(
    "/{model_pk}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="删除模型",
)
async def delete_model_endpoint(
    model_pk: int = Path(..., ge=1),
    session: AsyncSession = Depends(get_session),
) -> None:
    try:
        await model_service.delete_model(session, model_pk)
    except model_service.ModelNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e


@router.post(
    "/{model_pk}/test",
    response_model=ConnectivityTestResult,
    summary="测试模型连通性",
    description="对模型 endpoint 发一次最小 chat completion 请求验证可达性与鉴权。",
)
async def test_model_endpoint(
    model_pk: int = Path(..., ge=1),
    session: AsyncSession = Depends(get_session),
) -> ConnectivityTestResult:
    try:
        model, plain_key = await model_service.get_plain_api_key(session, model_pk)
    except model_service.ModelNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)) from e

    result = await test_openai_compatible(
        api_url=model.api_url,
        api_key=plain_key,
        model_id=model.model_id,
    )

    if result.ok:
        await model_service.touch_updated_at(session, model_pk)

    return result
