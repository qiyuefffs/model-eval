import { Empty, Typography } from 'antd';
import { motion } from 'framer-motion';

const { Title, Text } = Typography;

interface Props {
  title: string;
  stage: string;
  description: string;
}

/** 阶段占位页：在对应阶段实现前，统一显示"即将上线"提示。 */
export default function Placeholder({ title, stage, description }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{
        padding: 48,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 64px)',
      }}
    >
      <Title level={3} style={{ color: 'var(--text-primary)', marginBottom: 4 }}>
        {title}
      </Title>
      <Text
        style={{
          fontFamily: 'var(--font-mono)',
          color: 'var(--accent-info)',
          fontSize: 12,
          marginBottom: 24,
        }}
      >
        // {stage}
      </Text>
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <Text type="secondary" style={{ maxWidth: 480, display: 'block' }}>
            {description}
          </Text>
        }
      />
    </motion.div>
  );
}
