"""自定义数据集 REST 路由。"""

from fastapi import APIRouter, Depends, File, Form, HTTPException, Path, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from api.schemas.dataset import CustomDatasetRead
from db.database import get_session
from services import dataset_service

router = APIRouter(prefix="/api/datasets", tags=["datasets"])


@router.post(
    "",
    response_model=CustomDatasetRead,
    status_code=status.HTTP_201_CREATED,
    summary="上传自定义数据集",
    description="上传 JSON/JSONL 数据集，并按 general_qa/general_mcq/general_fc 做基础格式校验。",
)
async def create_dataset_endpoint(
    name: str = Form(..., min_length=1, max_length=120, description="数据集名称"),
    dataset_type: str = Form(..., description="general_qa/general_mcq/general_fc"),
    file: UploadFile = File(..., description="JSON 或 JSONL 文件"),
    description: str | None = Form(default=None, max_length=2000),
    tags: str | None = Form(default=None, description="逗号分隔标签"),
    session: AsyncSession = Depends(get_session),
) -> CustomDatasetRead:
    filename = file.filename or ""
    content = await file.read()
    try:
        return await dataset_service.create_dataset(
            session,
            name=name,
            dataset_type=dataset_type,
            filename=filename,
            content=content,
            description=description,
            raw_tags=tags,
        )
    except dataset_service.DatasetValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    except dataset_service.DatasetAlreadyExistsError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e)) from e


@router.get(
    "",
    response_model=list[CustomDatasetRead],
    summary="自定义数据集列表",
)
async def list_datasets_endpoint(
    dataset_type: str | None = Query(default=None, description="按数据集类型过滤"),
    tag: str | None = Query(default=None, description="按标签过滤"),
    session: AsyncSession = Depends(get_session),
) -> list[CustomDatasetRead]:
    return await dataset_service.list_datasets(session, dataset_type=dataset_type, tag=tag)


@router.delete(
    "/{dataset_pk}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="删除自定义数据集",
)
async def delete_dataset_endpoint(
    dataset_pk: int = Path(..., ge=1, description="数据集主键 id"),
    session: AsyncSession = Depends(get_session),
) -> None:
    try:
        await dataset_service.delete_dataset(session, dataset_pk)
    except dataset_service.DatasetNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e
