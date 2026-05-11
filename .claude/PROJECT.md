# EvalPlatform 项目长期记忆

> 这是 EvalPlatform 项目的"长期记忆"文件。每次发生**重大决策变更**或**踩坑解决**后必须更新。

---

## 1. 项目定位

基于 [EvalScope](https://github.com/modelscope/evalscope) 构建的**轻量级模型评估平台**（L2.5）：

- **目标用户**：算法/工程团队，需要对多个 LLM（云端 API + 本地部署）做常态化质量与性能对比
- **核心价值**：
  1. **双线并行**：质量评测（eval）与性能压测（perf）两条独立流水线
  2. **持久化对比**：每次评测入库，支持模型 v1/v2/v3 纵向对比
  3. **配置驱动**：前端表单 → YAML → `evalscope.run_task`，零脚本运维
  4. **自定义数据集**：通过 evalscope 的 `general_qa/general_mcq/general_fc` 占位适配器接入业务数据

---

## 2. 技术栈

### 后端

| 层 | 技术 | 版本 | 说明 |
|---|---|---|---|
| Web 框架 | FastAPI | >=0.115 | 异步、OpenAPI 自动文档 |
| ORM | SQLModel | >=0.0.22 | Pydantic + SQLAlchemy 二合一 |
| 数据库 | SQLite | - | 单文件零运维；后期可迁移 PostgreSQL |
| 迁移 | Alembic | >=1.13 | DB schema 版本化 |
| 异步任务 | asyncio.Queue + DB 状态表 | - | 单机轻量；不引入 Redis/Celery |
| 评测引擎 | EvalScope | latest | Python API 内嵌调用 |
| 配置 | Pydantic Settings + YAML | - | 模型/基准模板可版本化 |
| 日志 | loguru | >=0.7 | 结构化、文件轮转 |
| 包管理 | uv | latest | pip 加速版 |
| Python | 3.12 | - | 与 evalscope-test venv 对齐 |

### 前端

| 层 | 技术 | 说明 |
|---|---|---|
| 构建工具 | Vite 5 + React 18 + TypeScript 5 | 启动 <1s，HMR 极快 |
| 包管理 | pnpm | 比 npm 快 3x |
| UI 组件 | Ant Design 5 | 表格/表单/上传数据密集型场景强 |
| 样式 | Tailwind CSS 3 | 与 AntD 共存，做布局微调 |
| 状态 | TanStack Query v5 + Zustand | Query 管服务端，Zustand 管 UI |
| 路由 | React Router v6 | SPA |
| 表单 | React Hook Form + Zod | 类型安全 |
| 图表 | echarts-for-react | 雷达图、对比图、趋势 |
| 动画 | Framer Motion | 微交互 |
| HTTP | Axios + openapi-typescript | 后端 OpenAPI 自动生成 TS 类型 |
| 实时日志 | SSE (EventSource) | FastAPI StreamingResponse |
| 字体 | Manrope（正文）+ JetBrains Mono（代码） | 避免 Inter 通用感 |

### 视觉风格

**暗色终端美学**（工程师友好）：

- 主背景：深炭黑 `#0a0e14`
- 强调色：终端绿 `#50c878`（通过/主操作）、橙 `#ffb454`（运行中）、红 `#ff5370`（失败）
- 字体：Manrope + JetBrains Mono
- 背景：subtle 32px 网格
- 动画：Framer Motion 微交互，避免过度炫技

---

## 3. 目录约定

```
eval-platform/
├── backend/         Python 后端（FastAPI）
├── frontend/        React 前端（Vite）
├── configs/         模型/基准/压测的 YAML 预设
├── custom_datasets/ 自定义评测数据（挂载到 evalscope）
├── adapters/        自定义 DataAdapter（继承 evalscope）
├── outputs/         evalscope 原始产物（gitignore）
├── reports/         沉淀报告（按日期归档）
├── scripts/         一次性脚本（init_db、seed_benchmarks）
└── platform.db      SQLite（gitignore）
```

---

## 4. 关键开发约定

1. **强制中文**：注释、文档、commit message、UI 文案统一简体中文（标识符除外）
2. **配置即契约**：新增模型/基准只改 YAML，不改代码
3. **小步快跑**：每完成一个子模块立即 commit，commit type 用 `feat/fix/docs/refactor/chore`
4. **API 类型同步**：后端改完接口必须跑 `make gen-api` 同步前端类型
5. **不造轮子**：调 evalscope Python API，禁止 subprocess 调 CLI

---

## 5. 阶段化路线（当前进度）

| 阶段 | 内容 | 状态 |
|---|---|---|
| 0 | 双端脚手架 | 🚧 进行中 |
| 1 | 后端 DB + 模型 CRUD API | ⏳ |
| 2 | 前端基础设施（路由、主题、API 客户端） | ⏳ |
| 3 | 模型管理页 | ⏳ |
| 4 | 后端基准 + 自定义数据集 API | ⏳ |
| 5 | 前端数据集页 | ⏳ |
| 6 | 后端评测流水线（asyncio.Queue + SSE 日志） | ⏳ |
| 7 | 前端评测 + 任务监控页 | ⏳ |
| 8 | 后端性能流水线 | ⏳ |
| 9 | 前端压测页 | ⏳ |
| 10 | 报告对比（雷达/柱状/趋势 + 导出） | ⏳ |
| 11 | 打磨（错误边界、Docker、文档） | ⏳ |

---

## 6. 踩坑记录

### evalscope 兼容性

- `evalscope[app]` 钉死 `gradio==5.4.0`，依赖 `huggingface_hub` 的 `HfFolder`，与 `huggingface_hub>=0.28` 不兼容。
  - 对策：本项目用 React 前端替代 Gradio，**不依赖 evalscope[app]**，只用核心 evalscope。
- 默认 conda 频道 `anaconda/pkgs/free` 已被 TUNA/阿里下架（许可变更），改用 uv + venv 规避。

### 评测产物路径

- evalscope 默认在 `--work-dir` 下创建 `<时间戳>` 子目录。本项目所有任务统一 `--work-dir ./outputs`，由后端拼时间戳便于关联 task_id。

---

## 7. 后续待办（TODO 池）

- [ ] 接入 vLLM 自动启停（评测前拉起本地服务）
- [ ] 接入飞书/钉钉告警（分数下降阈值）
- [ ] 接入 ms-swift 训练后自动评测
- [ ] CI/CD：PR 自动跑冒烟评测
- [ ] 多用户系统（OAuth）

---

**最后更新**：2026-05-11（阶段 0 启动）
