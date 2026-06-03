import StatusBadge from '@/components/common/StatusBadge';
import type { PerfTaskStatus } from '@/api/hooks/usePerfTasks';

export default function PerfStatusTag({ status }: { status: PerfTaskStatus }) {
  return <StatusBadge status={status} />;
}
