import { createBrowserRouter } from 'react-router-dom';
import AppLayout from './components/Layout/AppLayout';
import Dashboard from './pages/Dashboard';
import Placeholder from './components/Placeholder';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      {
        path: 'models',
        element: (
          <Placeholder
            title="模型管理"
            stage="阶段 1 / 3"
            description="注册云端 API 模型与本地模型，统一管理 API key 与连通性测试。"
          />
        ),
      },
      {
        path: 'datasets',
        element: (
          <Placeholder
            title="数据集"
            stage="阶段 4 / 5"
            description="浏览 evalscope 内置 123+ 评测基准，并上传 / 管理自定义业务数据集。"
          />
        ),
      },
      {
        path: 'eval',
        element: (
          <Placeholder
            title="质量评测"
            stage="阶段 6 / 7"
            description="可视化配置评测参数，提交后异步运行，实时查看进度与日志。"
          />
        ),
      },
      {
        path: 'perf',
        element: (
          <Placeholder
            title="性能压测"
            stage="阶段 8 / 9"
            description="发起 TTFT / TPOT / 吞吐 / SLA 自动调优压测，独立流水线不阻塞评测。"
          />
        ),
      },
      {
        path: 'tasks',
        element: (
          <Placeholder
            title="任务监控"
            stage="阶段 7"
            description="评测与压测任务统一队列视图，SSE 实时日志，可终止与重跑。"
          />
        ),
      },
      {
        path: 'reports',
        element: (
          <Placeholder
            title="报告对比"
            stage="阶段 10"
            description="多模型纵向对比：雷达图 / 趋势线 / 柱状图，一键导出 Markdown / HTML。"
          />
        ),
      },
    ],
  },
]);
