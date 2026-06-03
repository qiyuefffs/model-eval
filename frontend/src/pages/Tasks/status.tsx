import StatusBadge from '@/components/common/StatusBadge';
import type { EvalTaskStatus } from '@/api/hooks/useEvalTasks';

export function EvalTaskStatusTag({ status }: { status: EvalTaskStatus }) {
  return <StatusBadge status={status} />;
}
