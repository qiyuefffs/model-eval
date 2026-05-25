import type { PerfTaskStatus } from '@/api/hooks/usePerfTasks';

export const PERF_STATUS_META: Record<PerfTaskStatus, { label: string; color: string }> = {
  pending: { label: '等待中', color: 'default' },
  running: { label: '运行中', color: 'processing' },
  succeeded: { label: '已完成', color: 'success' },
  failed: { label: '失败', color: 'error' },
};

export const perfTaskStatusOptions = Object.entries(PERF_STATUS_META).map(([value, meta]) => ({
  value,
  label: meta.label,
}));
