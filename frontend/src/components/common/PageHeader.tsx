import type { ReactNode } from 'react';
import { Typography } from 'antd';

const { Title, Text } = Typography;

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

/** 统一页面顶部：左侧标题 + 副标题，右侧操作按钮。 */
export default function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 16,
        marginBottom: 20,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <Title level={3} style={{ margin: 0, fontWeight: 600 }}>
          {title}
        </Title>
        {subtitle && (
          <Text type="secondary" style={{ fontSize: 13 }}>
            {subtitle}
          </Text>
        )}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>{actions}</div>}
    </div>
  );
}
