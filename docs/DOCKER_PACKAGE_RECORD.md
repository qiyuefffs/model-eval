# EvalPlatform Docker 打包操作记录

> 记录时间：2026-05-22  
> 打包方式：Docker Compose + 离线镜像包  
> 目标：将前端、后端、EvalScope 运行环境和部署配置一起打包，目标机器安装 Docker 后即可启动使用。

---

## 1. 本次新增配置

### Docker 构建文件

- `Dockerfile.backend`
  - 基础镜像：`python:3.12-slim`
  - 使用 `uv sync --frozen --no-dev` 安装后端依赖。
  - 启动命令：`uvicorn main:app --host 0.0.0.0 --port 8001`
  - 封装 FastAPI、SQLModel、EvalScope 等后端运行环境。

- `Dockerfile.frontend`
  - 构建阶段基础镜像：`node:20-alpine`
  - 固定 `pnpm@9.15.9`，避免 Node 20 下 Corepack 拉取 pnpm 11 导致构建失败。
  - 运行阶段基础镜像：`nginx:1.27-alpine`
  - 将 `frontend/dist` 静态资源复制到 Nginx。

- `docker/nginx.conf`
  - 提供前端静态资源。
  - 将 `/api/`、`/docs`、`/openapi.json`、`/redoc` 反向代理到后端容器 `backend:8001`。

### Docker Compose

- `docker-compose.yml`
  - `backend` 服务：
    - 镜像名：`eval-platform-backend:latest`
    - 宿主机默认端口：`8001`
    - 容器端口：`8001`
    - 持久化目录：`./data:/data`
    - 数据库：`sqlite+aiosqlite:////data/platform.db`
    - 健康检查：`/api/health`
  - `frontend` 服务：
    - 镜像名：`eval-platform-frontend:latest`
    - 宿主机默认端口：`8080`
    - 容器端口：`80`
    - 等待后端健康后启动。

### 打包脚本

- `scripts/package-docker.sh`
  - 执行 `docker compose build`
  - 执行 `docker save eval-platform-backend:latest eval-platform-frontend:latest | gzip`
  - 输出离线镜像包到 `release/`
  - 复制 `docker-compose.yml`、`.env.example`、`README-docker.md`、`docker_manger.sh` 到 `release/`

- `scripts/docker_manger.sh`
  - 部署包内一键启动 / 停止脚本。
  - `./docker_manger.sh start`：首次创建容器并打开前端界面，后续直接启动已有容器。
  - `./docker_manger.sh stop`：只停止容器，不删除容器，保留二次启动速度。

### 入口命令

- `Makefile`
  - `make docker-up`：构建并启动 Docker Compose
  - `make docker-down`：停止 Docker Compose
  - `make docker-package`：构建并导出离线镜像包

---

## 2. 本次打包执行命令

在项目根目录执行：

```bash
make docker-package
```

实际展开命令：

```bash
bash scripts/package-docker.sh
```

脚本执行流程：

```bash
docker compose build
docker save eval-platform-backend:latest eval-platform-frontend:latest | gzip > release/eval-platform-docker-<版本>.tar.gz
cp docker-compose.yml release/docker-compose.yml
cp .env.docker.example release/.env.example
```

---

## 3. 本次构建结果

终端输出显示：

```text
[EvalPlatform] 构建 Docker 镜像...
[+] build 2/2
✔ Image eval-platform-frontend:latest Built
✔ Image eval-platform-backend:latest  Built
[EvalPlatform] 导出镜像包：/home/hywl/xiangmu/vllm-skills-agent/eval-platform/release/eval-platform-docker-20260522101004.tar.gz
[EvalPlatform] 复制部署文件...
[EvalPlatform] 打包完成：/home/hywl/xiangmu/vllm-skills-agent/eval-platform/release
```

本次生成文件：

```text
release/
├── docker-compose.yml
├── eval-platform-docker-20260522101004.tar.gz
└── README-docker.md
```

文件大小：

```text
eval-platform-docker-20260522101004.tar.gz    490M
```

镜像大小：

```text
eval-platform-backend:latest     1.44GB
eval-platform-frontend:latest    63.9MB
```

---

## 4. 已完成验证

### Compose 配置验证

```bash
docker compose config
```

结果：

```text
compose config ok
```

### 镜像构建验证

```bash
docker compose build
```

结果：

```text
Image eval-platform-backend:latest Built
Image eval-platform-frontend:latest Built
```

### 临时端口冒烟测试

为避免和本机开发服务端口冲突，使用临时端口启动：

```bash
FRONTEND_PORT=18080 BACKEND_PORT=18001 docker compose up -d
```

验证项：

```bash
curl -fsS http://127.0.0.1:18001/api/health
curl -fsS -I http://127.0.0.1:18080/
curl -fsS http://127.0.0.1:18080/api/health
```

验证结果：

- 后端 `/api/health` 正常返回 `status=ok`
- 前端首页返回 `HTTP/1.1 200 OK`
- Nginx 反代 `/api/health` 正常返回 `status=ok`

测试后已停止容器：

```bash
FRONTEND_PORT=18080 BACKEND_PORT=18001 docker compose down
```

---

## 5. 目标机器部署步骤

将 `release/` 目录中的文件复制到目标机器同一目录下：

```text
eval-platform-docker-20260522101004.tar.gz
docker-compose.yml
docker_manger.sh
README-docker.md
.env.example
```

目标机器执行：

```bash
docker load -i eval-platform-docker-20260522101004.tar.gz
cp .env.example .env
./docker_manger.sh start
```

启动后访问：

```text
前端：http://localhost:${FRONTEND_PORT}，默认 http://localhost:8080
后端 API：http://localhost:${BACKEND_PORT}，默认 http://localhost:8001
API 文档：http://localhost:${BACKEND_PORT}/docs
```

查看日志：

```bash
docker compose logs -f
```

停止服务：

```bash
./docker_manger.sh stop
```

---

## 6. 数据持久化说明

Docker Compose 会在部署目录下创建：

```text
data/
├── platform.db
├── outputs/
├── reports/
└── custom_datasets/
```

这些数据不会写入镜像，容器重建后仍会保留。

注意：

- `data/platform.db` 是 SQLite 数据库。
- `data/outputs` 保存 EvalScope 评测产物。
- `data/reports` 保存 Markdown / HTML 导出报告。
- `data/custom_datasets` 保存上传的数据集文件。

---

## 7. 注意事项

1. 目标机器需要安装 Docker 和 Docker Compose。
2. 首次启动前建议复制 `.env.example` 为 `.env`，并修改 `SECRET_KEY`。
3. `SECRET_KEY` 变更后，历史已加密 API Key 可能无法解密；生产环境应固定使用同一个密钥。
4. 如果宿主机 `8080` 或 `8001` 被占用，可在 `.env` 中修改：

```env
FRONTEND_PORT=18080
BACKEND_PORT=18001
```

5. 当前 Docker 包不包含本机已有的 `platform.db` 和历史评测产物；这些属于运行数据，应通过 `data/` 独立迁移。
6. 如需离线交付，只需要交付 `release/` 下的镜像包、Compose 文件和说明文件。

---

## 8. 本次修复过的问题

构建前端镜像时曾出现：

```text
This version of pnpm requires at least Node.js v22.13
Error [ERR_UNKNOWN_BUILTIN_MODULE]: No such built-in module: node:sqlite
```

原因：

- `node:20-alpine` 中 Corepack 默认拉取了最新版 `pnpm 11`。
- `pnpm 11` 依赖 Node 22 的 `node:sqlite`。

处理：

```dockerfile
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
```

固定 pnpm 版本后，Docker 镜像构建成功。
