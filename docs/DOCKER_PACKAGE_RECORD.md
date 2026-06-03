# ModelGauge Docker 打包操作记录

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
    - 镜像名：`modelgauge-backend:latest`
    - 宿主机默认端口：`8001`
    - 容器端口：`8001`
    - 持久化目录：`./data:/data`
    - 数据库：`sqlite+aiosqlite:////data/platform.db`
    - 健康检查：`/api/health`
  - `frontend` 服务：
    - 镜像名：`modelgauge-frontend:latest`
    - 宿主机默认端口：`8080`
    - 容器端口：`80`
    - 等待后端健康后启动。

### 打包脚本

- `scripts/package-docker.sh`
  - 执行 `docker compose build`
  - 执行 `docker save modelgauge-backend:latest modelgauge-frontend:latest | gzip`
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
docker save modelgauge-backend:latest modelgauge-frontend:latest | gzip > release/modelgauge-docker-<版本>.tar.gz
cp docker-compose.yml release/docker-compose.yml
cp .env.docker.example release/.env.example
```

---

## 3. 本次构建结果

终端输出显示：

```text
[ModelGauge] 构建 Docker 镜像...
[+] build 2/2
✔ Image modelgauge-frontend:latest Built
✔ Image modelgauge-backend:latest  Built
[ModelGauge] 导出镜像包：/path/to/modelgauge/release/modelgauge-docker-20260522101004.tar.gz
[ModelGauge] 复制部署文件...
[ModelGauge] 打包完成：/path/to/modelgauge/release
```

本次生成文件：

```text
release/
├── docker-compose.yml
├── modelgauge-docker-20260522101004.tar.gz
└── README-docker.md
```

文件大小：

```text
modelgauge-docker-20260522101004.tar.gz    490M
```

镜像大小：

```text
modelgauge-backend:latest     1.44GB
modelgauge-frontend:latest    63.9MB
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
Image modelgauge-backend:latest Built
Image modelgauge-frontend:latest Built
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
modelgauge-docker-20260522101004.tar.gz
docker-compose.yml
docker_manger.sh
README-docker.md
.env.example
```

目标机器执行：

```bash
docker load -i modelgauge-docker-20260522101004.tar.gz
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

---

## 更新记录（2026-06）

本轮迭代涉及 Docker 部署逻辑的关键调整，已同步更新打包与部署脚本：

### 1. SECRET_KEY 生产环境强制校验（重要）

后端新增校验：当 `DEBUG=false`（生产）且 `SECRET_KEY` 为空或仍是公开默认值时，**启动直接报错**，避免模型 API Key 用公开密钥加密等同明文。

由于 `docker-compose.yml` 固定 `DEBUG: "false"`，所有 Docker 启动路径都必须提供自定义 `SECRET_KEY`，否则后端容器会启动失败。对应改动：

- `scripts/docker_manger.sh`：`ensure_env` 首次从 `.env.example` 生成 `.env` 时，自动用
  `openssl rand -hex 32`（或 `python3 secrets` / `/dev/urandom` 兜底）生成随机 `SECRET_KEY` 写入 `.env`。
- `Makefile`：新增 `docker-secret` 目标，`make docker-up` 前自动在根目录生成含随机 `SECRET_KEY` 的 `.env`（`.env` 已被 gitignore）。
- `.env.docker.example`：`SECRET_KEY` 改为留空占位 + 说明（首次启动自动生成；手动部署用 `openssl rand -hex 32`）。
- `scripts/package-docker.sh`：生成的 `README-docker.md` 去掉手动 `cp .env.example .env` 步骤（改由 `docker_manger.sh` 自动生成并注入密钥），并增加“请勿更换/删除 SECRET_KEY”的提示。

> ⚠️ 迁移/备份时务必连同 `.env`（含 SECRET_KEY）与 `data/` 一起保留，否则已加密的 API Key 无法解密。

### 2. 后端默认端口对齐为 8001

`backend/core/config.py` 默认 `port` 与 `backend/.env.example` 的 `PORT` 由 `8000` 改为 `8001`，与 `docker-compose.yml`、`docker/nginx.conf`、`scripts/start-dev.sh` 全栈一致；Docker 内仍通过环境变量显式指定 `PORT=8001`，行为不变。

### 3. 不影响镜像构建方式的应用层改动

以下改动包含在镜像内但不改变构建/部署流程：前端 6 个页面统一为企业级暗色范式（PageHeader / MetricCard / 右侧 Drawer 表单 / 统一状态徽标 / ECharts 趋势图）、全局主题低对比化；后端性能压测新增精简指标矩阵导出（Markdown/HTML）与中文 CSV、worker 容错、列表接口 N+1 优化等。
