# EvalPlatform 开发流程文档

> 本文档记录 EvalPlatform 从需求、架构、阶段拆分到日常开发验证的完整流程。长期技术记忆和踩坑记录见 `.claude/PROJECT.md`。

## 1. 项目目标

EvalPlatform 是基于 EvalScope 构建的轻量级模型评估平台，目标是把原本依赖命令行的模型质量评测与性能压测能力，封装成可视化、可追踪、可复用的工程系统。

核心目标：

- 支持云端 API 模型与本地 OpenAI 兼容推理服务。
- 支持质量评测 `eval` 与性能压测 `perf` 两条独立流水线。
- 支持 EvalScope 内置数据集与自定义业务数据集。
- 每次评测结果持久化入库，支持模型版本纵向对比。
- 通过 React Web 页面完成模型、数据集、任务与报告配置。

## 2. 技术选型

### 后端

| 模块 | 技术 | 说明 |
|---|---|---|
| Web 框架 | FastAPI | 提供 REST API、OpenAPI 文档、后续 SSE 日志流 |
| ORM | SQLModel | 统一 Pydantic schema 与 SQLAlchemy ORM |
| 数据库 | SQLite | MVP 阶段单文件存储，后续可迁移 PostgreSQL |
| 任务队列 | asyncio.Queue | 单机轻量队列，区分 eval 与 perf 流水线 |
| 评测引擎 | EvalScope Python API | 优先内嵌调用，不通过 subprocess 调 CLI |
| 包管理 | uv | Python 依赖管理与命令运行 |
| 日志 | loguru | 控制台日志与文件轮转 |

### 前端

| 模块 | 技术 | 说明 |
|---|---|---|
| 框架 | React 18 + TypeScript | SPA 前端 |
| 构建 | Vite 5 | 本地开发与代理 |
| UI | Ant Design 5 | 表格、表单、弹窗等数据密集组件 |
| 样式 | Tailwind CSS + CSS Variables | 暗色终端风格 |
| 状态 | TanStack Query | 服务端状态缓存与刷新 |
| 表单 | React Hook Form + Zod | 类型安全表单校验 |
| 图表 | ECharts | 报告对比、趋势、雷达图 |
| 动画 | Framer Motion | 页面与状态微交互 |

## 3. 目录结构

```text
eval-platform/
├── backend/             FastAPI 后端
│   ├── api/             REST 路由
│   ├── api/schemas/     API 入参/出参 schema
│   ├── core/            配置、日志、安全能力
│   ├── db/              数据库连接与 SQLModel 表
│   ├── services/        业务逻辑
│   └── workers/         后续异步任务执行器
├── frontend/            React 前端
│   ├── src/api/         Axios client 与 TanStack Query hooks
│   ├── src/components/  通用组件
│   ├── src/pages/       页面
│   └── src/theme/       主题 token 与 AntD 配置
├── configs/             后续 YAML 预设
├── custom_datasets/     自定义业务数据集
├── docs/                项目开发文档
├── outputs/             EvalScope 原始产物
├── reports/             评测报告
├── scripts/             一次性脚本
└── .claude/PROJECT.md   长期项目记忆
```

## 4. 阶段化路线

| 阶段 | 内容 | 状态 | 说明 |
|---|---|---|---|
| 0 | 双端脚手架 | 已完成 | 创建 FastAPI 后端、React 前端、Makefile、主题与基础路由 |
| 1 | 后端 DB + 模型 CRUD API | 已完成 | 模型注册、列表、删除、API Key 加密、连通性测试 |
| 2 | 前端基础设施 | 已完成 | Axios、TanStack Query、AntD 主题、React Router |
| 3 | 模型管理页 | 已完成 | 模型列表、注册弹窗、标签筛选、删除确认、连通性测试按钮 |
| 4 | 后端基准 + 自定义数据集 API | 已完成 | 暴露 EvalScope 内置 benchmark 与自定义数据集上传校验 |
| 5 | 前端数据集页 | 已完成 | 基准浏览、tag 筛选、自定义数据集上传 |
| 6 | 后端质量评测流水线 | 已完成 | eval 任务表、队列、状态流转、结果解析 |
| 7 | 前端评测 + 任务中心 | 已完成 | 表单配置、任务提交、全局任务状态与结果摘要 |
| 8 | 后端性能流水线 | 已完成 | perf 压测任务、指标解析、结果入库 |
| 9 | 前端压测页 | 已完成 | 并发、请求数、token 长度等压测参数配置与指标展示 |
| 10 | 报告对比 | 已完成 | 按任务选择质量/性能结果，可视化对比与 Markdown/HTML 导出 |
| 11 | 打磨 | 待开发 | 错误边界、Docker、文档、可部署化 |

