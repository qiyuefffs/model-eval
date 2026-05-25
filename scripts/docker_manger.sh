#!/usr/bin/env bash
set -Eeuo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$DEPLOY_DIR/.env"
ENV_EXAMPLE_FILE="$DEPLOY_DIR/.env.example"

log() {
  printf '[EvalPlatform] %s\n' "$1"
}

usage() {
  cat <<'EOF'
用法：
  ./docker_manger.sh start    启动服务并打开前端界面
  ./docker_manger.sh stop     停止服务但保留容器
EOF
}

ensure_docker() {
  command -v docker >/dev/null 2>&1 || {
    echo "缺少 docker 命令，请先安装 Docker。" >&2
    exit 1
  }

  docker compose version >/dev/null 2>&1 || {
    echo "当前 Docker 不支持 docker compose，请先安装 Docker Compose。" >&2
    exit 1
  }
}

ensure_env() {
  if [[ -f "$ENV_FILE" ]]; then
    return
  fi

  if [[ -f "$ENV_EXAMPLE_FILE" ]]; then
    cp "$ENV_EXAMPLE_FILE" "$ENV_FILE"
    log "未发现 .env，已从 .env.example 创建。"
    return
  fi

  echo "缺少 .env 或 .env.example，无法读取端口配置。" >&2
  exit 1
}

load_env() {
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a

  FRONTEND_PORT="${FRONTEND_PORT:-8080}"
  BACKEND_PORT="${BACKEND_PORT:-8001}"
}

compose() {
  docker compose --project-directory "$DEPLOY_DIR" "$@"
}

containers_exist() {
  [[ -n "$(compose ps -a -q backend)" && -n "$(compose ps -a -q frontend)" ]]
}

wait_for_url() {
  local url="$1"
  local name="$2"

  if ! command -v curl >/dev/null 2>&1; then
    log "未找到 curl，跳过就绪检查。"
    return 0
  fi

  for _ in $(seq 1 60); do
    if curl -fsS -o /dev/null "$url" >/dev/null 2>&1; then
      log "$name 已就绪：$url"
      return 0
    fi
    sleep 1
  done

  echo "$name 启动超时，请执行 docker compose logs -f 查看日志。" >&2
  return 1
}

open_browser() {
  local url="$1"

  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$url" >/dev/null 2>&1 &
    return
  fi

  if command -v gio >/dev/null 2>&1; then
    gio open "$url" >/dev/null 2>&1 &
    return
  fi

  if command -v sensible-browser >/dev/null 2>&1; then
    sensible-browser "$url" >/dev/null 2>&1 &
    return
  fi

  log "未找到可用浏览器打开命令，请手动访问：$url"
}

start_services() {
  ensure_docker
  ensure_env
  load_env

  cd "$DEPLOY_DIR"

  if containers_exist; then
    log "检测到已有容器，直接启动已有容器..."
    if ! compose start; then
      echo "启动已有容器失败，请检查端口是否被占用：FRONTEND_PORT=$FRONTEND_PORT BACKEND_PORT=$BACKEND_PORT" >&2
      exit 1
    fi
  else
    log "未检测到容器，首次创建并启动容器..."
    if ! compose up -d; then
      echo "创建容器失败，请检查端口是否被占用：FRONTEND_PORT=$FRONTEND_PORT BACKEND_PORT=$BACKEND_PORT" >&2
      exit 1
    fi
  fi

  compose ps

  local frontend_url="http://localhost:${FRONTEND_PORT}"
  local backend_url="http://localhost:${BACKEND_PORT}/docs"

  wait_for_url "http://127.0.0.1:${FRONTEND_PORT}/" "前端界面"

  log "正在打开前端界面：$frontend_url"
  open_browser "$frontend_url"
  log "后端 API 文档：$backend_url"
}

stop_services() {
  ensure_docker
  cd "$DEPLOY_DIR"

  log "停止服务，保留容器以便下次快速启动..."
  compose stop
  log "已停止。下次执行 ./docker_manger.sh start 会直接启动已有容器。"
}

case "${1:-}" in
  start)
    start_services
    ;;
  stop)
    stop_services
    ;;
  -h|--help|help|"")
    usage
    ;;
  *)
    usage
    exit 1
    ;;
esac
