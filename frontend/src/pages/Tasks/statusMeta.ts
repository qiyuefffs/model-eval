import type { EvalTaskStatus } from '@/api/hooks/useEvalTasks';

export const STATUS_META: Record<EvalTaskStatus, { label: string; color: string }> = {
  pending: { label: '等待中', color: 'default' },
  running: { label: '运行中', color: 'processing' },
  succeeded: { label: '已完成', color: 'success' },
  failed: { label: '失败', color: 'error' },
};

export const evalTaskStatusOptions = Object.entries(STATUS_META).map(([value, meta]) => ({
  value,
  label: meta.label,
}));
