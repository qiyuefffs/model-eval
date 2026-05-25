import { Tag } from 'antd';
import type { PerfTaskStatus } from '@/api/hooks/usePerfTasks';
import { PERF_STATUS_META } from './statusMeta';

export default function PerfStatusTag({ status }: { status: PerfTaskStatus }) {
  const meta = PERF_STATUS_META[status];
  return <Tag color={meta.color}>{meta.label}</Tag>;
}
