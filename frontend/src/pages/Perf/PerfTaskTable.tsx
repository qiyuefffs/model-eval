import { useMemo, useState } from 'react';
import { Button, Card, Empty, Input, Select, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { EyeOutlined, RedoOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

import type { PerfTaskRead, PerfTaskStatus } from '@/api/hooks/usePerfTasks';
import PerfStatusTag from './PerfStatusTag';

const { Text } = Typography;

const STATUS_FILTER_OPTIONS: { value: PerfTaskStatus; label: string }[] = [
  { value: 'succeeded', label: '已完成' },
  { value: 'running', label: '运行中' },
  { value: 'failed', label: '失败' },
  { value: 'pending', label: '排队中' },
];

function fmt(value: number | null | undefined, digits = 2) {
  return typeof value === 'number' ? value.toFixed(digits) : '—';
}

interface PerfTaskTableProps {
  tasks: PerfTaskRead[];
  loading?: boolean;
  onDetail: (task: PerfTaskRead) => void;
  onRerun: (task: PerfTaskRead) => void;
}

export default function PerfTaskTable({ tasks, loading, onDetail, onRerun }: PerfTaskTableProps) {
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<PerfTaskStatus>();
  const [modelName, setModelName] = useState<string>();

  const modelOptions = useMemo(
    () =>
      Array.from(new Set(tasks.map((task) => task.model_name))).map((name) => ({
        value: name,
        label: name,
      })),
    [tasks],
  );

  const visibleTasks = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return tasks.filter((task) => {
      if (status && task.status !== status) return false;
      if (modelName && task.model_name !== modelName) return false;
      if (
        q &&
        !task.name.toLowerCase().includes(q) &&
        !task.model_name.toLowerCase().includes(q) &&
        !task.model_id.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [keyword, status, modelName, tasks]);

  const columns: ColumnsType<PerfTaskRead> = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 60,
      render: (id: number) => (
        <Text style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>#{id}</Text>
      ),
    },
    {
      title: '任务名称',
      dataIndex: 'name',
      width: 200,
      render: (name: string, record) => (
        <Space direction="vertical" size={2} style={{ width: '100%' }}>
          <Text strong ellipsis={{ tooltip: name }} style={{ maxWidth: 180 }}>
            {name}
          </Text>
          {record.tags.length > 0 && (
            <Space size={4} wrap>
              {record.tags.slice(0, 3).map((tag) => (
                <Tag key={tag} style={{ marginInlineEnd: 0, fontSize: 11 }}>
                  {tag}
                </Tag>
              ))}
            </Space>
          )}
        </Space>
      ),
    },
    {
      title: '模型',
      dataIndex: 'model_name',
      width: 220,
      render: (modelName: string, record) => (
        <Space direction="vertical" size={2} style={{ width: '100%' }}>
          <Text ellipsis={{ tooltip: modelName }} style={{ maxWidth: 200 }}>
            {modelName}
          </Text>
          <Text
            ellipsis={{ tooltip: record.model_id }}
            style={{
              maxWidth: 200,
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: 'var(--text-muted)',
            }}
          >
            {record.model_id}
          </Text>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 96,
      render: (value: PerfTaskStatus) => <PerfStatusTag status={value} />,
    },
    {
      title: '请求数 / 并发',
      key: 'pressure',
      width: 120,
      render: (_, record) => (
        <Text style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
          {record.request_count} req / c{record.concurrency}
        </Text>
      ),
    },
    {
      title: 'Rate',
      dataIndex: 'rate',
      width: 80,
      render: (rate: number) => (
        <Text style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{rate}</Text>
      ),
    },
    {
      title: '成功率',
      key: 'successRate',
      width: 90,
      render: (_, record) => (
        <Text style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
          {typeof record.result?.success_rate === 'number'
            ? `${(record.result.success_rate * 100).toFixed(1)}%`
            : '—'}
        </Text>
      ),
    },
    {
      title: '平均 TTFT',
      key: 'ttft',
      width: 100,
      render: (_, record) => (
        <Text style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
          {fmt(record.result?.avg_ttft)}
        </Text>
      ),
    },
    {
      title: '平均 TPOT',
      key: 'tpot',
      width: 100,
      render: (_, record) => (
        <Text style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
          {fmt(record.result?.avg_tpot)}
        </Text>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 140,
      render: (ts: string) => (
        <Text style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>
          {dayjs(ts).format('MM-DD HH:mm')}
        </Text>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      fixed: 'right',
      width: 130,
      render: (_, record) => (
        <Space size={0}>
          <Button size="small" type="link" icon={<EyeOutlined />} onClick={() => onDetail(record)}>
            详情
          </Button>
          <Button size="small" type="link" icon={<RedoOutlined />} onClick={() => onRerun(record)}>
            复跑
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Card>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }} wrap>
        <Input
          placeholder="搜索任务名称 / 模型"
          allowClear
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          style={{ width: 280 }}
        />
        <Space wrap>
          <Select
            allowClear
            placeholder="状态：全部"
            value={status}
            onChange={setStatus}
            options={STATUS_FILTER_OPTIONS}
            style={{ width: 150 }}
          />
          <Select
            allowClear
            showSearch
            placeholder="模型：全部"
            value={modelName}
            onChange={setModelName}
            options={modelOptions}
            optionFilterProp="label"
            style={{ width: 200 }}
          />
        </Space>
      </Space>

      <Table<PerfTaskRead>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={visibleTasks}
        tableLayout="fixed"
        scroll={{ x: 1340 }}
        pagination={{
          pageSize: 10,
          showTotal: (total) => `共 ${total} 条`,
          showSizeChanger: false,
        }}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="暂无压测任务，点击右上角新建压测"
            />
          ),
        }}
      />
    </Card>
  );
}
