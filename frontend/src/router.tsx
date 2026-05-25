import { createBrowserRouter } from 'react-router-dom';
import AppLayout from './components/Layout/AppLayout';
import Dashboard from './pages/Dashboard';
import DatasetsPage from './pages/Datasets';
import EvalPage from './pages/Eval';
import ModelsPage from './pages/Models';
import PerfPage from './pages/Perf';
import ReportsPage from './pages/Reports';
import TasksPage from './pages/Tasks';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'models', element: <ModelsPage /> },
      { path: 'datasets', element: <DatasetsPage /> },
      { path: 'eval', element: <EvalPage /> },
      { path: 'perf', element: <PerfPage /> },
      { path: 'tasks', element: <TasksPage /> },
      { path: 'reports', element: <ReportsPage /> },
    ],
  },
]);
