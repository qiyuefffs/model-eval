import { Badge, Card, Col, Row, Skeleton, Space, Statistic, Tag, Typography } from 'antd';
import { motion } from 'framer-motion';
import {
  ApiOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  DatabaseOutlined,
  ExperimentOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useHealth } from '@/api/hooks/useHealth';

const { Title, Paragraph, Text } = Typography;

const cardMotion = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

/**
 * Dashboard — 平台首页
 *
 * 阶段 0 仅展示：后端连通状态 + 占位统计卡片。
 * 后续阶段会替换为真实数据（任务数、模型数、运行中任务等）。
 */
export default function Dashboard() {
  const { data: health, isLoading, isError } = useHealth();

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* 标题区 */}
      <motion.div {...cardMotion} transition={{ duration: 0.4 }}>
        <Space direction="vertical" size={4} style={{ marginBottom: 32 }}>
          <Title level={2} style={{ margin: 0, color: 'var(--text-primary)' }}>
            EvalPlatform
          </Title>
          <Paragraph
            style={{
              margin: 0,
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
            }}
          >
            // 基于 EvalScope 的模型评估平台 · 质量评测 + 性能压测 + 历史对比
          </Paragraph>
        </Space>
      </motion.div>

      {/* 后端连通状态卡片 */}
      <motion.div {...cardMotion} transition={{ duration: 0.4, delay: 0.1 }}>
        <Card
          style={{ marginBottom: 24, borderColor: 'var(--border-subtle)' }}
          title={
            <Space>
              <ApiOutlined />
              <span>后端服务状态</span>
            </Space>
          }
        >
          {isLoading ? (
            <Skeleton active paragraph={{ rows: 2 }} />
          ) : isError ? (
            <Space direction="vertical" size="small">
              <Space>
                <CloseCircleFilled style={{ color: 'var(--accent-danger)', fontSize: 18 }} />
                <Text strong style={{ color: 'var(--accent-danger)' }}>
                  无法连接到后端
                </Text>
              </Space>
              <Text type="secondary" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                请确认后端服务已启动：
                <Text code copyable style={{ marginLeft: 8 }}>
                  cd backend && uv run uvicorn main:app --reload --port 8000
                </Text>
              </Text>
            </Space>
          ) : (
            <Space size="large" wrap>
              <Space>
                <CheckCircleFilled style={{ color: 'var(--accent-primary)', fontSize: 18 }} />
                <Text strong style={{ color: 'var(--accent-primary)' }}>
                  在线
                </Text>
              </Space>
              <Space>
                <Text type="secondary">应用名：</Text>
                <Tag color="default">{health?.app_name}</Tag>
              </Space>
              <Space>
                <Text type="secondary">版本：</Text>
                <Tag color="green" style={{ fontFamily: 'var(--font-mono)' }}>
                  v{health?.version}
                </Tag>
              </Space>
              <Space>
                <Text type="secondary">心跳时间：</Text>
                <Text style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                  {health?.timestamp}
                </Text>
              </Space>
            </Space>
          )}
        </Card>
      </motion.div>

      {/* 占位统计卡片（阶段 1+ 会替换为真实数据） */}
      <Row gutter={[16, 16]}>
        {[
          {
            icon: <DatabaseOutlined />,
            title: '已注册模型',
            value: 0,
            color: 'var(--accent-info)',
            delay: 0.15,
          },
          {
            icon: <ExperimentOutlined />,
            title: '内置评测基准',
            value: 123,
            suffix: '+',
            color: 'var(--accent-primary)',
            delay: 0.2,
          },
          {
            icon: <ThunderboltOutlined />,
            title: '运行中任务',
            value: 0,
            color: 'var(--accent-warning)',
            delay: 0.25,
          },
          {
            icon: <Badge status="default" />,
            title: '历史评测',
            value: 0,
            color: 'var(--text-secondary)',
            delay: 0.3,
          },
        ].map((stat) => (
          <Col key={stat.title} xs={24} sm={12} lg={6}>
            <motion.div {...cardMotion} transition={{ duration: 0.4, delay: stat.delay }}>
              <Card hoverable style={{ borderColor: 'var(--border-subtle)' }}>
                <Statistic
                  title={
                    <Space style={{ color: 'var(--text-secondary)' }}>
                      <span style={{ color: stat.color }}>{stat.icon}</span>
                      {stat.title}
                    </Space>
                  }
                  value={stat.value}
                  suffix={stat.suffix}
                  valueStyle={{
                    color: stat.color,
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 600,
                  }}
                />
              </Card>
            </motion.div>
          </Col>
        ))}
      </Row>

      {/* 阶段提示 */}
      <motion.div {...cardMotion} transition={{ duration: 0.4, delay: 0.4 }}>
        <Card
          style={{
            marginTop: 24,
            borderColor: 'var(--border-subtle)',
            background:
              'linear-gradient(135deg, rgba(80,200,120,0.05) 0%, rgba(106,183,255,0.03) 100%)',
          }}
        >
          <Space direction="vertical" size="small">
            <Text strong style={{ fontFamily: 'var(--font-mono)' }}>
              🚧 阶段 0：双端脚手架就绪
            </Text>
            <Text type="secondary" style={{ fontSize: 13 }}>
              后端 FastAPI 健康检查接口已通；下一阶段将实现：数据库 schema、模型注册管理 API
              与可视化页面。
            </Text>
          </Space>
        </Card>
      </motion.div>
    </div>
  );
}
