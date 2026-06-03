"""质量评测异步队列 worker。"""

import asyncio

from loguru import logger

from db.database import session_scope
from services import eval_task_service

_queue: asyncio.Queue[int] | None = None
_worker_task: asyncio.Task | None = None


async def _worker_loop() -> None:
    assert _queue is not None
    logger.info("质量评测 worker 已启动")
    while True:
        task_id = await _queue.get()
        try:
            logger.info(f"开始执行质量评测任务：#{task_id}")
            await eval_task_service.run_eval_task(task_id)
            logger.info(f"质量评测任务完成：#{task_id}")
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.exception(f"质量评测任务失败：#{task_id}")
            # 标记失败本身也可能抛错（如 DB 抖动）；内层兜底，绝不让单任务异常拖垮整条队列。
            try:
                async with session_scope() as session:
                    await eval_task_service.mark_task_failed(session, task_id, str(e))
            except Exception:
                logger.exception(f"标记质量评测任务失败状态时再次出错：#{task_id}")
        finally:
            _queue.task_done()


async def start_eval_worker() -> None:
    """启动 worker，并恢复 pending/running 任务。"""
    global _queue, _worker_task
    if _worker_task and not _worker_task.done():
        return

    _queue = asyncio.Queue()
    async with session_scope() as session:
        task_ids = await eval_task_service.list_runnable_task_ids(session)
    for task_id in task_ids:
        await _queue.put(task_id)

    _worker_task = asyncio.create_task(_worker_loop(), name="eval-worker")
    logger.info(f"已恢复 {len(task_ids)} 个待执行质量评测任务")


async def stop_eval_worker() -> None:
    """停止 worker。"""
    global _worker_task
    if _worker_task is None:
        return
    _worker_task.cancel()
    try:
        await _worker_task
    except asyncio.CancelledError:
        logger.info("质量评测 worker 已停止")
    _worker_task = None


async def enqueue_eval_task(task_id: int) -> None:
    """把任务加入质量评测队列。"""
    if _queue is None:
        raise RuntimeError("质量评测 worker 尚未启动")
    await _queue.put(task_id)