当前进度：阶段 10 已完成，下一步进入阶段 11。

## 5. 当前已实现能力

### 模型注册后端

已实现接口：

- `GET /api/health`：后端健康检查。
- `POST /api/models`：注册模型。
- `GET /api/models`：模型列表。
- `GET /api/models/{model_pk}`：模型详情。
- `DELETE /api/models/{model_pk}`：删除模型。
- `POST /api/models/{model_pk}/test`：OpenAI 兼容接口连通性测试。
- `GET /api/benchmarks`：EvalScope 内置 benchmark 查询，支持 `keyword/tag/backend/eval_type` 过滤。
- `POST /api/datasets`：上传自定义 JSON/JSONL 数据集，支持 `general_qa/general_mcq/general_fc` 基础校验。
- `GET /api/datasets`：自定义数据集列表，支持 `dataset_type/tag` 过滤。
- `DELETE /api/datasets/{dataset_pk}`：删除自定义数据集及服务端文件。
- `POST /api/eval-tasks`：创建质量评测任务，入库后加入后台队列执行。
- `GET /api/eval-tasks`：质量评测任务列表，支持 `status/model_pk` 过滤。
- `GET /api/eval-tasks/{task_id}`：质量评测任务详情，返回结果摘要。
- `POST /api/perf-tasks`：创建性能压测任务，入库后加入独立后台队列执行。
- `GET /api/perf-tasks`：性能压测任务列表，支持 `status/model_pk` 过滤。
- `GET /api/perf-tasks/{task_id}`：性能压测任务详情，返回 TTFT/TPOT/吞吐等结果摘要。

模型注册采用 URI 方式，不直接管理本地模型文件。云端模型与本地推理服务都按 OpenAI 兼容 API 注册。

### 模型管理前端

已实现页面：

- `/`：总览页。
- `/models`：模型管理页。
- `/datasets`：数据集页。
- `/eval`：质量评测任务创建页。
- `/tasks`：任务中心页。
- `/perf`：性能压测任务创建与结果查看页。

模型管理页能力：

- 模型列表展示。
- 关键字搜索。
- 标签筛选。
- 注册模型弹窗。
- DeepSeek、阿里百炼、硅基流动、本地 vLLM 端点预设。
- 连通性测试按钮。
- 删除二次确认。

数据集页能力：

- 内置 benchmark 浏览。
- benchmark 关键字、标签、后端筛选。
- 自定义数据集列表。
- JSON/JSONL 自定义数据集上传。
- `general_qa`、`general_mcq`、`general_fc` 类型选择与后端校验错误展示。
- 自定义数据集删除确认。

质量评测与任务中心能力：

- 选择模型、内置 benchmark、自定义数据集创建质量评测任务。
- 配置 `eval_batch_size`、`limit`、`temperature`、`max_tokens` 等常用参数。
- 创建成功后停留在 `/eval` 页并刷新同页任务列表。
- `/tasks` 聚合质量评测与性能压测任务，突出运行队列、失败诊断和最近完成任务。
- 任务列表支持类型筛选、状态筛选、关键字搜索与运行中轮询刷新。
- 任务详情抽屉展示状态、输出目录、日志路径、错误信息、结果摘要和原始 `result_summary`。
- SSE 实时日志面板已预留，后续接入后端日志流接口。

性能压测页能力：

- 选择模型创建性能压测任务。
- 配置压测数据源、请求数、并发数、open-loop rate、prompt、max_tokens、temperature、stream 和总超时。
- 压测数据源支持固定 Prompt、EvalScope OpenQA、自定义数据集。
- 性能任务列表支持状态筛选、关键字搜索和运行中轮询刷新。
- 展示请求吞吐、Token 吞吐、平均延迟、TTFT、TPOT、成功率、成功/失败请求数。
- 任务详情抽屉展示原始 metrics 与 percentile JSON，便于后续报告对比复用。

