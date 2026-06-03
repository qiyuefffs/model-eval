import { useMemo, useState } from 'react';
import { Button, Card, Col, Empty, Input, Row, Select, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  AlertOutlined,
  CheckCircleOutlined,
  EyeOutlined,
  FieldTimeOutlined,
  ReloadOutlined,
  SearchOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';

import { useEvalTasks, type EvalTaskRead, type EvalTaskStatus } from '@/api/hooks/useEvalTasks';
import { usePerfTasks, type PerfTaskRead } from '@/api/hooks/usePerfTasks';
import PerfDetailDrawer from '@/pages/Perf/PerfDetailDrawer';
import PageHeader from '@/components/common/PageHeader';
import MetricCard, { type MetricTone } from '@/components/common/MetricCard';
import { EvalTaskStatusTag } from './status';
import { evalTaskStatusOptions } from './statusMeta';
import TaskDetailDrawer from './TaskDetailDrawer';

const { Text } = Typography;

type TaskKind = 'eval' | 'perf';

interface UnifiedTask {
  key: string;
  kind: TaskKind;
  id: number;
  name: string;
  model_name: string;
  model_id: string;
  status: EvalTaskStatus;
  created_at: string;
  finished_at?: string | null;
  description?: string | null;
  metric: string;
  source: EvalTaskRead | PerfTaskRead;
}

const taskKindOptions = [
  { value: 'eval', label: '质量评测' },
  { value: 'perf', label: '性能压测' },
];

function firstEvalScore(task: EvalTaskRead) {
  return task.results?.find((item) => item.score !== null)?.score ?? null;
}

function toMetric(task: EvalTaskRead | PerfTaskRead, kind: TaskKind) {
  if (kind === 'eval') {
    const score = firstEvalScore(task as EvalTaskRead);
    return score === null ? '—' : score.toFixed(4);
  }
  const result = (task as PerfTaskRead).result;
  return typeof result?.request_throughput === 'number'
    ? `${result.request_throughput.toFixed(2)} req/s`
    : '—';
}

export default function TasksPage() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<EvalTaskStatus>();
  const [kind, setKind] = useState<TaskKind>();
  const [selectedEvalTask, setSelectedEvalTask] = useState<EvalTaskRead>();
  const [selectedPerfTask, setSelectedPerfTask] = useState<PerfTaskRead>();
  const {
    data: evalTasks = [],
    isFetching: evalFetching,
    isLoading: evalLoading,
    refetch: refetchEvalTasks,
  } = useEvalTasks();
  const {
    data: perfTasks = [],
    isFetching: perfFetching,
    isLoading: perfLoading,
    refetch: refetchPerfTasks,
  } = usePerfTasks();

  const tasks = useMemo<UnifiedTask[]>(() => {
    const evalRows = evalTasks.map<UnifiedTask>((task) => ({
      key: `eval-${task.id}`,
      kind: 'eval',
      id: task.id,
      name: task.name,
      model_name: task.model_name,
      model_id: task.model_id,
      status: task.status,
      created_at: task.created_at,
      finished_at: task.finished_at,
      description: task.description,
      metric: toMetric(task, 'eval'),
      source: task,
    }));
    const perfRows = perfTasks.map<UnifiedTask>((task) => ({
      key: `perf-${task.id}`,
      kind: 'perf',
      id: task.id,
      name: task.name,
      model_name: task.model_name,
      model_id: task.model_id,
      status: task.status,
      created_at: task.created_at,
      finished_at: task.finished_at,
      description: task.description,
      metric: toMetric(task, 'perf'),
      source: task,
    }));
    return [...evalRows, ...perfRows].sort(
      (a, b) => dayjs(b.created_at).valueOf() - dayjs(a.created_at).valueOf(),
    );
  }, [evalTasks, perfTasks]);

  const stats = useMemo(() => {
    return {
      active: tasks.filter((task) => task.status === 'pending' || task.status === 'running').length,
      failed: tasks.filter((task) => task.status === 'failed').length,
      completed: tasks.filter((task) => task.status === 'succeeded').length,
      total: tasks.length,
    };
  }, [tasks]);

  const activeTasks = useMemo(
    () =>
      tasks.filter((task) => task.status === 'pending' || task.status === 'running').slice(0, 8),
    [tasks],
  );
  const failedTasks = useMemo(
    () => tasks.filter((task) => task.status === 'failed').slice(0, 8),
    [tasks],
  );
  const completedTasks = useMemo(
    () => tasks.filter((task) => task.status === 'succeeded').slice(0, 8),
    [tasks],
  );

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return tasks.filter((task) => {
      if (kind && task.kind !== kind) return false;
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
  }, [keyword, kind, status, tasks]);

  const refetch = () => {
    refetchEvalTasks();
    refetchPerfTasks();
  };

  const openDetail = (task: UnifiedTask) => {
    if (task.kind === 'eval') {
      setSelectedEvalTask(task.source as EvalTaskRead);
      return;
    }
    setSelectedPerfTask(task.source as PerfTaskRead);
  };

  const goSource = (task: UnifiedTask) => {
    navigate(task.kind === 'eval' ? '/eval' : '/perf');
  };

  const columns: ColumnsType<UnifiedTask> = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 90,
      render: (id: number, record) => (
        <Text style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
          {record.kind === 'eval' ? 'E' : 'P'}#{id}
        </Text>
      ),
    },
    {
      title: '任务',
      dataIndex: 'name',
      width: 260,
      render: (name: string, record) => (
        <Space direction="vertical" size={2} style={{ width: '100%' }}>
          <Text strong ellipsis={{ tooltip: name }} style={{ maxWidth: 240 }}>
            {name}
          </Text>
          <Text
            type="secondary"
            ellipsis={{ tooltip: record.description || '—' }}
            style={{ maxWidth: 240, fontSize: 12 }}
          >
            {record.description || '—'}
          </Text>
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'kind',
      width: 110,
      render: (value: TaskKind) => (
        <Tag color={value === 'eval' ? 'green' : 'blue'}>
          {value === 'eval' ? '质量评测' : '性能压测'}
        </Tag>
      ),
    },
    {
      title: '模型',
      dataIndex: 'model_name',
      width: 260,
      render: (modelName: string, record) => (
        <Space direction="vertical" size={2} style={{ width: '100%' }}>
          <Text ellipsis={{ tooltip: modelName }} style={{ maxWidth: 240 }}>
            {modelName}
          </Text>
          <Text
            ellipsis={{ tooltip: record.model_id }}
            style={{
              maxWidth: 240,
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: 'var(--accent-info)',
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
      width: 110,
      render: (value: EvalTaskStatus) => <EvalTaskStatusTag status={value} />,
    },
    {
      title: '关键指标',
      dataIndex: 'metric',
      width: 130,
      render: (value: string) => (
        <Text style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>
          {value}
        </Text>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 160,
      render: (ts: string) => (
        <Text style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>
          {dayjs(ts).format('YYYY-MM-DD HH:mm')}
        </Text>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      fixed: 'right',
      width: 170,
      render: (_, record) => (
        <Space size={4}>
          <Button
            size="small"
            type="text"
            icon={<EyeOutlined />}
            onClick={() => openDetail(record)}
          >
            详情
          </Button>
          <Button size="small" type="link" onClick={() => goSource(record)}>
            来源
          </Button>
        </Space>
      ),
    },
  ];

  const compactColumns: ColumnsType<UnifiedTask> = [
    {
      title: '任务',
      dataIndex: 'name',
      render: (name: string, record) => (
        <Space direction="vertical" size={2}>
          <Space size={6}>
            <Tag color={record.kind === 'eval' ? 'green' : 'blue'}>
              {record.kind === 'eval' ? '质量' : '压测'}
            </Tag>
            <Text strong ellipsis={{ tooltip: name }} style={{ maxWidth: 220 }}>
              {name}
            </Text>
          </Space>
          <Text type="secondary" style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}>
            {record.model_name} · {dayjs(record.created_at).format('MM-DD HH:mm')}
          </Text>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 96,
      render: (value: EvalTaskStatus) => <EvalTaskStatusTag status={value} />,
    },
    {
      title: '指标',
      dataIndex: 'metric',
      width: 120,
      render: (value: string) => (
        <Text style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>
          {value}
        </Text>
      ),
    },
  ];

  const loading = evalLoading || perfLoading;
  const fetching = evalFetching || perfFetching;

  const kpiCards: { label: string; value: number; icon: React.ReactNode; tone: MetricTone }[] = [
    { label: '运行 / 队列', value: stats.active, icon: <ThunderboltOutlined />, tone: 'warning' },
    { label: '失败待处理', value: stats.failed, icon: <AlertOutlined />, tone: 'danger' },
    { label: '最近完成', value: stats.completed, icon: <CheckCircleOutlined />, tone: 'success' },
    { label: '全部任务', value: stats.total, icon: <FieldTimeOutlined />, tone: 'info' },
  ];

  return (
    <div>
      <PageHeader
        title="任务中心"
        subtitle="聚合质量评测与性能压测的运行态、失败诊断和最近完成任务。"
        actions={
          <Button icon={<ReloadOutlined />} loading={fetching} onClick={refetch}>
            刷新
          </Button>
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
        {kpiCards.map((item) => (
          <MetricCard
            key={item.label}
            icon={item.icon}
            title={item.label}
            value={item.value}
            tone={item.tone}
          />
        ))}
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={8}>
          <Card title="运行队列">
            <Table<UnifiedTask>
              rowKey="key"
              size="small"
              className="task-center-panel-table"
              columns={compactColumns}
              dataSource={activeTasks}
              pagination={false}
              scroll={{ y: 292 }}
              locale={{
                emptyText: (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前没有运行中任务" />
                ),
              }}
              onRow={(record) => ({ onClick: () => openDetail(record) })}
            />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="失败诊断">
            <Table<UnifiedTask>
              rowKey="key"
              size="small"
              className="task-center-panel-table"
              columns={compactColumns}
              dataSource={failedTasks}
              pagination={false}
              scroll={{ y: 292 }}
              locale={{
                emptyText: (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无失败任务" />
                ),
              }}
              onRow={(record) => ({ onClick: () => openDetail(record) })}
            />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="最近完成">
            <Table<UnifiedTask>
              rowKey="key"
              size="small"
              className="task-center-panel-table"
              columns={compactColumns}
              dataSource={completedTasks}
              pagination={false}
              scroll={{ y: 292 }}
              locale={{
                emptyText: (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无完成任务" />
                ),
              }}
              onRow={(record) => ({ onClick: () => openDetail(record) })}
            />
          </Card>
        </Col>
      </Row>

      <Card title="全局任务检索">
        <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }} wrap>
          <Input
            placeholder="搜索任务 / 模型"
            prefix={<SearchOutlined />}
            allowClear
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            style={{ width: 320 }}
          />
          <Space>
            <Select
              allowClear
              placeholder="任务类型"
              value={kind}
              onChange={setKind}
              options={taskKindOptions}
              style={{ width: 140 }}
            />
            <Select
              allowClear
              placeholder="任务状态"
              value={status}
              onChange={setStatus}
              options={evalTaskStatusOptions}
              style={{ width: 160 }}
            />
          </Space>
        </Space>

        <Table<UnifiedTask>
          rowKey="key"
          loading={loading}
          columns={columns}
          dataSource={filtered}
          tableLayout="fixed"
          scroll={{ x: 1280, y: 420 }}
          pagination={{
            pageSize: 12,
            showTotal: (total) => `共 ${total} 个任务`,
            showSizeChanger: false,
          }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <Text type="secondary">暂无任务，可先到“质量评测”或“性能压测”页提交</Text>
                }
              />
            ),
          }}
        />
      </Card>

      <TaskDetailDrawer
        task={selectedEvalTask}
        open={Boolean(selectedEvalTask)}
        onClose={() => setSelectedEvalTask(undefined)}
      />
      <PerfDetailDrawer
        task={selectedPerfTask}
        open={Boolean(selectedPerfTask)}
        onClose={() => setSelectedPerfTask(undefined)}
      />
    </div>
  );
}
