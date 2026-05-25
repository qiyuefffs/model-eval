import { Alert, Descriptions, Drawer, Empty, Row, Col, Statistic, Space, Typography } from 'antd';
import dayjs from 'dayjs';

import { usePerfTask, type PerfTaskRead } from '@/api/hooks/usePerfTasks';
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

function fmt(value: number | null | undefined, digits = 2) {
  return typeof value === 'number' ? value.toFixed(digits) : '—';
}

export default function PerfDetailDrawer({ task, open, onClose }: Props) {
  const { data: detail } = usePerfTask(open ? task?.id : undefined);
  const current = detail ?? task;
  const result = current?.result;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={820}
      title={
        <Space>
          <span>压测详情</span>
          {current && <PerfStatusTag status={current.status} />}
        </Space>
      }
    >
      {!current ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="请选择任务" />
      ) : (
        <Space direction="vertical" size={18} style={{ width: '100%' }}>
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="任务">{current.name}</Descriptions.Item>
            <Descriptions.Item label="模型">
              {current.model_name} <Text type="secondary">({current.model_id})</Text>
            </Descriptions.Item>
            <Descriptions.Item label="压测参数">
              请求 {current.request_count} · 并发 {current.concurrency} · rate {current.rate} · stream{' '}
              {current.stream ? 'on' : 'off'}
            </Descriptions.Item>
            <Descriptions.Item label="压测数据源">
              {current.perf_dataset}
              {current.custom_dataset_id ? ` · dataset #${current.custom_dataset_id}` : ''}
            </Descriptions.Item>
            <Descriptions.Item label="数据集路径">
              <Text style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{current.dataset_path ?? '—'}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="输出目录">
              <Text style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{current.work_dir ?? '—'}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="日志路径">
              <Text style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{current.log_path ?? '—'}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {dayjs(current.created_at).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="结束时间">
              {current.finished_at ? dayjs(current.finished_at).format('YYYY-MM-DD HH:mm:ss') : '—'}
            </Descriptions.Item>
          </Descriptions>

          {current.error_message && (
            <Alert type="error" showIcon message="任务失败" description={current.error_message} />
          )}

          <Row gutter={[12, 12]}>
            <Col xs={12} md={8}>
              <Statistic
                title="成功率"
                value={result?.success_rate !== null && result?.success_rate !== undefined ? result.success_rate * 100 : undefined}
                precision={2}
                suffix="%"
              />
            </Col>
            <Col xs={12} md={8}>
              <Statistic title="请求吞吐" value={result?.request_throughput ?? undefined} precision={2} suffix="req/s" />
            </Col>
            <Col xs={12} md={8}>
              <Statistic title="Token 吞吐" value={result?.total_token_throughput ?? undefined} precision={2} suffix="tok/s" />
            </Col>
            <Col xs={12} md={8}>
              <Statistic title="平均延迟" value={result?.avg_latency ?? undefined} precision={3} suffix="s" />
            </Col>
            <Col xs={12} md={8}>
              <Statistic title="TTFT" value={result?.avg_ttft ?? undefined} precision={2} suffix="ms" />
            </Col>
            <Col xs={12} md={8}>
              <Statistic title="TPOT" value={result?.avg_tpot ?? undefined} precision={2} suffix="ms" />
            </Col>
          </Row>

          <Descriptions bordered size="small" column={3}>
            <Descriptions.Item label="总请求">{result?.total_requests ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="成功">{result?.succeed_requests ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="失败">{result?.failed_requests ?? '—'}</Descriptions.Item>
          </Descriptions>

          <div>
            <Text strong>原始指标</Text>
            <Paragraph
              copyable={{ text: formatJson(result?.metrics ?? current.result_summary) }}
              style={{
                marginTop: 8,
                padding: 12,
                borderRadius: 8,
                background: 'rgba(0,0,0,0.18)',
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                whiteSpace: 'pre-wrap',
              }}
            >
              {formatJson(result?.metrics ?? current.result_summary)}
            </Paragraph>
          </div>

          <div>
            <Text strong>Percentile 摘要</Text>
            <Paragraph
              copyable={{ text: formatJson(result?.percentiles ?? current.percentile_summary) }}
              style={{
                marginTop: 8,
                padding: 12,
                borderRadius: 8,
                background: 'rgba(0,0,0,0.18)',
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                whiteSpace: 'pre-wrap',
              }}
            >
              {formatJson(result?.percentiles ?? current.percentile_summary)}
            </Paragraph>
          </div>

          <Text type="secondary" style={{ fontSize: 12 }}>
            摘要：吞吐 {fmt(result?.request_throughput)} req/s，TTFT {fmt(result?.avg_ttft)} ms，TPOT{' '}
            {fmt(result?.avg_tpot)} ms。
          </Text>
        </Space>
      )}
    </Drawer>
  );
}
