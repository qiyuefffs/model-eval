"""性能压测任务 REST 路由。"""

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from api.schemas.perf_task import PerfTaskCreate, PerfTaskRead
from db.database import get_session
from services import model_service, perf_task_service
from workers.perf_worker import enqueue_perf_task

router = APIRouter(prefix="/api/perf-tasks", tags=["perf-tasks"])


@router.post(
    "",
    response_model=PerfTaskRead,
    status_code=status.HTTP_201_CREATED,
    summary="创建性能压测任务",
    description="创建任务后加入独立性能压测队列，调用 EvalScope perf 执行 OpenAI 兼容接口压测。",
)
async def create_perf_task_endpoint(
    payload: PerfTaskCreate,
    session: AsyncSession = Depends(get_session),
) -> PerfTaskRead:
    try:
        task = await perf_task_service.create_perf_task(session, payload)
        await enqueue_perf_task(task.id)
        return task
    except model_service.ModelNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e
    except perf_task_service.PerfTaskValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


@router.get(
    "",
    response_model=list[PerfTaskRead],
    summary="性能压测任务列表",
)
async def list_perf_tasks_endpoint(
    status_filter: str | None = Query(default=None, alias="status", description="按任务状态过滤"),
    model_pk: int | None = Query(default=None, ge=1, description="按模型 id 过滤"),
    session: AsyncSession = Depends(get_session),
) -> list[PerfTaskRead]:
    return await perf_task_service.list_perf_tasks(
        session,
        status=status_filter,
        model_pk=model_pk,
    )


@router.get(
    "/{task_id}",
    response_model=PerfTaskRead,
    summary="性能压测任务详情",
)
async def get_perf_task_endpoint(
    task_id: int = Path(..., ge=1, description="性能压测任务 id"),
    session: AsyncSession = Depends(get_session),
) -> PerfTaskRead:
    try:
        return await perf_task_service.get_perf_task_read(session, task_id)
    except perf_task_service.PerfTaskNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e
