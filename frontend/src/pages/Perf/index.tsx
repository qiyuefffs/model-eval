import { useMemo, useState } from 'react';
import {
  App,
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { EyeOutlined, ReloadOutlined, RocketOutlined, ThunderboltOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { motion } from 'framer-motion';

import { useCustomDatasets } from '@/api/hooks/useDatasets';
import { useModels } from '@/api/hooks/useModels';
import {
  useCreatePerfTask,
  usePerfTasks,
  type PerfTaskCreate,
  type PerfTaskRead,
  type PerfTaskStatus,
} from '@/api/hooks/usePerfTasks';
import PerfDetailDrawer from './PerfDetailDrawer';
import PerfStatusTag from './PerfStatusTag';
import { perfTaskStatusOptions } from './statusMeta';

const { Title, Text } = Typography;

interface PerfFormValues {
  name: string;
  model_pk: number;
  request_count: number;
  concurrency: number;
  rate: number;
  perf_dataset: 'prompt' | 'openqa' | 'custom';
  custom_dataset_id?: number;
  prompt: string;
  max_tokens: number;
  temperature: number;
  stream: boolean;
  total_timeout?: number;
  tags?: string[];
  description?: string;
}

function fmt(value: number | null | undefined, digits = 2) {
  return typeof value === 'number' ? value.toFixed(digits) : '—';
}

export default function PerfPage() {
  const [form] = Form.useForm<PerfFormValues>();
  const { message } = App.useApp();
  const { data: models = [], isFetching: modelsFetching, refetch: refetchModels } = useModels();
  const { data: datasets = [], isFetching: datasetsFetching, refetch: refetchDatasets } = useCustomDatasets();
  const { data: tasks = [], isFetching: tasksFetching, isLoading, refetch } = usePerfTasks();
  const createPerfTask = useCreatePerfTask();
  const [selectedTask, setSelectedTask] = useState<PerfTaskRead>();
  const [status, setStatus] = useState<PerfTaskStatus>();
  const [keyword, setKeyword] = useState('');
  const perfDataset = Form.useWatch('perf_dataset', form) ?? 'prompt';

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
    const latestSucceeded = tasks.find((task) => task.status === 'succeeded' && task.result);
    return {
      total: tasks.length,
      running: tasks.filter((task) => task.status === 'running' || task.status === 'pending').length,
      latest: latestSucceeded?.result,
    };
  }, [tasks]);

  const handleSubmit = async (values: PerfFormValues) => {
    const payload: PerfTaskCreate = {
      name: values.name,
      model_pk: values.model_pk,
      request_count: values.request_count,
      concurrency: values.concurrency,
      rate: values.rate,
      perf_dataset: values.perf_dataset,
      custom_dataset_id: values.perf_dataset === 'custom' ? values.custom_dataset_id : null,
      prompt: values.prompt,
      max_tokens: values.max_tokens,
      temperature: values.temperature,
      stream: values.stream,
      total_timeout: values.total_timeout ?? 21600,
      description: values.description || null,
      tags: values.tags ?? [],
    };

    try {
      const task = await createPerfTask.mutateAsync(payload);
      message.success(`压测任务 "${task.name}" 已入队`);
      form.resetFields();
      refetch();
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '创建压测任务失败');
    }
  };

  const columns: ColumnsType<PerfTaskRead> = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 64,
      render: (id: number) => (
        <Text style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>#{id}</Text>
      ),
    },
    {
      title: '任务',
      dataIndex: 'name',
      width: 220,
      render: (name: string, record) => (
        <Space direction="vertical" size={2} style={{ width: '100%' }}>
          <Text strong ellipsis={{ tooltip: name }} style={{ maxWidth: 200 }}>
            {name}
          </Text>
          <Text type="secondary" ellipsis={{ tooltip: record.description || '—' }} style={{ maxWidth: 200, fontSize: 12 }}>
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
      width: 260,
      render: (modelName: string, record) => (
        <Space direction="vertical" size={2} style={{ width: '100%' }}>
          <Text ellipsis={{ tooltip: modelName }} style={{ maxWidth: 240 }}>
            {modelName}
          </Text>
          <Text
            ellipsis={{ tooltip: record.model_id }}
            style={{ maxWidth: 240, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-info)' }}
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
      title: '压力',
      key: 'pressure',
      width: 120,
      render: (_, record) => (
        <Text style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
          {record.request_count} req / c{record.concurrency}
        </Text>
      ),
    },
    {
      title: '数据源',
      dataIndex: 'perf_dataset',
      width: 110,
      render: (value: string, record) => (
        <Text style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
          {value}
          {record.custom_dataset_id ? ` #${record.custom_dataset_id}` : ''}
        </Text>
      ),
    },
    {
      title: '吞吐',
      key: 'throughput',
      width: 120,
      render: (_, record) => (
        <Text style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>
          {fmt(record.result?.request_throughput)} req/s
        </Text>
      ),
    },
    {
      title: 'TTFT / TPOT',
      key: 'latency',
      width: 150,
      render: (_, record) => (
        <Text style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
          {fmt(record.result?.avg_ttft)} / {fmt(record.result?.avg_tpot)} ms
        </Text>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 145,
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
      width: 90,
      render: (_, record) => (
        <Button size="small" type="text" icon={<EyeOutlined />} onClick={() => setSelectedTask(record)}>
          详情
        </Button>
      ),
    },
  ];

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}
      >
        <div>
          <Title level={3} style={{ margin: 0, fontFamily: 'var(--font-display)' }}>
            性能压测
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            独立队列发起 OpenAI 兼容接口压测，观察 TTFT、TPOT、吞吐与成功率。
          </Text>
        </div>
        <Button
          icon={<ReloadOutlined />}
          loading={modelsFetching || datasetsFetching || tasksFetching}
          onClick={() => {
            refetchModels();
            refetchDatasets();
            refetch();
          }}
        >
          刷新
        </Button>
      </motion.div>

      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col xs={24} md={8}>
          <Card style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-default)' }}>
            <Text type="secondary">压测任务</Text>
            <Title level={2} style={{ margin: 0, fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>
              {stats.total}
            </Title>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-default)' }}>
            <Text type="secondary">队列中</Text>
            <Title level={2} style={{ margin: 0, fontFamily: 'var(--font-mono)', color: 'var(--accent-warning)' }}>
              {stats.running}
            </Title>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-default)' }}>
            <Text type="secondary">最近吞吐</Text>
            <Title level={2} style={{ margin: 0, fontFamily: 'var(--font-mono)', color: 'var(--accent-info)' }}>
              {fmt(stats.latest?.request_throughput)}
            </Title>
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} lg={10}>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <Card
              className="scroll-card page-form-card"
              style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-default)' }}
            >
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <Space>
                  <ThunderboltOutlined style={{ color: 'var(--accent-primary)' }} />
                  <Text strong>创建压测任务</Text>
                </Space>
                <Alert
                  type="warning"
                  showIcon
                  message="首次联调建议小流量"
                  description="例如 5 个请求、并发 1，确认端点稳定后再逐步提高并发或切换 open-loop rate。"
                />
                <Form<PerfFormValues>
                  form={form}
                  layout="vertical"
                  initialValues={{
                    request_count: 10,
                    concurrency: 1,
                    rate: -1,
                    perf_dataset: 'prompt',
                    prompt: '你好，请用一句话介绍自己。',
                    max_tokens: 256,
                    temperature: 0,
                    stream: true,
                    total_timeout: 21600,
                    tags: [],
                  }}
                  onFinish={handleSubmit}
                >
                  <Form.Item
                    label="任务名称"
                    name="name"
                    rules={[
                      { required: true, message: '请输入任务名称' },
                      { max: 160, message: '不超过 160 字符' },
                    ]}
                  >
                    <Input placeholder="例如：Qwen 7B 并发 8 冒烟压测" maxLength={160} />
                  </Form.Item>

                  <Form.Item label="目标模型" name="model_pk" rules={[{ required: true, message: '请选择模型' }]}>
                    <Select
                      showSearch
                      placeholder="选择已注册模型"
                      optionFilterProp="label"
                      options={models.map((model) => ({
                        label: `${model.name} · ${model.model_id}`,
                        value: model.id,
                      }))}
                    />
                  </Form.Item>

                  <Form.Item label="压测数据源" name="perf_dataset">
                    <Select
                      options={[
                        { label: '固定 Prompt', value: 'prompt' },
                        { label: 'EvalScope OpenQA', value: 'openqa' },
                        { label: '自定义数据集', value: 'custom' },
                      ]}
                    />
                  </Form.Item>

                  {perfDataset === 'custom' && (
                    <Form.Item
                      label="自定义数据集"
                      name="custom_dataset_id"
                      rules={[{ required: true, message: '请选择自定义数据集' }]}
                      help="后端会从 question/query/prompt/input 等字段抽取 prompt，生成 line-by-line 压测文件。"
                    >
                      <Select
                        showSearch
                        placeholder="选择已上传的自定义数据集"
                        optionFilterProp="label"
                        options={datasets.map((dataset) => ({
                          label: `${dataset.name} · ${dataset.dataset_type} · ${dataset.row_count} 条`,
                          value: dataset.id,
                        }))}
                      />
                    </Form.Item>
                  )}

                  <Row gutter={12}>
                    <Col xs={24} md={8}>
                      <Form.Item label="请求数" name="request_count">
                        <InputNumber min={1} max={100000} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item label="并发数" name="concurrency">
                        <InputNumber min={1} max={4096} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item label="Rate" name="rate" help="-1 为 closed-loop；大于 0 为 open-loop req/s">
                        <InputNumber min={-1} step={0.5} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={12}>
                    <Col xs={24} md={8}>
                      <Form.Item label="最大 Token" name="max_tokens">
                        <InputNumber min={1} max={20000} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item label="Temperature" name="temperature">
                        <InputNumber min={0} max={2} step={0.1} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item label="总超时秒" name="total_timeout">
                        <InputNumber min={1} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item label="流式输出" name="stream" valuePropName="checked">
                    <Switch checkedChildren="stream" unCheckedChildren="non-stream" />
                  </Form.Item>

                  {perfDataset === 'prompt' && (
                    <Form.Item label="Prompt" name="prompt" rules={[{ required: true, message: '请输入压测 prompt' }]}>
                      <Input.TextArea autoSize={{ minRows: 3, maxRows: 6 }} maxLength={8000} showCount />
                    </Form.Item>
                  )}

                  <Form.Item label="标签（选填）" name="tags">
                    <Select mode="tags" placeholder="例如：冒烟、并发8、本地vLLM" tokenSeparators={[',', ' ']} />
                  </Form.Item>

                  <Form.Item label="描述（选填）" name="description">
                    <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} maxLength={2000} showCount />
                  </Form.Item>

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button
                      type="primary"
                      htmlType="submit"
                      icon={<RocketOutlined />}
                      loading={createPerfTask.isPending}
                    >
                      发起压测
                    </Button>
                  </div>
                </Form>
              </Space>
            </Card>
          </motion.div>
        </Col>

        <Col xs={24} lg={14}>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <Card
              className="scroll-card page-table-card"
              style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-default)' }}
            >
              <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }} wrap>
                <Input
                  placeholder="搜索任务 / 模型"
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
                  options={perfTaskStatusOptions}
                  style={{ width: 160 }}
                />
              </Space>

              <Table<PerfTaskRead>
                rowKey="id"
                loading={isLoading}
                columns={columns}
                dataSource={visibleTasks}
                tableLayout="fixed"
                scroll={{ x: 1375, y: 480 }}
                pagination={{
                  pageSize: 8,
                  showTotal: (total) => `共 ${total} 个压测任务`,
                  showSizeChanger: false,
                }}
                locale={{
                  emptyText: (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无压测任务，先创建一个冒烟压测" />
                  ),
                }}
              />
            </Card>
          </motion.div>
        </Col>
      </Row>

      <PerfDetailDrawer
        task={selectedTask}
        open={Boolean(selectedTask)}
        onClose={() => setSelectedTask(undefined)}
      />
    </div>
  );
}
