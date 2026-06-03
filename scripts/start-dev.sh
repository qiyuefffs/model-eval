#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
BACKEND_HOST="${BACKEND_HOST:-127.0.0.1}"
BACKEND_PORT="${BACKEND_PORT:-8001}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
AUTO_KILL_OLD="${AUTO_KILL_OLD:-1}"
MAX_PORT_OFFSET="${MAX_PORT_OFFSET:-20}"
DEV_WATCH_POLLING="${DEV_WATCH_POLLING:-1}"

BACKEND_PID=""
FRONTEND_PID=""

log() {
  printf '[ModelGauge] %s\n' "$1" >&2
}

die() {
  printf '[ModelGauge] 启动失败：%s\n' "$1" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "缺少命令：$1"
}

port_in_use() {
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    ss -ltn "sport = :$port" | awk 'NR > 1 { found = 1 } END { exit found ? 0 : 1 }'
    return
  fi
  if command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
    return
  fi
  return 1
}

port_pids() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null | sort -u
    return
  fi
  if command -v fuser >/dev/null 2>&1; then
    fuser "$port/tcp" 2>/dev/null | tr ' ' '\n' | awk 'NF' | sort -u
    return
  fi
  if command -v ss >/dev/null 2>&1; then
    ss -ltnp "sport = :$port" 2>/dev/null \
      | sed -n 's/.*pid=\([0-9]\+\).*/\1/p' \
      | sort -u
    return
  fi
}

pid_command() {
  local pid="$1"
  ps -p "$pid" -o args= 2>/dev/null || true
}

pid_cwd() {
  local pid="$1"
  readlink "/proc/$pid/cwd" 2>/dev/null || true
}

is_old_backend() {
  local pid="$1"
  local cmd="$2"
  local cwd
  cwd="$(pid_cwd "$pid")"
  [[ "$cwd" == "$BACKEND_DIR" && "$cmd" == *"uvicorn main:app"* ]] \
    || [[ "$cmd" == *"$BACKEND_DIR"* && "$cmd" == *"uvicorn main:app"* ]] \
    || [[ "$cmd" == *"uvicorn main:app"* && "$cmd" == *"--port $BACKEND_PORT"* ]]
}

is_old_frontend() {
  local pid="$1"
  local cmd="$2"
  local cwd
  cwd="$(pid_cwd "$pid")"
  [[ "$cwd" == "$FRONTEND_DIR" && "$cmd" == *"vite"* ]] \
    || [[ "$cmd" == *"$FRONTEND_DIR"* && "$cmd" == *"vite"* ]] \
    || [[ "$cmd" == *"modelgauge-frontend"* && "$cmd" == *"vite"* ]]
}

kill_process_tree() {
  local pid="$1"
  local child
  for child in $(pgrep -P "$pid" 2>/dev/null || true); do
    kill_process_tree "$child"
  done
  kill "$pid" >/dev/null 2>&1 || true
}

stop_pids() {
  local label="$1"
  shift
  local pids=("$@")
  [[ "${#pids[@]}" -gt 0 ]] || return 0

  log "发现旧${label}服务，正在停止：${pids[*]}"
  kill "${pids[@]}" >/dev/null 2>&1 || true

  for _ in $(seq 1 20); do
    local alive=0
    for pid in "${pids[@]}"; do
      if kill -0 "$pid" >/dev/null 2>&1; then
        alive=1
      fi
    done
    [[ "$alive" -eq 0 ]] && return 0
    sleep 0.2
  done

  log "旧${label}服务未正常退出，强制停止：${pids[*]}"
  kill -9 "${pids[@]}" >/dev/null 2>&1 || true
}

