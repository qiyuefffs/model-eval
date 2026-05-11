# EvalPlatform

> 基于 [EvalScope](https://github.com/modelscope/evalscope) 构建的轻量级**模型评估平台**：质量评测 + 性能压测 + 历史对比，全部从浏览器配置触发。

```
┌─────────────────────────────────────────────────────────────┐
│              React SPA (Vite + AntD + Tailwind)             │
│   总览 · 模型 · 数据集 · 质量评测 · 性能压测 · 报告对比     │
└──────────────────────────┬──────────────────────────────────┘
                           │ REST + SSE
┌──────────────────────────▼──────────────────────────────────┐
│       FastAPI + SQLModel + asyncio.Queue + EvalScope        │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
        ┌─────────────────────────────────────┐
        │  SQLite     outputs/<ts>/   reports/│
        └─────────────────────────────────────┘
```

---

## 快速开始

### 环境要求

- **Python 3.12+**
- **Node 20+**
- **uv**（Python 包管理）：`curl -LsSf https://astral.sh/uv/install.sh | sh`
- **pnpm**：`npm i -g pnpm`

### 一键安装与启动

```bash
# 1. 安装前后端依赖
make install

# 2. 同时启动前后端（推荐开发用）
make dev
```

启动后：

- 前端：[http://localhost:5173](http://localhost:5173)
- 后端 API：[http://localhost:8000](http://localhost:8000)
- API 文档：[http://localhost:8000/docs](http://localhost:8000/docs)

### 分开启动

```bash
make dev-backend    # 仅后端 (uvicorn)
make dev-frontend   # 仅前端 (vite)
```

### 同步 API 类型

后端接口改动后，运行：

```bash
make gen-api  # 后端 OpenAPI -> 前端 TS 类型
```

---

## 项目结构

```
eval-platform/
├── backend/             FastAPI 后端
│   ├── main.py          应用入口
│   ├── core/            配置、日志、安全
│   ├── db/              SQLModel 表 + Alembic 迁移
│   ├── api/             FastAPI 路由
│   ├── services/        业务逻辑（eval/perf 流水线）
│   └── workers/         异步任务执行器
├── frontend/            React 前端
│   ├── src/
│   │   ├── pages/       页面（总览、模型、数据集、评测、压测、对比）
│   │   ├── components/  通用组件（Layout、图表、日志流）
│   │   ├── api/         REST 客户端 + TanStack Query 钩子
│   │   ├── theme/       AntD 主题 + CSS 设计 token
│   │   └── store/       Zustand 全局状态
│   └── package.json
├── configs/             YAML 预设（模型 / 评测套件 / 压测场景）
├── custom_datasets/     自定义业务评测数据（挂载到 evalscope）
├── adapters/            自定义 DataAdapter（继承 evalscope）
├── outputs/             evalscope 原始产物（gitignore）
├── reports/             沉淀的对比报告（按日期）
├── scripts/             一次性脚本
├── Makefile             一键命令
└── platform.db          SQLite（gitignore）
```

---

## 核心功能（建设中）

| 功能 | 状态 | 阶段 |
|---|---|---|
| 双端脚手架 + 健康检查 | ✅ 已完成 | 0 |
| 模型注册（云端 API）+ 连通性测试 | ✅ 已完成 | 1 |
| 模型管理前端页面 | 🚧 下一步 | 3 |
| 内置基准浏览（123+） | ⏳ | 4 / 5 |
| 自定义数据集上传 | ⏳ | 4 / 5 |
| 质量评测流水线（异步队列） | ⏳ | 6 / 7 |
| 实时日志（SSE） | ⏳ | 7 |
| 性能压测（TTFT/TPOT/SLA） | ⏳ | 8 / 9 |
| 报告对比（雷达图 + 趋势） | ⏳ | 10 |
| 报告导出（Markdown / HTML） | ⏳ | 10 |

详细技术决策与踩坑记录见 [`.claude/PROJECT.md`](./.claude/PROJECT.md)。

---

## 设计哲学

1. **配置即契约**：新增模型/基准只改 YAML，不改代码
2. **不造轮子**：直接调 evalscope Python API，不走 CLI
3. **双线物理隔离**：质量评测 vs 性能压测两条独立队列，互不干扰
4. **持久化优先**：每次评测的指标行级入库，支持 v1/v2/v3 纵向对比
5. **可视优于命令**：所有操作通过浏览器表单驱动

---

## 视觉风格

**暗色终端美学** —— 工程师友好：

- 主背景：深炭黑 + subtle 网格
- 强调色：终端绿（通过）/ 橙（运行中）/ 红（失败）
- 字体：Manrope（正文）+ JetBrains Mono（代码 / 指标）

---

## License

Apache 2.0
