import type { ReactNode } from 'react';
import { Card } from 'antd';

export type MetricTone = 'primary' | 'info' | 'success' | 'warning' | 'danger' | 'purple';

const TONE_COLORS: Record<MetricTone, { bg: string; fg: string }> = {
  primary: { bg: 'rgba(56, 189, 248, 0.12)', fg: '#38bdf8' },
  info: { bg: 'rgba(56, 189, 248, 0.12)', fg: '#38bdf8' },
  success: { bg: 'rgba(34, 197, 94, 0.12)', fg: '#22c55e' },
  warning: { bg: 'rgba(245, 158, 11, 0.12)', fg: '#f59e0b' },
  danger: { bg: 'rgba(239, 68, 68, 0.12)', fg: '#ef4444' },
  purple: { bg: 'rgba(139, 92, 246, 0.12)', fg: '#8b5cf6' },
};

interface MetricCardProps {
  title: string;
  value: ReactNode;
  description?: string;
  icon?: ReactNode;
  tone?: MetricTone;
}

/** KPI 指标卡片：左侧低饱和图标块 + 右侧标题/指标/辅助文字。 */
export default function MetricCard({
  title,
  value,
  description,
  icon,
  tone = 'primary',
}: MetricCardProps) {
  const color = TONE_COLORS[tone];
  return (
    <Card
      style={{ height: '100%' }}
      styles={{ body: { padding: 18, display: 'flex', alignItems: 'center', gap: 14 } }}
    >
      {icon && (
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            background: color.bg,
            color: color.fg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
      )}
      <div style={{ minWidth: 0 }}>
        <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 4 }}>{title}</div>
        <div
          style={{
            fontSize: 26,
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            lineHeight: 1.1,
            color: 'var(--text-primary)',
          }}
        >
          {value}
        </div>
        {description && (
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>
            {description}
          </div>
        )}
      </div>
    </Card>
  );
}
