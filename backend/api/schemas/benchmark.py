"""内置 benchmark 查询相关 schema。"""

from pydantic import BaseModel, Field


class BenchmarkInfo(BaseModel):
    """EvalScope 内置 benchmark 元信息。"""

    name: str = Field(..., description="EvalScope 数据集名称")
    display_name: str = Field(..., description="前端展示名")
    description: str = Field(default="", description="简要说明")
    tags: list[str] = Field(default_factory=list, description="领域标签")
    backends: list[str] = Field(default_factory=list, description="支持的评测后端")
    subsets: list[str] = Field(default_factory=list, description="可选子集名称；为空表示未暴露子集")
    eval_type: str = Field(default="quality", description="评测类型：quality/perf")
    source: str = Field(default="builtin", description="来源：evalscope/builtin")
