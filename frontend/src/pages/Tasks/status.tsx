import { Tag } from 'antd';
import type { EvalTaskStatus } from '@/api/hooks/useEvalTasks';
import { STATUS_META } from './statusMeta';

export function EvalTaskStatusTag({ status }: { status: EvalTaskStatus }) {
  const meta = STATUS_META[status];
  return <Tag color={meta.color}>{meta.label}</Tag>;
}
