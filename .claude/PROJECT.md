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
| 0 | 双端脚手架 | ✅ 完成 |
| 1 | 后端 DB + 模型 CRUD API | ✅ 完成（云端 API 模型注册，含 Fernet 加密、连通性测试） |
| 2 | 前端基础设施（路由、主题、API 客户端） | ✅ 完成（随阶段 0 一起） |
| 3 | 模型管理页 | ✅ 完成（列表/创建/删除/连通性测试 + 标签筛选） |
| 4 | 后端基准 + 自定义数据集 API | ✅ 完成（benchmark 查询 + JSON/JSONL 自定义数据集上传校验） |
| 5 | 前端数据集页 | ✅ 完成（内置基准浏览 + 自定义数据集上传/列表/删除） |
| 6 | 后端评测流水线（asyncio.Queue + 结果入库） | ✅ 完成（EvalTask/EvalResult + EvalScope Python API 调用） |
| 7 | 前端评测 + 任务中心 | ✅ 完成（任务创建表单 + 全局任务中心 + 结果摘要） |
| 8 | 后端性能流水线 | ✅ 完成（PerfTask/PerfResult + 独立 perf worker） |
| 9 | 前端压测页 | ✅ 完成（压测表单 + 性能任务列表 + 指标详情） |
| 10 | 报告对比（按任务选择 + 质量/性能可视化 + 导出） | ✅ 完成 |
| 11 | 打磨（错误边界、Docker、文档） | ⏳ |

---

## 6. 踩坑记录

### evalscope 兼容性

- `evalscope[app]` 钉死 `gradio==5.4.0`，依赖 `huggingface_hub` 的 `HfFolder`，与 `huggingface_hub>=0.28` 不兼容。
  - 对策：本项目用 React 前端替代 Gradio，**不依赖 evalscope[app]**，只用核心 evalscope。
- 默认 conda 频道 `anaconda/pkgs/free` 已被 TUNA/阿里下架（许可变更），改用 uv + venv 规避。

### 评测产物路径

- evalscope 默认在 `--work-dir` 下创建 `<时间戳>` 子目录。本项目所有任务统一 `--work-dir ./outputs`，由后端拼时间戳便于关联 task_id。

### Ruff B008 误报

- FastAPI 的 `Depends() / Path() / Query()` 在参数默认值是官方惯用法，与 ruff B008（"不要在默认参数里调用函数"）冲突。
- 对策：`pyproject.toml` 的 `[tool.ruff.lint.per-file-ignores]` 给 `api/*.py` 加白名单 `B008`。

### 模型范围限定

- 阶段 1 应用户要求**只做云端 API 模型注册**（OpenAI 兼容 URI + key），不引入本地 / HF / ModelScope 模型管理。
- DB 表保留扩展空间（无 `model_type` 字段，所有现存记录默认是 API 型），未来若需要可加可空字段不破坏既有数据。

### 前端表单与 AntD App Context

- `App.useApp().message` 必须在 `<AntdApp>` 上下文内调用，否则会回退到 static API 引发 `[antd: message] Static function can not consume context`。
- 已在 `src/App.tsx` 用 `<AntdApp>` 包裹整个 RouterProvider，所以页面内 `App.useApp()` 直接可用。

### React Hook Form + Zod 配合 AntD

- `Controller` 的 render prop 注入 `field={ref, value, onChange, onBlur, name}`，整体 `...field` 展开传给 AntD `Input/Select/Textarea` 不会有 ref 警告。
- Zod 的 `default()` 用于让 `optional` 字段在 schema 输出侧仍为非空，避免 TS 推断 `string | undefined` 干扰 AntD `value` prop 的类型。

### EvalScope benchmark 元数据发现

- 当前开发环境可能存在 `uv.lock` 已锁定 `evalscope`、但虚拟环境未同步的情况，直接 import 会失败。
  - 对策：`benchmark_service` 对 EvalScope 常见注册表做可选发现，失败时回退到项目内置最小 benchmark 目录，保证后端与前端开发不被环境阻塞。

### 自定义数据集格式

- 阶段 4 仅做基础结构校验，不绑定过窄字段名，避免不同业务数据导出字段差异导致无法接入。
  - `general_qa` 接受 `question/query/prompt/input` + `answer/response/output/target`。
  - `general_mcq` 接受题干 + `choices/options` + `answer/label/target`。
  - `general_fc` 接受 `messages/conversation/prompt` + `tools/functions/function`。

### 前端数据集页

- 阶段 5 复用模型页模式：TanStack Query hook + AntD 表格 + 上传弹窗 + App message。
- OpenAPI 类型用当前 FastAPI 应用离线导出生成，避免依赖开发服务端口或服务是否重启。
- `/datasets` 页当前做前端本地筛选，后续 benchmark 数量明显增大时再切换到后端查询参数。