try_stop_old_service() {
  local label="$1"
  local port="$2"
  local matcher="$3"
  mapfile -t pids < <(port_pids "$port")
  [[ "${#pids[@]}" -gt 0 ]] || return 1

  local matched=()
  for pid in "${pids[@]}"; do
    local cmd
    cmd="$(pid_command "$pid")"
    if "$matcher" "$pid" "$cmd"; then
      matched+=("$pid")
    fi
  done

  if [[ "${#matched[@]}" -gt 0 && "$AUTO_KILL_OLD" == "1" ]]; then
    stop_pids "$label" "${matched[@]}"
    return 0
  fi

  return 1
}

resolve_port() {
  local label="$1"
  local desired="$2"
  local matcher="$3"
  local port="$desired"

  if port_in_use "$port"; then
    try_stop_old_service "$label" "$port" "$matcher" || true
  fi

  if ! port_in_use "$port"; then
    printf '%s\n' "$port"
    return 0
  fi

  log "${label}端口 $port 仍被其他进程占用，自动寻找可用端口"
  for offset in $(seq 1 "$MAX_PORT_OFFSET"); do
    port=$((desired + offset))
    if ! port_in_use "$port"; then
      log "${label}改用端口：$port"
      printf '%s\n' "$port"
      return 0
    fi
  done

  die "${label}未找到可用端口，已尝试 $desired-$((desired + MAX_PORT_OFFSET))"
}

wait_for_http() {
  local url="$1"
  local name="$2"
  local retry="${3:-40}"

  for _ in $(seq 1 "$retry"); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      log "$name 已就绪：$url"
      return 0
    fi
    sleep 0.5
  done

  die "$name 启动超时：$url"
}

cleanup() {
  log "正在停止服务..."
  if [[ -n "$FRONTEND_PID" ]] && kill -0 "$FRONTEND_PID" >/dev/null 2>&1; then
    kill_process_tree "$FRONTEND_PID"
  fi
  if [[ -n "$BACKEND_PID" ]] && kill -0 "$BACKEND_PID" >/dev/null 2>&1; then
    kill_process_tree "$BACKEND_PID"
  fi
}

trap cleanup EXIT INT TERM

require_cmd uv
require_cmd pnpm
require_cmd curl

[[ -d "$BACKEND_DIR" ]] || die "找不到后端目录：$BACKEND_DIR"
[[ -d "$FRONTEND_DIR" ]] || die "找不到前端目录：$FRONTEND_DIR"

BACKEND_PORT="$(resolve_port "后端" "$BACKEND_PORT" is_old_backend)"
FRONTEND_PORT="$(resolve_port "前端" "$FRONTEND_PORT" is_old_frontend)"

log "启动后端：http://$BACKEND_HOST:$BACKEND_PORT"
(
  cd "$BACKEND_DIR"
  if [[ "$DEV_WATCH_POLLING" == "1" ]]; then
    export WATCHFILES_FORCE_POLLING=true
  fi
  uv run uvicorn main:app --reload --host "$BACKEND_HOST" --port "$BACKEND_PORT"
) &
BACKEND_PID="$!"

wait_for_http "http://$BACKEND_HOST:$BACKEND_PORT/api/health" "后端"

log "启动前端：http://localhost:$FRONTEND_PORT"
(
  cd "$FRONTEND_DIR"
  if [[ "$DEV_WATCH_POLLING" == "1" ]]; then
    export CHOKIDAR_USEPOLLING=true
  fi
  MODELGAUGE_BACKEND_URL="http://$BACKEND_HOST:$BACKEND_PORT" pnpm dev --host 0.0.0.0 --port "$FRONTEND_PORT"
) &
FRONTEND_PID="$!"

wait_for_http "http://127.0.0.1:$FRONTEND_PORT/" "前端"

cat <<EOF

ModelGauge 已启动
- 前端地址：http://localhost:$FRONTEND_PORT
- 后端地址：http://$BACKEND_HOST:$BACKEND_PORT
- API 文档：http://$BACKEND_HOST:$BACKEND_PORT/docs

按 Ctrl+C 停止前后端服务。
EOF

wait "$BACKEND_PID" "$FRONTEND_PID"
