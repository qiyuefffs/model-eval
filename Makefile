.PHONY: help install install-backend install-frontend dev dev-backend dev-frontend gen-api clean test lint format

# 默认目标：打印帮助
help:
	@echo "EvalPlatform Makefile 速查表"
	@echo ""
	@echo "  make install          一键安装前后端依赖"
	@echo "  make install-backend  仅安装后端 Python 依赖（uv）"
	@echo "  make install-frontend 仅安装前端依赖（pnpm）"
	@echo ""
	@echo "  make dev              并行启动前后端（推荐开发用）"
	@echo "  make dev-backend      仅启动后端 uvicorn http://localhost:8000"
	@echo "  make dev-frontend     仅启动前端 Vite     http://localhost:5173"
	@echo ""
	@echo "  make gen-api          后端 OpenAPI -> 前端 TS 类型"
	@echo "  make lint             代码风格检查（ruff + eslint）"
	@echo "  make format           代码格式化（ruff format + prettier）"
	@echo "  make test             跑单元测试"
	@echo "  make clean            清理缓存与构建产物"

install: install-backend install-frontend

install-backend:
	cd backend && uv sync

install-frontend:
	cd frontend && pnpm install

dev:
	@echo "并行启动前后端，Ctrl+C 一起退出"
	@trap 'kill 0' INT; \
		(cd backend && uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000) & \
		(cd frontend && pnpm dev) & \
		wait

dev-backend:
	cd backend && uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000

dev-frontend:
	cd frontend && pnpm dev

gen-api:
	@echo "确保后端已启动，正在拉取 OpenAPI schema..."
	cd frontend && pnpm gen:api

lint:
	cd backend && uv run ruff check .
	cd frontend && pnpm lint

format:
	cd backend && uv run ruff format .
	cd frontend && pnpm format

test:
	cd backend && uv run pytest

clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .ruff_cache -exec rm -rf {} + 2>/dev/null || true
	rm -rf backend/.venv frontend/node_modules frontend/dist