### EvalScope Python API 调用

- 阶段 6 确认 `evalscope==1.7.0` 暴露 `TaskConfig` 与 `run_task`，服务评测使用 `EvalType.OPENAI_API`。
- OpenAI 兼容模型从 `models` 表取 `model_id/api_url/api_key`，API key 仅在 worker 内部解密。
- 自定义数据集通过 `dataset_args[dataset_type].local_path` 挂载本地文件；一次任务暂不支持多个相同 `dataset_type` 的自定义数据集。
- Worker 启动时恢复 `pending/running` 任务；失败会写入 `error_message` 并标记 `failed`。

### 前端评测与任务监控

- 阶段 7 新增 `/eval` 和 `/tasks` 两个页面，分别用于创建质量评测任务与查看任务状态。
- 前端通过 `useEvalTasks` 对 pending/running 任务 3 秒轮询，避免阶段 7 先引入 SSE 的额外复杂度。
- 任务详情抽屉展示 `work_dir/log_path/result_summary/results`，日志流区域先保留占位，后续接入专用日志接口。
- EvalScope 内置 benchmark 可能包含大量子集，例如 CEval 默认会跑 52 个科目；前端创建任务时必须暴露子集选择，并默认只选第一个子集用于冒烟测试。
- EvalScope 会把 `model_id` 拼进缓存目录；如果模型 ID 是 `/Volumes/...` 这类路径，会在 Linux 下尝试创建无权限目录。后端传给 EvalScope 的 `model_id` 必须转成安全文件名，真实 API 模型名仍传给 `model`。
- `/eval` 页面已对齐 `/perf` 的交互：同页创建任务、查看任务列表、状态筛选、搜索、结果分数和详情抽屉。
- `/api/eval-tasks` 列表需要带 `results` 摘要，否则同页列表无法展示分数；详情接口仍返回完整结果。
- `/tasks` 已升级为全局任务中心，聚合质量评测与性能压测，重点展示运行队列、失败诊断、最近完成和统一检索。

### EvalScope perf 调用

- 阶段 8 确认 `evalscope.perf.arguments.Arguments` 与 `evalscope.perf.benchmark.run_benchmark` 可直接导入使用。
- `evalscope.perf.main` 会额外依赖 `sse_starlette`，当前后端不走该入口，避免引入不必要依赖。
- 性能压测队列与质量评测队列物理分离，分别由 `eval_worker` / `perf_worker` 管理。
- `rate > 0` 使用 open-loop 发压，`rate=-1` 使用 closed-loop 并发压测。
- 指标入库字段覆盖 TTFT、TPOT、请求吞吐、Token 吞吐、平均延迟、成功率和 percentile 摘要。
- `Arguments` 会把 `number/parallel/rate` 规范成 list，但 `run_benchmark` 单次路径按标量比较和循环。
  - 对策：创建 `Arguments` 后在后端执行层把 `number/parallel/rate` 还原为标量。
- EvalScope perf 的异常装饰器在连接测试失败时会 `sys.exit(1)`，可能带崩 uvicorn lifespan。
  - 对策：`perf_worker` 显式捕获 `SystemExit`，写入任务失败状态，不让后台任务终止主服务。
- `run_benchmark` 返回的 metrics / percentiles 在 EvalScope 1.7.0 下不是普通 dict，直接 JSON 化会变成 `{"result": "key=value ..."}`，导致入库指标全为 0/None。
  - 对策：后端统一把对象、字符串和旧版 `result` 包装解析成标准指标字典，再写入 `PerfResult`；列表和详情接口都带解析后的结果。

### 前端性能压测页

- 阶段 9 新增 `/perf` 页面，包含压测任务创建表单、性能任务列表和详情抽屉。
- 前端通过 `usePerfTasks` 对 pending/running 性能任务 3 秒轮询。
- 详情抽屉展示关键指标卡片、原始 metrics 与 percentile JSON，后续报告页可复用这些字段。
- 压测页支持固定 Prompt、EvalScope OpenQA、自定义数据集三类数据源；自定义数据集会在后端抽取 `question/query/prompt/input` 等字段生成 line-by-line prompt 文件。

### 前端滚动布局

- 主内容区通过 `app-content` 固定在 `calc(100vh - 64px)` 内，页面根节点负责纵向滚动，避免整个浏览器窗口被内容无限撑开。
- 表单、任务列表、大表格和图表卡片使用 `scroll-card` + `page-form-card/page-table-card/page-panel-card` 等工具类，让卡片 body 内部滚动。
- AntD `Table` 展示大量数据时应配置 `scroll={{ x, y }}`，保留表头和横向滚动，不要只依赖整页滚动。

