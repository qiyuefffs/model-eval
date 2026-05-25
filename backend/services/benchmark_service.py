"""EvalScope benchmark 元信息发现与过滤。"""

import importlib
from functools import lru_cache
from typing import Any

from api.schemas.benchmark import BenchmarkInfo

_FALLBACK_BENCHMARKS = [
    BenchmarkInfo(
        name="mmlu",
        display_name="MMLU",
        description="多学科英文知识与推理评测。",
        tags=["知识", "英文", "选择题"],
        backends=["Native", "OpenCompass"],
    ),
    BenchmarkInfo(
        name="ceval",
        display_name="C-Eval",
        description="中文综合考试评测，覆盖人文、社科、理工等科目。",
        tags=["知识", "中文", "选择题"],
        backends=["Native", "OpenCompass"],
    ),
    BenchmarkInfo(
        name="cmmlu",
        display_name="CMMLU",
        description="中文多任务语言理解评测。",
        tags=["知识", "中文", "选择题"],
        backends=["Native", "OpenCompass"],
    ),
    BenchmarkInfo(
        name="gsm8k",
        display_name="GSM8K",
        description="小学数学应用题推理评测。",
        tags=["数学", "推理", "英文"],
        backends=["Native"],
    ),
    BenchmarkInfo(
        name="math",
        display_name="MATH",
        description="竞赛级数学推理评测。",
        tags=["数学", "推理", "英文"],
        backends=["Native", "OpenCompass"],
    ),
    BenchmarkInfo(
        name="humaneval",
        display_name="HumanEval",
        description="Python 代码生成能力评测。",
        tags=["代码", "生成", "英文"],
        backends=["Native"],
    ),
    BenchmarkInfo(
        name="mbpp",
        display_name="MBPP",
        description="基础 Python 编程问题评测。",
        tags=["代码", "生成", "英文"],
        backends=["Native"],
    ),
    BenchmarkInfo(
        name="hellaswag",
        display_name="HellaSwag",
        description="常识推理与句子补全评测。",
        tags=["常识", "推理", "英文"],
        backends=["Native", "OpenCompass"],
    ),
    BenchmarkInfo(
        name="arc",
        display_name="ARC",
        description="AI2 科学问答推理评测。",
        tags=["科学", "推理", "英文"],
        backends=["Native", "OpenCompass"],
    ),
    BenchmarkInfo(
        name="truthfulqa",
        display_name="TruthfulQA",
        description="真实性与幻觉倾向评测。",
        tags=["安全", "事实性", "英文"],
        backends=["Native"],
    ),
    BenchmarkInfo(
        name="ifeval",
        display_name="IFEval",
        description="指令遵循能力评测。",
        tags=["指令遵循", "英文"],
        backends=["Native"],
    ),
    BenchmarkInfo(
        name="bbh",
        display_name="BBH",
        description="复杂任务与专家级推理评测。",
        tags=["推理", "英文"],
        backends=["Native", "OpenCompass"],
    ),
]


def _coerce_item(name: str, value: Any) -> BenchmarkInfo | None:
    """把 EvalScope 注册表里的 dict/object 尽量转换为统一 schema。"""
    if isinstance(value, str):
        return BenchmarkInfo(name=value, display_name=value.upper(), source="evalscope")

    if isinstance(value, dict):
        raw_name = str(value.get("name") or name)
        display_name = str(value.get("display_name") or value.get("displayName") or raw_name.upper())
        description = str(value.get("description") or value.get("desc") or "")
        tags = value.get("tags") or value.get("tag") or []
        backends = value.get("backends") or value.get("backend") or []
        subsets = value.get("subsets") or value.get("subset_list") or []
        eval_type = str(value.get("eval_type") or value.get("evalType") or "quality")
        return BenchmarkInfo(
            name=raw_name,
            display_name=display_name,
            description=description,
            tags=tags if isinstance(tags, list) else [str(tags)],
            backends=backends if isinstance(backends, list) else [str(backends)],
            subsets=[str(item) for item in subsets] if isinstance(subsets, list) else [],
            eval_type=eval_type,
            source="evalscope",
        )

    raw_name = str(getattr(value, "name", name))
    if raw_name.startswith("<"):
        return None

    tags = getattr(value, "tags", [])
    backends = getattr(value, "backends", [])
    subsets = getattr(value, "subset_list", [])
    return BenchmarkInfo(
        name=raw_name,
        display_name=str(getattr(value, "display_name", None) or getattr(value, "pretty_name", raw_name.upper())),
        description=str(getattr(value, "description", "")),
        tags=tags if isinstance(tags, list) else [str(tags)],
        backends=backends if isinstance(backends, list) else [str(backends)],
        subsets=[str(item) for item in subsets] if isinstance(subsets, list) else [],
        eval_type=str(getattr(value, "eval_type", "quality")),
        source="evalscope",
    )


def _discover_from_evalscope() -> list[BenchmarkInfo]:
    """优先从 EvalScope 常见注册表读取；失败时由调用方回退。"""
    candidates = [
        ("evalscope.benchmarks", ["BENCHMARKS", "DATASETS", "benchmark_registry"]),
        ("evalscope.benchmarks.registry", ["BENCHMARKS", "DATASETS", "registry"]),
        ("evalscope.registry", ["BENCHMARKS", "DATASETS", "benchmark_registry"]),
        ("evalscope.api.registry", ["BENCHMARK_REGISTRY"]),
        ("evalscope.constants", ["BENCHMARKS", "DATASETS"]),
    ]

    found: dict[str, BenchmarkInfo] = {}
    for module_name, attr_names in candidates:
        try:
            module = importlib.import_module(module_name)
        except Exception:
            continue

        for attr_name in attr_names:
            raw = getattr(module, attr_name, None)
            if raw is None:
                continue

            items = raw.items() if isinstance(raw, dict) else enumerate(raw) if isinstance(raw, list) else []
            for key, value in items:
                item = _coerce_item(str(key), value)
                if item is not None:
                    found[item.name] = item

    return sorted(found.values(), key=lambda item: item.name)


@lru_cache(maxsize=1)
def get_all_benchmarks() -> list[BenchmarkInfo]:
    """返回可用 benchmark 列表。"""
    discovered = _discover_from_evalscope()
    return discovered or _FALLBACK_BENCHMARKS


def list_benchmarks(
    *,
    keyword: str | None = None,
    tag: str | None = None,
    backend: str | None = None,
    eval_type: str | None = None,
) -> list[BenchmarkInfo]:
    """按关键字、标签、后端和评测类型过滤 benchmark。"""
    items = get_all_benchmarks()

    if keyword:
        q = keyword.strip().lower()
        items = [
            item
            for item in items
            if q in item.name.lower()
            or q in item.display_name.lower()
            or q in item.description.lower()
        ]

    if tag:
        q = tag.strip().lower()
        items = [item for item in items if any(q == t.lower() for t in item.tags)]

    if backend:
        q = backend.strip().lower()
        items = [item for item in items if any(q == b.lower() for b in item.backends)]

    if eval_type:
        q = eval_type.strip().lower()
        items = [item for item in items if item.eval_type.lower() == q]

    return items
