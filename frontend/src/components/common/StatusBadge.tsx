/** 统一的任务状态徽标：低饱和 pill 风格，映射后端任务状态。 */

export type BadgeStatus = 'pending' | 'running' | 'succeeded' | 'failed';

const STATUS_META: Record<BadgeStatus, { label: string; bg: string; fg: string; border: string }> =
  {
    succeeded: {
      label: '已完成',
      bg: 'rgba(34, 197, 94, 0.12)',
      fg: '#86efac',
      border: 'rgba(34, 197, 94, 0.24)',
    },
    running: {
      label: '运行中',
      bg: 'rgba(56, 189, 248, 0.12)',
      fg: '#7dd3fc',
      border: 'rgba(56, 189, 248, 0.24)',
    },
    failed: {
      label: '失败',
      bg: 'rgba(239, 68, 68, 0.12)',
      fg: '#fca5a5',
      border: 'rgba(239, 68, 68, 0.24)',
    },
    pending: {
      label: '排队中',
      bg: 'rgba(245, 158, 11, 0.12)',
      fg: '#fcd34d',
      border: 'rgba(245, 158, 11, 0.24)',
    },
  };

export default function StatusBadge({ status }: { status: BadgeStatus }) {
  const meta = STATUS_META[status] ?? STATUS_META.pending;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 22,
        padding: '0 9px',
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 500,
        lineHeight: 1,
        color: meta.fg,
        background: meta.bg,
        border: `1px solid ${meta.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      {meta.label}
    </span>
  );
}
