#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RELEASE_DIR="$ROOT_DIR/release"
VERSION="${VERSION:-$(date +%Y%m%d%H%M%S)}"
ARCHIVE="$RELEASE_DIR/eval-platform-docker-$VERSION.tar.gz"

log() {
  printf '[EvalPlatform] %s\n' "$1"
}

command -v docker >/dev/null 2>&1 || {
  echo "缺少 docker 命令，请先安装 Docker。" >&2
  exit 1
}

mkdir -p "$RELEASE_DIR"

cd "$ROOT_DIR"

log "构建 Docker 镜像..."
docker compose build

log "导出镜像包：$ARCHIVE"
docker save eval-platform-backend:latest eval-platform-frontend:latest | gzip > "$ARCHIVE"

log "复制部署文件..."
cp docker-compose.yml "$RELEASE_DIR/docker-compose.yml"
cp .env.docker.example "$RELEASE_DIR/.env.example"
cp scripts/docker_manger.sh "$RELEASE_DIR/docker_manger.sh"
chmod +x "$RELEASE_DIR/docker_manger.sh"

cat > "$RELEASE_DIR/README-docker.md" <<'EOF'
# EvalPlatform Docker 部署包

## 首次部署

```bash
docker load -i eval-platform-docker-*.tar.gz
cp .env.example .env
./docker_manger.sh start
```

启动后访问：

- 前端：`http://localhost:${FRONTEND_PORT}`，默认 http://localhost:8080
- 后端 API：`http://localhost:${BACKEND_PORT}`，默认 http://localhost:8001
- API 文档：`http://localhost:${BACKEND_PORT}/docs`

## 常用命令

```bash
./docker_manger.sh start   # 启动服务并打开前端界面
./docker_manger.sh stop    # 停止服务但保留容器
docker compose ps          # 查看容器状态
docker compose logs -f     # 查看日志
```

数据会保存到当前目录的 `data/`，包括 SQLite、评测产物、自定义数据集和导出报告。
EOF

log "打包完成：$RELEASE_DIR"
