"""质量评测任务 REST 路由。"""

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from api.schemas.eval_task import EvalTaskCreate, EvalTaskRead
from db.database import get_session
from services import eval_task_service, model_service
from workers.eval_worker import enqueue_eval_task

router = APIRouter(prefix="/api/eval-tasks", tags=["eval-tasks"])


@router.post(
    "",
    response_model=EvalTaskRead,
    status_code=status.HTTP_201_CREATED,
    summary="创建质量评测任务",
    description="创建任务后立即加入后台队列，由 eval worker 调用 EvalScope Python API 执行。",
)
async def create_eval_task_endpoint(
    payload: EvalTaskCreate,
    session: AsyncSession = Depends(get_session),
) -> EvalTaskRead:
    try:
        task = await eval_task_service.create_eval_task(session, payload)
        await enqueue_eval_task(task.id)
        return task
    except model_service.ModelNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e
    except eval_task_service.EvalTaskValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


@router.get(
    "",
    response_model=list[EvalTaskRead],
    summary="质量评测任务列表",
)
async def list_eval_tasks_endpoint(
    status_filter: str | None = Query(default=None, alias="status", description="按任务状态过滤"),
    model_pk: int | None = Query(default=None, ge=1, description="按模型 id 过滤"),
    session: AsyncSession = Depends(get_session),
) -> list[EvalTaskRead]:
    return await eval_task_service.list_eval_tasks(
        session,
        status=status_filter,
        model_pk=model_pk,
    )


@router.get(
    "/{task_id}",
    response_model=EvalTaskRead,
    summary="质量评测任务详情",
)
async def get_eval_task_endpoint(
    task_id: int = Path(..., ge=1, description="评测任务 id"),
    session: AsyncSession = Depends(get_session),
) -> EvalTaskRead:
    try:
        return await eval_task_service.get_eval_task_read(session, task_id)
    except eval_task_service.EvalTaskNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e


@router.delete(
    "/{task_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="删除质量评测任务",
)
async def delete_eval_task_endpoint(
    task_id: int = Path(..., ge=1, description="评测任务 id"),
    session: AsyncSession = Depends(get_session),
) -> None:
    try:
        await eval_task_service.delete_eval_task(session, task_id)
    except eval_task_service.EvalTaskNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e
