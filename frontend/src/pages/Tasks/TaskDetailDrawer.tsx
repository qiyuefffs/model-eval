import { Alert, Descriptions, Drawer, Empty, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

import { useEvalTask, type EvalResultRead, type EvalTaskRead } from '@/api/hooks/useEvalTasks';
import { EvalTaskStatusTag } from './status';

const { Text, Paragraph } = Typography;

interface Props {
  task?: EvalTaskRead;
  open: boolean;
  onClose: () => void;
}

function formatJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

export default function TaskDetailDrawer({ task, open, onClose }: Props) {
  const { data: detail, isFetching } = useEvalTask(open ? task?.id : undefined);
  const current = detail ?? task;

  const columns: ColumnsType<EvalResultRead> = [
    {
      title: '数据集',
      dataIndex: 'dataset_name',
      render: (name: string) => <Text style={{ fontFamily: 'var(--font-mono)' }}>{name}</Text>,
    },
    {
      title: '主指标',
      dataIndex: 'metric_name',
      width: 140,
      render: (name: string | null) => name ?? '—',
    },
    {
      title: '分数',
      dataIndex: 'score',
      width: 120,
      render: (score: number | null) =>
        score === null ? (
          <Text type="secondary">—</Text>
        ) : (
          <Text style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>
            {score.toFixed(4)}
          </Text>
        ),
    },
    {
      title: '指标 JSON',
      dataIndex: 'metrics',
      render: (metrics: Record<string, unknown>) => (
        <Paragraph
          copyable={{ text: formatJson(metrics) }}
          style={{ margin: 0, maxWidth: 360, fontFamily: 'var(--font-mono)', fontSize: 12 }}
          ellipsis={{ rows: 2, expandable: true, symbol: '展开' }}
        >
          {formatJson(metrics)}
        </Paragraph>
      ),
    },
  ];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={760}
      title={
        <Space>
          <span>任务详情</span>
          {current && <EvalTaskStatusTag status={current.status} />}
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
            <Descriptions.Item label="数据范围">
              <Space size={4} wrap>
                {current.benchmark_names.map((name) => (
                  <Tag key={name}>{name}</Tag>
                ))}
                {current.custom_dataset_ids.map((id) => (
                  <Tag key={id} color="blue">
                    dataset #{id}
                  </Tag>
                ))}
              </Space>
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

          <div>
            <Text strong>结果摘要</Text>
            <Table<EvalResultRead>
              rowKey="id"
              size="small"
              loading={isFetching}
              columns={columns}
              dataSource={current.results ?? []}
              pagination={false}
              style={{ marginTop: 8 }}
              locale={{
                emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无结果摘要" />,
              }}
            />
          </div>

          <div>
            <Text strong>日志流</Text>
            <Alert
              type="info"
              showIcon
              style={{ marginTop: 8 }}
              message="任务日志已记录"
              description={current.log_path ? `日志文件：${current.log_path}` : '当前任务暂无日志文件路径。'}
            />
          </div>

          <div>
            <Text strong>原始 result_summary</Text>
            <Paragraph
              copyable={{ text: formatJson(current.result_summary) }}
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
              {formatJson(current.result_summary)}
            </Paragraph>
          </div>
        </Space>
      )}
    </Drawer>
  );
}
