"""报告对比与导出 REST 路由。"""

from typing import Literal

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from api.schemas.report import (
    ReportCompareRequest,
    ReportCompareResponse,
    ReportExportRequest,
    ReportExportResponse,
    ReportTaskListResponse,
)
from db.database import get_session
from services import report_service

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get(
    "/tasks",
    response_model=ReportTaskListResponse,
    summary="报告任务候选列表",
    description="返回报告页可选择的已完成质量评测或性能压测任务。",
)
async def list_report_tasks_endpoint(
    task_type: Literal["eval", "perf"] = Query(..., description="任务类型"),
    keyword: str | None = Query(default=None, description="按任务名或模型搜索"),
    limit: int = Query(default=50, ge=1, le=200, description="返回数量"),
    session: AsyncSession = Depends(get_session),
) -> ReportTaskListResponse:
    return await report_service.list_report_tasks(
        session,
        task_type=task_type,
        keyword=keyword,
        limit=limit,
    )


@router.post(
    "/compare",
    response_model=ReportCompareResponse,
    summary="报告对比",
    description="聚合质量评测与性能压测结果，返回前端图表所需摘要。",
)
async def compare_reports_endpoint(
    payload: ReportCompareRequest,
    session: AsyncSession = Depends(get_session),
) -> ReportCompareResponse:
    return await report_service.compare_reports(session, payload)


@router.post(
    "/export",
    response_model=ReportExportResponse,
    status_code=status.HTTP_201_CREATED,
    summary="导出报告",
    description="生成 Markdown 或 HTML 报告并保存到 reports 目录。",
)
async def export_report_endpoint(
    payload: ReportExportRequest,
    session: AsyncSession = Depends(get_session),
) -> ReportExportResponse:
    return await report_service.export_report(session, payload)
