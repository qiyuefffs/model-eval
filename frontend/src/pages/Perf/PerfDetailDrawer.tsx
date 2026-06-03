import {
  App,
  Alert,
  Button,
  Descriptions,
  Drawer,
  Empty,
  Row,
  Col,
  Statistic,
  Space,
  Table,
  Tabs,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DownloadOutlined, FileMarkdownOutlined, Html5Outlined } from '@ant-design/icons';
import dayjs from 'dayjs';

import {
  downloadPerfTaskMetrics,
  downloadPerfTaskReport,
  usePerfTask,
  type PerfTaskRead,
} from '@/api/hooks/usePerfTasks';
import PerfStatusTag from './PerfStatusTag';

const { Text, Paragraph } = Typography;

interface Props {
  task?: PerfTaskRead;
  open: boolean;
  onClose: () => void;
}

function formatJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

interface MetricRow {
  key: string;
  metric: string;
  value: string;
}

function flattenMetrics(value: unknown, prefix = ''): MetricRow[] {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.entries(value).flatMap(([key, child]) =>
      flattenMetrics(child, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [
    {
      key: prefix,
      metric: prefix,
      value: value === null || value === undefined ? '—' : String(value),
    },
  ];
}

function asMetricObject(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

const metricColumns: ColumnsType<MetricRow> = [
  { title: '指标', dataIndex: 'metric', width: 240 },
  {
    title: '数值',
    dataIndex: 'value',
    render: (value: string) => <Text style={{ fontFamily: 'var(--font-mono)' }}>{value}</Text>,
  },
];

const jsonBlockStyle = {
  marginTop: 8,
  padding: 12,
  borderRadius: 8,
  background: 'rgba(2, 6, 23, 0.5)',
  border: '1px solid var(--border-subtle)',
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  whiteSpace: 'pre-wrap' as const,
};

export default function PerfDetailDrawer({ task, open, onClose }: Props) {
  const { message } = App.useApp();
  const { data: detail } = usePerfTask(open ? task?.id : undefined);
  const current = detail ?? task;
  const result = current?.result;
  const detailedMetrics = asMetricObject(result?.detailed_metrics);
  const clientMetrics = asMetricObject(detailedMetrics?.client);
  const serverMetrics = asMetricObject(detailedMetrics?.server);
  const serverAvailable = serverMetrics?.available === true;
  const serverReason =
    typeof serverMetrics?.reason === 'string'
      ? serverMetrics.reason
      : '请检查 /metrics 地址是否可访问。';

  const handleExport = async () => {
    if (!current) return;
    try {
      await downloadPerfTaskMetrics(current.id);
      message.success('完整性能指标表格已下载');
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '导出失败');
    }
  };

  const handleExportReport = async (format: 'markdown' | 'html') => {
    if (!current) return;
    try {
      await downloadPerfTaskReport(current.id, format);
      message.success(`精简指标矩阵（${format === 'html' ? 'HTML' : 'Markdown'}）已下载`);
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '导出失败');
    }
  };

  const overviewTab = current && (
    <Space direction="vertical" size={18} style={{ width: '100%' }}>
      {current.error_message && (
        <Alert type="error" showIcon message="任务失败" description={current.error_message} />
      )}

      <div>
        <Text type="secondary" style={{ fontSize: 12 }}>
          基础信息
        </Text>
        <Descriptions bordered size="small" column={1} style={{ marginTop: 8 }}>
          <Descriptions.Item label="模型">
            {current.model_name} <Text type="secondary">({current.model_id})</Text>
          </Descriptions.Item>
          <Descriptions.Item label="数据源">
            {current.perf_dataset}
            {current.custom_dataset_id ? ` · dataset #${current.custom_dataset_id}` : ''}
          </Descriptions.Item>
          <Descriptions.Item label="请求数 / 并发">
            {current.request_count} req / c{current.concurrency}
          </Descriptions.Item>
          <Descriptions.Item label="Rate">{current.rate}</Descriptions.Item>
          <Descriptions.Item label="最大 Token">{current.max_tokens}</Descriptions.Item>
          <Descriptions.Item label="Temperature">{current.temperature}</Descriptions.Item>
          <Descriptions.Item label="总超时（秒）">{current.total_timeout ?? '—'}</Descriptions.Item>
        </Descriptions>
      </div>

      <div>
        <Text type="secondary" style={{ fontSize: 12 }}>
          性能概览
        </Text>
        <Row gutter={[12, 12]} style={{ marginTop: 8 }}>
          <Col span={12}>
            <Statistic
              title="成功率"
              value={
                typeof result?.success_rate === 'number' ? result.success_rate * 100 : undefined
              }
              precision={2}
              suffix="%"
            />
          </Col>
          <Col span={12}>
            <Statistic
              title="吞吐"
              value={result?.total_token_throughput ?? undefined}
              precision={2}
              suffix="tok/s"
            />
          </Col>
          <Col span={12}>
            <Statistic
              title="平均 TTFT"
              value={result?.avg_ttft ?? undefined}
              precision={2}
              suffix="ms"
            />
          </Col>
          <Col span={12}>
            <Statistic
              title="平均 TPOT"
              value={result?.avg_tpot ?? undefined}
              precision={2}
              suffix="ms"
            />
          </Col>
        </Row>
      </div>

      <Descriptions bordered size="small" column={3}>
        <Descriptions.Item label="总请求">{result?.total_requests ?? '—'}</Descriptions.Item>
        <Descriptions.Item label="成功">{result?.succeed_requests ?? '—'}</Descriptions.Item>
        <Descriptions.Item label="失败">{result?.failed_requests ?? '—'}</Descriptions.Item>
      </Descriptions>
    </Space>
  );

  const metricsTab = current && (
    <Space direction="vertical" size={18} style={{ width: '100%' }}>
      {clientMetrics && (
        <div>
          <Text strong>客户端详细指标</Text>
          <Table<MetricRow>
            size="small"
            columns={metricColumns}
            dataSource={flattenMetrics(clientMetrics)}
            pagination={false}
            style={{ marginTop: 8 }}
          />
        </div>
      )}

      {serverMetrics && (
        <div>
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            <Text strong>vLLM 服务端指标</Text>
            {!serverAvailable && (
              <Alert
                type="info"
                showIcon
                message="未获取到 vLLM 服务端指标"
                description={serverReason}
              />
            )}
            <Table<MetricRow>
              size="small"
              columns={metricColumns}
              dataSource={flattenMetrics(serverMetrics)}
              pagination={false}
            />
          </Space>
        </div>
      )}

      <div>
        <Text strong>原始指标</Text>
        <Paragraph
          copyable={{ text: formatJson(result?.metrics ?? current.result_summary) }}
          style={jsonBlockStyle}
        >
          {formatJson(result?.metrics ?? current.result_summary)}
        </Paragraph>
      </div>

      <div>
        <Text strong>Percentile 摘要</Text>
        <Paragraph
          copyable={{ text: formatJson(result?.percentiles ?? current.percentile_summary) }}
          style={jsonBlockStyle}
        >
          {formatJson(result?.percentiles ?? current.percentile_summary)}
        </Paragraph>
      </div>
    </Space>
  );

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={560}
      title={
        current ? (
          <Space direction="vertical" size={2} style={{ width: '100%' }}>
            <Space align="center">
              <Text strong style={{ fontSize: 16 }}>
                {current.name}
              </Text>
              <PerfStatusTag status={current.status} />
            </Space>
            <Text type="secondary" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
              ID: #{current.id} · 创建于 {dayjs(current.created_at).format('YYYY-MM-DD HH:mm:ss')}
            </Text>
          </Space>
        ) : (
          '压测详情'
        )
      }
      extra={
        <Space>
          <Button
            size="small"
            icon={<FileMarkdownOutlined />}
            disabled={!result}
            onClick={() => handleExportReport('markdown')}
          >
            Markdown
          </Button>
          <Button
            size="small"
            icon={<Html5Outlined />}
            disabled={!result}
            onClick={() => handleExportReport('html')}
          >
            HTML
          </Button>
          <Button
            size="small"
            icon={<DownloadOutlined />}
            disabled={!result}
            onClick={handleExport}
          >
            CSV
          </Button>
        </Space>
      }
    >
      {!current ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="请选择任务" />
      ) : (
        <Tabs
          defaultActiveKey="overview"
          items={[
            { key: 'overview', label: '概览', children: overviewTab },
            { key: 'metrics', label: '性能指标', children: metricsTab },
            {
              key: 'requests',
              label: '请求详情',
              children: (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="逐请求明细暂未提供" />
              ),
            },
            {
              key: 'logs',
              label: '日志',
              children: current.log_path ? (
                <Paragraph copyable style={jsonBlockStyle}>
                  {current.log_path}
                </Paragraph>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无日志" />
              ),
            },
          ]}
        />
      )}
    </Drawer>
  );
}
