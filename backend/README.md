# EvalPlatform 后端

基于 FastAPI 的模型评估平台后端服务。

## 快速开始

```bash
# 安装依赖（首次）
uv sync

# 启动开发服务
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后：
- 接口文档：http://localhost:8000/docs
- ReDoc：http://localhost:8000/redoc
- OpenAPI Schema：http://localhost:8000/openapi.json

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
