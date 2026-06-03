.PHONY: help install install-backend install-frontend dev dev-backend dev-frontend docker-secret docker-build docker-up docker-down docker-package gen-api clean test lint format

# 默认目标：打印帮助
help:
	@echo "ModelGauge Makefile 速查表"
	@echo ""
	@echo "  make install          一键安装前后端依赖"
	@echo "  make install-backend  仅安装后端 Python 依赖（uv）"
	@echo "  make install-frontend 仅安装前端依赖（pnpm）"
	@echo ""
	@echo "  make dev              一键启动前后端（推荐开发用）"
	@echo "  make dev-backend      仅启动后端 uvicorn http://localhost:8001"
	@echo "  make dev-frontend     仅启动前端 Vite     http://localhost:5173"
	@echo "  make docker-up        Docker Compose 一键启动 http://localhost:8080"
	@echo "  make docker-down      停止 Docker Compose 服务"
	@echo "  make docker-package   构建并导出 Docker 离线镜像包"
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
	bash scripts/start-dev.sh

dev-backend:
	cd backend && WATCHFILES_FORCE_POLLING=true uv run uvicorn main:app --reload --host 127.0.0.1 --port 8001

dev-frontend:
	cd frontend && CHOKIDAR_USEPOLLING=true pnpm dev

docker-secret:
	@if [ ! -f .env ]; then \
		printf 'SECRET_KEY=%s\n' "$$(openssl rand -hex 32 2>/dev/null || python3 -c 'import secrets;print(secrets.token_hex(32))')" > .env; \
		echo "[ModelGauge] 已生成根目录 .env（含随机 SECRET_KEY），供 docker compose 使用。"; \
	fi

docker-build:
	docker compose build

docker-up: docker-secret
	docker compose up -d --build

docker-down:
	docker compose down

docker-package:
	bash scripts/package-docker.sh

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
