# EvalPlatform 前端

基于 Vite + React 18 + TypeScript + Ant Design 5 + Tailwind CSS 的模型评估平台前端。

## 快速开始

```bash
# 安装依赖（首次）
pnpm install

# 启动开发服务
pnpm dev
```

浏览器访问 [http://localhost:5173](http://localhost:5173)

## 技术栈

- **构建**：Vite 5
- **UI 框架**：React 18 + TypeScript
- **组件库**：Ant Design 5（暗色主题）
- **样式**：Tailwind CSS（与 AntD 共存，preflight 已禁用）
- **状态**：TanStack Query v5（服务端）+ Zustand（客户端）
- **路由**：React Router v6
- **表单**：React Hook Form + Zod
- **图表**：ECharts
- **动画**：Framer Motion
- **HTTP**：Axios（开发期 `/api` 代理到 8001）

## 与后端联调

开发期 Vite dev server 把 `/api/**` 自动代理到 `http://localhost:8001`，无需 CORS 也不用改 baseURL。

后端启动后：

```bash
pnpm gen:api  # 拉取 OpenAPI schema 生成 TS 类型
```

## 当前页面

- `/`：总览。
- `/models`：模型管理。
- `/datasets`：内置 benchmark 与自定义数据集。
- `/eval`：质量评测任务创建。
- `/perf`：性能压测任务创建与指标摘要。
- `/tasks`：任务中心，聚合质量评测与性能压测的运行队列、失败诊断与最近完成。
- `/reports`：结果分析台，按质量/性能切换并多选任务做可视化对比和导出。

## 视觉规范

**暗色终端美学**：

- 主背景：`#0a0e14`（深炭黑 + 32px subtle 网格）
- 强调色：终端绿 `#50c878` / 橙 `#ffb454` / 红 `#ff5370`
- 字体：Manrope（正文）+ JetBrains Mono（代码 / 指标）

CSS 变量见 `src/theme/tokens.css`，AntD 主题见 `src/theme/antd-theme.ts`。