## 6. 本地启动流程

当前本机 `8000` 端口被 Cursor/VS Code 占用，因此后端开发端口使用 `8001`。

### 启动后端

```bash
cd /home/hywl/xiangmu/vllm-skills-agent/eval-platform/backend
uv run uvicorn main:app --host 127.0.0.1 --port 8001
```

验证后端：

```bash
curl http://127.0.0.1:8001/api/health
```

### 启动前端

```bash
cd /home/hywl/xiangmu/vllm-skills-agent/eval-platform/frontend
pnpm dev
```

访问前端：

```text
http://localhost:5173/
```

前端开发代理配置位于 `frontend/vite.config.ts`，当前 `/api` 代理到：

```text
http://localhost:8001
```

## 7. 开发规范

### 提交粒度

每完成一个独立功能单元后提交一次：

- `feat: 描述`：新功能。
- `fix: 描述`：修复。
- `docs: 描述`：文档。
- `refactor: 描述`：重构。
- `chore: 描述`：工程配置或杂项。

### API 变更流程

后端接口变更后：

1. 更新 FastAPI router / schema / service。
2. 启动后端。
3. 同步前端 OpenAPI 类型。

```bash
cd /home/hywl/xiangmu/vllm-skills-agent/eval-platform
make gen-api
```

4. 更新前端 hooks 与页面。
5. 跑类型检查和 lint。

### 前端页面开发流程

推荐顺序：

1. 在 `src/api/hooks/` 新增 TanStack Query hook。
2. 在 `src/pages/` 新增页面目录。
3. 拆分表单、表格、按钮等局部组件。
4. 接入 `src/router.tsx`。
5. 检查空状态、loading、错误提示。
6. 运行 TypeScript 与 ESLint 检查。

### 后端模块开发流程

推荐顺序：

1. 定义 SQLModel 表或 Pydantic schema。
2. 在 `services/` 实现业务逻辑。
3. 在 `api/` 暴露 REST 路由。
4. 在 `main.py` 挂载 router。
5. 使用 curl 验证接口。
6. 需要时同步前端 OpenAPI 类型。

### 后端基准与自定义数据集

阶段 4 已完成接口：

- `GET /api/benchmarks`
  - `keyword`：按名称、展示名、说明模糊搜索。
  - `tag`：按标签精确过滤。
  - `backend`：按 EvalScope 后端过滤。
  - `eval_type`：按评测类型过滤，当前主要是 `quality`。
- `POST /api/datasets`
  - 表单字段：`name`、`dataset_type`、`file`、`description`、`tags`。
  - 文件格式：`.json` / `.jsonl`，UTF-8 编码。
  - 数据类型：`general_qa`、`general_mcq`、`general_fc`。
- `GET /api/datasets`
  - 支持 `dataset_type` 与 `tag` 过滤。
- `DELETE /api/datasets/{dataset_pk}`
  - 删除 DB 记录与 `custom_datasets/` 下保存文件。

校验规则：

- `general_qa`：每条样本需要题干字段（`question/query/prompt/input`）与答案字段（`answer/response/output/target`）。
- `general_mcq`：每条样本需要题干字段、选项字段（`choices/options`）与答案字段（`answer/label/target`）。
- `general_fc`：每条样本需要对话字段（`messages/conversation/prompt`）与工具字段（`tools/functions/function`）。

### 后端质量评测流水线

阶段 6 已完成能力：

- `EvalTask` / `EvalResult` 表。
- 评测任务创建、列表、详情接口。
- 单机 `asyncio.Queue` 质量评测队列。
- 应用启动时恢复 `pending/running` 任务。
- 通过 `evalscope.TaskConfig` + `evalscope.run_task` 调用 Python API。
- 记录任务状态、输出目录、日志路径、错误信息、结果摘要。

执行约定：

- API 模型统一按 OpenAI 兼容服务评测，`eval_type=EvalType.OPENAI_API`。
- 内置 benchmark 直接写入 `datasets`。
- 自定义数据集通过 `dataset_args[dataset_type].local_path` 挂载本地上传文件。
- 阶段 6 只做后端队列与状态持久化；实时日志 SSE 与前端任务监控放到阶段 7。