### 总览页统计

- `/` 总览页统计必须从真实接口聚合，不允许继续使用阶段 0 占位值。
- 当前统计来源：`/models` 统计已注册模型，`/benchmarks` 统计内置基准，`/eval-tasks` + `/perf-tasks` 统计运行中任务和历史成功任务。
- 后端不可用提示统一指向 `./scripts/start-dev.sh`，不要再提示旧的 `8000` 启动命令。

### 本地开发启动

- 一键启动使用 `./scripts/start-dev.sh` 或 `make dev`，统一启动后端 `127.0.0.1:8001` 和前端 `localhost:5173`。
- 启动脚本会检查端口占用、等待 `/api/health` 和 Vite 首页就绪，并在 `Ctrl+C` 时同时停止前后端子进程。
- 前端 Vite 代理默认指向后端 `8001`，但启动脚本如果因端口占用把后端切换到 `8002+`，必须通过 `EVAL_PLATFORM_BACKEND_URL` 同步传给 Vite，否则页面能打开但 `/api` 会连错后端端口。
- `pnpm gen:api` 固定使用 `localhost:8001`，如后端临时换端口，需要手动指定或先释放 `8001`。

### Docker 打包部署

- Docker 方案包含 `Dockerfile.backend`、`Dockerfile.frontend`、`docker-compose.yml` 和 `docker/nginx.conf`。
- 前端容器使用 Nginx 提供静态资源，并将 `/api`、`/docs`、`/openapi.json`、`/redoc` 反代到后端容器。
- 后端容器使用 `/data` 持久化 SQLite、`outputs`、`reports` 和 `custom_datasets`，Compose 默认映射到项目根目录 `data/`。
- `scripts/package-docker.sh` 会构建镜像并导出 `release/eval-platform-docker-<版本>.tar.gz`，同时复制 Compose 和部署说明。
- `release/docker_manger.sh` 提供部署包一键管理：`start` 首次创建容器并打开前端界面，后续直接启动已有容器；`stop` 仅停止容器，不删除容器，提升二次启动速度。
- Docker Compose 已用临时端口完成冒烟测试：后端 `/api/health`、前端首页、Nginx `/api/health` 反代均通过。

### 报告对比与导出

- 阶段 10 将 `/reports` 重构为结果分析台，不再默认混合展示最近任务，而是按质量评测 / 性能压测切换。
- `/api/reports/tasks` 提供已完成任务候选列表，`/api/reports/compare` 按 `task_type + task_ids` 返回图表友好结构。
- 质量评测返回任务摘要、dataset 分数、分数矩阵和趋势点；前端展示平均分柱状图、Dataset 雷达图、Dataset 分组柱状图、分数热力图、质量趋势线、分数矩阵表和结果明细。
- 性能压测返回核心指标与 percentile 行；前端展示吞吐对比、TTFT/TPOT 延迟对比、成功率柱状图、Percentile 折线图、综合雷达、指标热力图、核心指标表和 Percentile 明细。
- 报告页右侧采用“核心大图 + 透明覆盖雷达 + Tabs 深入分析”的宽松布局；避免将所有图表挤在两列中，雷达图使用半透明面积叠加展示多任务维度差异。
- EvalScope 质量结果可能以对象字符串保存在 `metrics.value` 中，例如包含 `score=0.8 metrics=[Metric(...)]`，历史数据的 `score` 字段可能为空。
  - 对策：质量结果解析统一支持 `score=...`、`"score": ...`、`mean_acc/macro_score/accuracy` 等文本模式；报告页绘图只使用可解析数值，单 Dataset 时雷达图自动降级为柱状对比。
- Markdown / HTML 导出复用当前选择的任务集合，后端生成任务摘要、质量平均分/Dataset 雷达基线/热力图/矩阵/趋势/明细，以及性能吞吐/延迟/成功率/综合雷达归一化/热力图归一化/Percentile/核心指标等全部对比点；前端收到 `content` 后触发浏览器下载，保证“所见即所导出”。
- 前端最多选择 8 个任务进行对比，避免图表不可读。

---

## 7. 后续待办（TODO 池）

- [ ] 接入 vLLM 自动启停（评测前拉起本地服务）
- [ ] 接入飞书/钉钉告警（分数下降阈值）
- [ ] 接入 ms-swift 训练后自动评测
- [ ] CI/CD：PR 自动跑冒烟评测
- [ ] 多用户系统（OAuth）

---

**最后更新**：2026-05-22（新增 Docker Compose 打包部署）
