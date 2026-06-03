import { useMemo, useState } from 'react';
import { Alert, Button, Card, Empty, Input, Select, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  AimOutlined,
  ExperimentOutlined,
  EyeOutlined,
  PlusOutlined,
  ProfileOutlined,
  ReloadOutlined,
  SearchOutlined,
  SlidersOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

import { useBenchmarks, useCustomDatasets } from '@/api/hooks/useDatasets';
import { useEvalTasks, type EvalTaskRead, type EvalTaskStatus } from '@/api/hooks/useEvalTasks';
import { useModels } from '@/api/hooks/useModels';
import PageHeader from '@/components/common/PageHeader';
import MetricCard from '@/components/common/MetricCard';
import TaskDetailDrawer from '@/pages/Tasks/TaskDetailDrawer';
import { EvalTaskStatusTag } from '@/pages/Tasks/status';
import { evalTaskStatusOptions } from '@/pages/Tasks/statusMeta';
import EvalCreateDrawer from './EvalCreateDrawer';

const { Text } = Typography;

function fmt(value: number | null | undefined, digits = 4) {
  return typeof value === 'number' ? value.toFixed(digits) : '—';
}

function firstScore(task: EvalTaskRead) {
  return task.results?.find((item) => item.score !== null)?.score ?? null;
}

export default function EvalPage() {
  const { data: models = [], isFetching: modelsFetching, refetch: refetchModels } = useModels();
  const {
    data: benchmarks = [],
    isFetching: benchmarksFetching,
    refetch: refetchBenchmarks,
  } = useBenchmarks();
  const {
    data: datasets = [],
    isFetching: datasetsFetching,
    refetch: refetchDatasets,
  } = useCustomDatasets();
  const {
    data: tasks = [],
    isFetching: tasksFetching,
    isLoading,
    refetch: refetchTasks,
  } = useEvalTasks();

  const [selectedTask, setSelectedTask] = useState<EvalTaskRead>();
  const [status, setStatus] = useState<EvalTaskStatus>();
  const [keyword, setKeyword] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const loading = modelsFetching || benchmarksFetching || datasetsFetching || tasksFetching;

  const refreshAll = () => {
    refetchModels();
    refetchBenchmarks();
    refetchDatasets();
    refetchTasks();
  };

  const visibleTasks = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return tasks.filter((task) => {
      if (status && task.status !== status) return false;
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
  }, [keyword, status, tasks]);

  const stats = useMemo(() => {
    const latestSucceeded = tasks.find(
      (task) => task.status === 'succeeded' && firstScore(task) !== null,
    );
    return {
      total: tasks.length,
      running: tasks.filter((task) => task.status === 'running' || task.status === 'pending')
        .length,
      latestScore: latestSucceeded ? firstScore(latestSucceeded) : null,
    };
  }, [tasks]);

  const columns: ColumnsType<EvalTaskRead> = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 70,
      render: (id: number) => (
        <Text style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>#{id}</Text>
      ),
    },
    {
      title: '任务',
      dataIndex: 'name',
      render: (name: string, record) => (
        <Space direction="vertical" size={2}>
          <Text strong>{name}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.description || '—'}
          </Text>
          {record.tags.length > 0 && (
            <Space size={4} wrap>
              {record.tags.map((tag) => (
                <Tag key={tag} style={{ marginInlineEnd: 0 }}>
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
        <Space direction="vertical" size={2}>
          <Text>{modelName}</Text>
          <Text
            style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}
          >
            {record.model_id}
          </Text>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (value: EvalTaskStatus) => <EvalTaskStatusTag status={value} />,
    },
    {
      title: '数据集',
      key: 'datasets',
      width: 180,
      render: (_, record) => (
        <Space size={4} wrap>
          {record.benchmark_names.map((name) => (
            <Tag key={name}>{name}</Tag>
          ))}
          {record.custom_dataset_ids.map((id) => (
            <Tag key={id} color="blue">
              #{id}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '分数',
      key: 'score',
      width: 120,
      render: (_, record) => (
        <Text style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>
          {fmt(firstScore(record))}
        </Text>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 150,
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
      width: 90,
      render: (_, record) => (
        <Button
          size="small"
          type="link"
          icon={<EyeOutlined />}
          onClick={() => setSelectedTask(record)}
        >
          详情
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="质量评测"
        subtitle="选择模型、benchmark 与数据集，提交后由后台队列调用 EvalScope 执行。"
        actions={
          <>
            <Button icon={<ReloadOutlined />} loading={loading} onClick={refreshAll}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
              新建评测
            </Button>
          </>
        }
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: 16,
          marginBottom: 16,
        }}
      >
        <MetricCard
          icon={<ProfileOutlined />}
          tone="primary"
          title="已建任务"
          value={stats.total}
          description="评测任务总数"
        />
        <MetricCard
          icon={<ThunderboltOutlined />}
          tone="warning"
          title="队列中"
          value={stats.running}
          description="运行 / 等待"
        />
        <MetricCard
          icon={<AimOutlined />}
          tone="success"
          title="最近分数"
          value={fmt(stats.latestScore)}
          description="最新完成任务"
        />
      </div>

      <Card>
        <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }} wrap>
          <Input
            placeholder="搜索任务 / 模型"
            prefix={<SearchOutlined />}
            allowClear
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            style={{ width: 280 }}
          />
          <Select
            allowClear
            placeholder="任务状态"
            value={status}
            onChange={setStatus}
            options={evalTaskStatusOptions}
            style={{ width: 150 }}
          />
        </Space>

        <Table<EvalTaskRead>
          rowKey="id"
          loading={isLoading}
          columns={columns}
          dataSource={visibleTasks}
          tableLayout="fixed"
          scroll={{ x: 1100 }}
          pagination={{
            pageSize: 10,
            showTotal: (total) => `共 ${total} 个评测任务`,
            showSizeChanger: false,
          }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={<Text type="secondary">暂无评测任务，点击右上角新建评测</Text>}
              />
            ),
          }}
        />

        <Alert
          type="info"
          showIcon
          style={{ marginTop: 16 }}
          message={
            <Space>
              <ExperimentOutlined />
              <span>执行说明</span>
            </Space>
          }
          description={
            <Space direction="vertical" size={8}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                任务提交后立即进入后端 asyncio 队列；运行中任务会自动轮询刷新。
              </Text>
              <Space size={6} wrap>
                <Tag style={{ fontFamily: 'var(--font-mono)' }}>
                  <SlidersOutlined /> 模型 · {models.length}
                </Tag>
                <Tag style={{ fontFamily: 'var(--font-mono)' }}>
                  benchmark · {benchmarks.length}
                </Tag>
                <Tag style={{ fontFamily: 'var(--font-mono)' }}>自定义 · {datasets.length}</Tag>
              </Space>
            </Space>
          }
        />
      </Card>

      <EvalCreateDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        models={models}
        benchmarks={benchmarks}
        datasets={datasets}
        onCreated={refetchTasks}
      />

      <TaskDetailDrawer
        task={selectedTask}
        open={Boolean(selectedTask)}
        onClose={() => setSelectedTask(undefined)}
      />
    </div>
  );
}