### 前端评测与任务中心

阶段 7 已完成能力：

- `useEvalTasks` TanStack Query hooks。
- `/eval` 质量评测创建页。
- `/tasks` 任务中心页，聚合质量评测与性能压测任务。
- 运行中 / 等待中任务 3 秒轮询刷新。
- 运行队列、失败诊断、最近完成和全局任务检索。
- 质量评测与性能压测分别复用对应详情抽屉。
- 日志面板占位，保留 `log_path` 展示。

### 后端性能流水线

阶段 8 已完成能力：

- `PerfTask` / `PerfResult` 表。
- 性能压测任务创建、列表、详情接口。
- 独立 `asyncio.Queue` 性能压测队列。
- 应用启动时恢复 `pending/running` 性能任务。
- 通过 `evalscope.perf.arguments.Arguments` + `evalscope.perf.benchmark.run_benchmark` 执行 OpenAI 兼容接口压测。
- 记录请求数、成功数、失败数、请求吞吐、Token 吞吐、平均延迟、TTFT、TPOT、成功率和 percentile 摘要。

执行约定：

- 性能压测与质量评测使用两条独立队列，互不阻塞。
- `rate > 0` 时启用 open-loop，`rate=-1` 时使用 closed-loop 并发压测。
- 当前阶段后端只负责任务与指标入库；前端压测页放到阶段 9。
- EvalScope perf 单次执行需要标量 `number/parallel/rate`；后端会在创建 `Arguments` 后把这些字段从 list 还原成标量。
- 自定义压测数据集会抽取 `question/query/prompt/input` 等字段生成 `perf_prompts.txt`，再交给 EvalScope `custom` 数据集插件。
- EvalScope perf 连接失败可能触发 `SystemExit`，worker 会捕获并标记任务失败，避免主服务退出。

### 前端性能压测页

阶段 9 已完成能力：

- `usePerfTasks` TanStack Query hooks。
- `/perf` 页面替换阶段占位页。
- 压测创建表单。
- 性能任务列表与详情展示。
- 指标卡片与 percentile JSON 展示。
- 运行中任务 3 秒轮询刷新。

### 报告对比与导出

阶段 10 已完成能力：

- `/api/reports/tasks` 返回可选择的已完成质量评测/性能压测任务。
- `/api/reports/compare` 按 `task_type + task_ids` 返回图表友好的对比数据。
- `/api/reports/export` 基于当前选择任务生成 Markdown / HTML 报告并写入 `reports/`。
- `/reports` 页面改为“结果分析台”：质量评测 / 性能压测切换、左侧任务多选、右侧可视化分析。
- 质量评测支持平均分柱状图、Dataset 雷达图和分数明细表。
- 性能压测支持吞吐对比、TTFT/TPOT 延迟对比、核心指标表和 Percentile 明细。
- 前端限制最多选择 8 个任务，避免图表过载。

## 8. 下一阶段开发计划

阶段 11：日志流与运行态可观测性（SSE / 任务日志 / 失败诊断）。

目标：

- 将 `log_path` 暴露为安全的后端读取接口。
- 为质量评测与性能压测任务接入实时日志流。
- 前端任务详情抽屉展示实时日志与历史日志。
- 增加失败任务的错误摘要与排障提示。
- 评估是否需要将任务事件持久化为独立表。

建议拆分：

1. 后端日志读取与路径白名单。
2. `/api/tasks/{type}/{id}/logs` 历史日志接口。
3. SSE 日志流接口与 worker 写入约定。
4. 前端日志面板替换占位区域。
5. 失败诊断摘要与重试入口。

## 9. 已知注意事项

- 当前模型注册的 `api_key` 仍为必填，本地服务如果不校验鉴权，可以填 `local-dev-key` 等占位值。
- 当前 Vite 代理临时指向 `8001`，如果后端端口改回 `8000`，需要同步修改 `frontend/vite.config.ts`。
- `platform.db` 是本地开发数据库，不应提交。
- `outputs/`、`reports/`、`logs/` 是运行产物目录，不应提交真实产物。
- `.claude/PROJECT.md` 用于记录长期技术决策和踩坑，`docs/DEVELOPMENT_PROCESS.md` 用于面向开发者的流程说明。

