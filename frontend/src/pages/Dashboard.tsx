import { Card, Skeleton, Space, Tag, Typography } from 'antd';
import {
  ApiOutlined,
  CheckCircleFilled,
  CheckCircleOutlined,
  CloseCircleFilled,
  DatabaseOutlined,
  ExperimentOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useHealth } from '@/api/hooks/useHealth';
import { useModels } from '@/api/hooks/useModels';
import { useBenchmarks } from '@/api/hooks/useDatasets';
import { useEvalTasks } from '@/api/hooks/useEvalTasks';
import { usePerfTasks } from '@/api/hooks/usePerfTasks';
import PageHeader from '@/components/common/PageHeader';
import MetricCard, { type MetricTone } from '@/components/common/MetricCard';

const { Text } = Typography;
const RUNNING_STATUSES = new Set(['pending', 'running']);

/**
 * Dashboard — 平台首页概览。
 * 展示后端连通状态和关键资源/任务统计。
 */
export default function Dashboard() {
  const { data: health, isLoading, isError } = useHealth();
  const { data: models } = useModels();
  const { data: benchmarks } = useBenchmarks();
  const { data: evalTasks } = useEvalTasks();
  const { data: perfTasks } = usePerfTasks();
  const allTasks = [...(evalTasks ?? []), ...(perfTasks ?? [])];
  const runningTasks = allTasks.filter((task) => RUNNING_STATUSES.has(task.status)).length;
  const completedTasks = allTasks.filter((task) => task.status === 'succeeded').length;

  const stats: {
    icon: React.ReactNode;
    title: string;
    value: number;
    description: string;
    tone: MetricTone;
  }[] = [
    {
      icon: <DatabaseOutlined />,
      title: '已注册模型',
      value: models?.length ?? 0,
      description: '模型总数',
      tone: 'info',
    },
    {
      icon: <ExperimentOutlined />,
      title: '内置评测基准',
      value: benchmarks?.length ?? 0,
      description: '基准总数',
      tone: 'primary',
    },
    {
      icon: <ThunderboltOutlined />,
      title: '运行中任务',
      value: runningTasks,
      description: '评测 + 压测',
      tone: 'warning',
    },
    {
      icon: <CheckCircleOutlined />,
      title: '历史评测',
      value: completedTasks,
      description: '已完成任务',
      tone: 'success',
    },
  ];

  return (
    <div>
      <PageHeader
        title="ModelGauge"
        subtitle="模型质量、性能与历史趋势，汇聚于一个清晰的评估工作台。"
      />

      <Card
        style={{ marginBottom: 16 }}
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
                ./scripts/start-dev.sh
              </Text>
            </Text>
          </Space>
        ) : (
          <Space size="large" wrap>
            <Space>
              <CheckCircleFilled style={{ color: 'var(--accent-success)', fontSize: 18 }} />
              <Text strong style={{ color: 'var(--accent-success)' }}>
                在线
              </Text>
            </Space>
            <Space>
              <Text type="secondary">应用名：</Text>
              <Tag>{health?.app_name}</Tag>
            </Space>
            <Space>
              <Text type="secondary">版本：</Text>
              <Tag style={{ fontFamily: 'var(--font-mono)' }}>v{health?.version}</Tag>
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

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: 16,
        }}
      >
        {stats.map((stat) => (
          <MetricCard
            key={stat.title}
            icon={stat.icon}
            title={stat.title}
            value={stat.value}
            description={stat.description}
            tone={stat.tone}
          />
        ))}
      </div>
    </div>
  );
}
