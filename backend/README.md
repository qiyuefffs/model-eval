# ModelGauge 后端

基于 FastAPI 的模型评估平台后端服务。

## 快速开始

```bash
# 安装依赖（首次）
uv sync

# 启动开发服务
uv run uvicorn main:app --reload --host 127.0.0.1 --port 8001
```

服务启动后：
- 接口文档：http://localhost:8001/docs
- ReDoc：http://localhost:8001/redoc
- OpenAPI Schema：http://localhost:8001/openapi.json

## 当前接口

- `GET /api/health`：健康检查。
- `GET /api/models` / `POST /api/models`：模型列表与注册。
- `POST /api/models/{model_pk}/test`：模型连通性测试。
- `GET /api/benchmarks`：内置 benchmark 查询与过滤。
- `GET /api/datasets` / `POST /api/datasets`：自定义数据集列表与上传。
- `DELETE /api/datasets/{dataset_pk}`：删除自定义数据集。
- `GET /api/eval-tasks` / `POST /api/eval-tasks`：质量评测任务列表与创建。
- `GET /api/eval-tasks/{task_id}`：质量评测任务详情与结果摘要。
- `GET /api/perf-tasks` / `POST /api/perf-tasks`：性能压测任务列表与创建。
- `GET /api/perf-tasks/{task_id}`：性能压测任务详情与指标摘要。
- `POST /api/reports/compare`：质量评测与性能压测聚合对比。
- `POST /api/reports/export`：导出 Markdown / HTML 报告到 `reports/`。

## 目录结构

```
backend/
├── main.py          应用入口
├── core/            核心配置（settings、database、security）
├── db/              SQLModel 表 + Alembic 迁移
├── api/             FastAPI 路由
├── services/        业务逻辑（eval_runner、perf_runner、result_parser）
└── workers/         异步任务执行器
```

## 常用命令

```bash
uv run pytest                    # 跑测试
uv run ruff check .              # lint
uv run ruff format .             # 格式化
uv run alembic revision --autogenerate -m "msg"  # 生成迁移
uv run alembic upgrade head      # 应用迁移
```
