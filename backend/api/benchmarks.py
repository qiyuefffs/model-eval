"""内置 benchmark 查询 REST 路由。"""

from fastapi import APIRouter, Query

from api.schemas.benchmark import BenchmarkInfo
from services import benchmark_service

router = APIRouter(prefix="/api/benchmarks", tags=["benchmarks"])


@router.get(
    "",
    response_model=list[BenchmarkInfo],
    summary="内置 benchmark 列表",
    description="返回 EvalScope 内置 benchmark 元信息，支持关键字、标签、后端和评测类型过滤。",
)
async def list_benchmarks_endpoint(
    keyword: str | None = Query(default=None, description="按名称/展示名/说明模糊搜索"),
    tag: str | None = Query(default=None, description="按标签精确过滤"),
    backend: str | None = Query(default=None, description="按评测后端精确过滤"),
    eval_type: str | None = Query(default=None, description="按评测类型过滤，如 quality/perf"),
) -> list[BenchmarkInfo]:
    return benchmark_service.list_benchmarks(
        keyword=keyword,
        tag=tag,
        backend=backend,
        eval_type=eval_type,
    )
