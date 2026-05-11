"""连通性测试 — 用 httpx 对 OpenAI 兼容端点发一次轻量 ping。

策略：发一条最小 chat completion 请求（max_tokens=1），观察 HTTP 状态与延迟。
- 200：完全成功
- 401/403：URL 正确但 key 不对（仍视为"端点可达"，但标记 ok=False）
- 4xx 其它：参数错误（视情况）
- 5xx / 超时：服务端故障
"""

import time

import httpx
from loguru import logger

from api.schemas.model import ConnectivityTestResult

_DEFAULT_TIMEOUT = httpx.Timeout(connect=10.0, read=15.0, write=10.0, pool=10.0)


async def test_openai_compatible(
    api_url: str,
    api_key: str,
    model_id: str,
    timeout: httpx.Timeout | None = None,
) -> ConnectivityTestResult:
    """对 OpenAI 兼容端点做一次最小 chat completion 探活。"""
    payload = {
        "model": model_id,
        "messages": [{"role": "user", "content": "ping"}],
        "max_tokens": 1,
        "temperature": 0.0,
        "stream": False,
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    started = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=timeout or _DEFAULT_TIMEOUT) as client:
            resp = await client.post(api_url, json=payload, headers=headers)
        elapsed_ms = round((time.perf_counter() - started) * 1000, 2)

        if resp.status_code == 200:
            # 取 choices[0].message.content 前 60 字预览
            preview = "OK"
            try:
                data = resp.json()
                content = data["choices"][0]["message"].get("content", "") or ""
                preview = (content[:60] + "...") if len(content) > 60 else content or "OK"
            except Exception:  # noqa: BLE001
                preview = "OK (响应体解析略过)"
            return ConnectivityTestResult(
                ok=True,
                latency_ms=elapsed_ms,
                http_status=200,
                detail=f"连通成功，模型响应: {preview!r}",
            )

        # 状态码非 200，端点可达但调用失败
        try:
            err_detail = resp.json().get("error", {}).get("message") or resp.text[:200]
        except Exception:  # noqa: BLE001
            err_detail = resp.text[:200]

        return ConnectivityTestResult(
            ok=False,
            latency_ms=elapsed_ms,
            http_status=resp.status_code,
            detail=f"HTTP {resp.status_code}: {err_detail}",
        )

    except httpx.TimeoutException:
        elapsed_ms = round((time.perf_counter() - started) * 1000, 2)
        return ConnectivityTestResult(
            ok=False,
            latency_ms=elapsed_ms,
            http_status=None,
            detail="请求超时（默认 15s 读取超时）",
        )
    except httpx.ConnectError as e:
        return ConnectivityTestResult(
            ok=False,
            latency_ms=None,
            http_status=None,
            detail=f"连接失败：{e}",
        )
    except Exception as e:  # noqa: BLE001
        logger.exception("连通性测试异常")
        return ConnectivityTestResult(
            ok=False,
            latency_ms=None,
            http_status=None,
            detail=f"未预期错误：{type(e).__name__}: {e}",
        )
