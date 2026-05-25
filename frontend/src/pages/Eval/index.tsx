import { useEffect, useMemo, useState } from 'react';
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
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  EyeOutlined,
  ExperimentOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  SearchOutlined,
  SlidersOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { motion } from 'framer-motion';

import { useBenchmarks, useCustomDatasets } from '@/api/hooks/useDatasets';
import {
  useCreateEvalTask,
  useEvalTasks,
  type EvalTaskCreate,
  type EvalTaskRead,
  type EvalTaskStatus,
} from '@/api/hooks/useEvalTasks';
import { useModels } from '@/api/hooks/useModels';
import TaskDetailDrawer from '@/pages/Tasks/TaskDetailDrawer';
import { EvalTaskStatusTag } from '@/pages/Tasks/status';
import { evalTaskStatusOptions } from '@/pages/Tasks/statusMeta';

const { Title, Text } = Typography;

interface EvalFormValues {
  name: string;
  model_pk: number;
  benchmark_names?: string[];
  benchmark_subsets?: Record<string, string[]>;
  custom_dataset_ids?: number[];
  eval_batch_size: number;
  limit?: number;
  temperature?: number;
  max_tokens?: number;
  tags?: string[];
  description?: string;
}

function fmt(value: number | null | undefined, digits = 4) {
  return typeof value === 'number' ? value.toFixed(digits) : '—';
}

function firstScore(task: EvalTaskRead) {
  return task.results?.find((item) => item.score !== null)?.score ?? null;
}

export default function EvalPage() {
  const [form] = Form.useForm<EvalFormValues>();
  const { message } = App.useApp();
  const { data: models = [], isFetching: modelsFetching, refetch: refetchModels } = useModels();
  const { data: benchmarks = [], isFetching: benchmarksFetching, refetch: refetchBenchmarks } = useBenchmarks();
  const { data: datasets = [], isFetching: datasetsFetching, refetch: refetchDatasets } = useCustomDatasets();
  const { data: tasks = [], isFetching: tasksFetching, isLoading, refetch: refetchTasks } = useEvalTasks();
  const createEvalTask = useCreateEvalTask();
  const [selectedTask, setSelectedTask] = useState<EvalTaskRead>();
  const [status, setStatus] = useState<EvalTaskStatus>();
  const [keyword, setKeyword] = useState('');
  const watchedBenchmarkNames = Form.useWatch('benchmark_names', form);
  const selectedBenchmarkNames = useMemo(() => watchedBenchmarkNames ?? [], [watchedBenchmarkNames]);

  const loading = modelsFetching || benchmarksFetching || datasetsFetching || tasksFetching;

  const benchmarkOptions = useMemo(
    () =>
      benchmarks.map((item) => ({
        label: `${item.display_name} · ${item.name}`,
        value: item.name,
      })),
    [benchmarks],
  );

  const selectedBenchmarkItems = useMemo(
    () => benchmarks.filter((item) => selectedBenchmarkNames.includes(item.name)),
    [benchmarks, selectedBenchmarkNames],
  );

  const datasetOptions = useMemo(
    () =>
      datasets.map((item) => ({
        label: `${item.name} · ${item.dataset_type} · ${item.row_count} 条`,
        value: item.id,
      })),
    [datasets],
  );

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
    const latestSucceeded = tasks.find((task) => task.status === 'succeeded' && firstScore(task) !== null);
    return {
      total: tasks.length,
      running: tasks.filter((task) => task.status === 'running' || task.status === 'pending').length,
      latestScore: latestSucceeded ? firstScore(latestSucceeded) : null,
    };
  }, [tasks]);

  useEffect(() => {
    const current = form.getFieldValue('benchmark_subsets') ?? {};
    const selected = new Set(selectedBenchmarkNames);
    const next: Record<string, string[]> = { ...current };
    let changed = false;

    Object.keys(next).forEach((name) => {
      if (!selected.has(name)) {
        delete next[name];
        changed = true;
      }
    });

    selectedBenchmarkItems.forEach((item) => {
      if ((item.subsets?.length ?? 0) > 0 && (!next[item.name] || next[item.name].length === 0)) {
        next[item.name] = [item.subsets![0]];
        changed = true;
      }
    });

    if (changed) {
      form.setFieldsValue({ benchmark_subsets: next });
    }
  }, [form, selectedBenchmarkItems, selectedBenchmarkNames]);

  const handleSubmit = async (values: EvalFormValues) => {
    const benchmarkNames = values.benchmark_names ?? [];
    const customDatasetIds = values.custom_dataset_ids ?? [];
    if (benchmarkNames.length === 0 && customDatasetIds.length === 0) {
      message.warning('请至少选择一个内置基准或自定义数据集');
      return;
    }

    const generationConfig: Record<string, number> = {};
    if (values.temperature !== undefined) generationConfig.temperature = values.temperature;
    if (values.max_tokens !== undefined) generationConfig.max_tokens = values.max_tokens;

    const datasetArgs: Record<string, { subset_list: string[] }> = {};
    benchmarkNames.forEach((benchmarkName) => {
      const subsetList = values.benchmark_subsets?.[benchmarkName]?.filter(Boolean) ?? [];
      if (subsetList.length > 0) {
        datasetArgs[benchmarkName] = { subset_list: subsetList };
      }
    });

    const payload: EvalTaskCreate = {
      name: values.name,
      model_pk: values.model_pk,
      benchmark_names: benchmarkNames,
      custom_dataset_ids: customDatasetIds,
      eval_backend: 'Native',
      eval_batch_size: values.eval_batch_size,
      limit: values.limit ?? null,
      generation_config: generationConfig,
      dataset_args: datasetArgs,
      description: values.description || null,
      tags: values.tags ?? [],
    };

    try {
      const task = await createEvalTask.mutateAsync(payload);
      message.success(`评测任务 "${task.name}" 已入队`);
      form.resetFields();
      refetchTasks();
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '创建评测任务失败');
    }
  };

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
          <Text style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-info)' }}>
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
      width: 100,
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
            质量评测
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            选择模型、benchmark 与数据集，提交后由后台队列调用 EvalScope 执行。
          </Text>
        </div>
        <Button icon={<ReloadOutlined />} loading={loading} onClick={refreshAll}>
          刷新
        </Button>
      </motion.div>

      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col xs={24} md={8}>
          <Card style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-default)' }}>
            <Space direction="vertical" size={4}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                已建任务
              </Text>
              <Title level={2} style={{ margin: 0, fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>
                {stats.total}
              </Title>
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-default)' }}>
            <Space direction="vertical" size={4}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                队列中
              </Text>
              <Title level={2} style={{ margin: 0, fontFamily: 'var(--font-mono)', color: 'var(--accent-warning)' }}>
                {stats.running}
              </Title>
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-default)' }}>
            <Space direction="vertical" size={4}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                最近分数
              </Text>
              <Title level={2} style={{ margin: 0, fontFamily: 'var(--font-mono)', color: 'var(--accent-info)' }}>
                {fmt(stats.latestScore)}
              </Title>
            </Space>
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} xl={11}>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <Card
              className="scroll-card page-form-card"
              style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-default)' }}
            >
              <Form<EvalFormValues>
                form={form}
                layout="vertical"
                initialValues={{
                  eval_batch_size: 1,
                  temperature: 0,
                  max_tokens: 1024,
                  benchmark_names: [],
                  benchmark_subsets: {},
                  custom_dataset_ids: [],
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
                  <Input placeholder="例如：Qwen 回归评测 · MMLU + 客服 QA" maxLength={160} />
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

                <Form.Item label="内置 benchmark" name="benchmark_names" help="可多选；若只想跑自定义数据集，可留空">
                  <Select
                    mode="multiple"
                    showSearch
                    placeholder="例如 MMLU / C-Eval / GSM8K"
                    optionFilterProp="label"
                    options={benchmarkOptions}
                  />
                </Form.Item>

                {selectedBenchmarkItems.some((item) => (item.subsets?.length ?? 0) > 0) && (
                  <Card
                    size="small"
                    style={{ marginBottom: 24, background: 'rgba(80, 200, 120, 0.06)', borderColor: 'var(--border-default)' }}
                  >
                    <Space direction="vertical" size={12} style={{ width: '100%' }}>
                      <Text strong>Benchmark 子集</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        已默认选择每个 benchmark 的第一个子集，适合冒烟测试；需要全量时可手动选择更多子集。
                      </Text>
                      {selectedBenchmarkItems
                        .filter((item) => (item.subsets?.length ?? 0) > 0)
                        .map((item) => (
                          <Form.Item
                            key={item.name}
                            label={`${item.display_name} · ${item.name}`}
                            name={['benchmark_subsets', item.name]}
                            rules={[{ type: 'array', min: 1, message: '请至少选择一个子集，避免误跑全量' }]}
                            help={`${item.subsets?.length ?? 0} 个可选子集；提交后会写入 dataset_args.${item.name}.subset_list`}
                          >
                            <Select
                              mode="multiple"
                              showSearch
                              maxTagCount="responsive"
                              placeholder="选择要评测的子集"
                              options={(item.subsets ?? []).map((subset) => ({ label: subset, value: subset }))}
                            />
                          </Form.Item>
                        ))}
                    </Space>
                  </Card>
                )}

                <Form.Item label="自定义数据集" name="custom_dataset_ids" help="与内置 benchmark 至少选择一类">
                  <Select
                    mode="multiple"
                    showSearch
                    placeholder="选择已上传的 JSON / JSONL 数据集"
                    optionFilterProp="label"
                    options={datasetOptions}
                  />
                </Form.Item>

                <Row gutter={12}>
                  <Col xs={24} md={8}>
                    <Form.Item label="并发批量" name="eval_batch_size" help="传给 EvalScope 的 eval_batch_size">
                      <InputNumber min={1} max={64} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item label="样本限制" name="limit" help="可填样本数，留空表示全量">
                      <InputNumber min={1} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item label="最大输出 Token" name="max_tokens">
                      <InputNumber min={1} max={20000} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item label="Temperature" name="temperature" help="默认 0，适合稳定回归评测">
                  <InputNumber min={0} max={2} step={0.1} style={{ width: 180 }} />
                </Form.Item>

                <Form.Item label="标签（选填）" name="tags">
                  <Select mode="tags" placeholder="例如：回归、上线前、中文" tokenSeparators={[',', ' ']} />
                </Form.Item>

                <Form.Item label="描述（选填）" name="description">
                  <Input.TextArea
                    placeholder="记录本次评测目的、模型版本或数据范围"
                    autoSize={{ minRows: 2, maxRows: 4 }}
                    maxLength={2000}
                    showCount
                  />
                </Form.Item>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    type="primary"
                    htmlType="submit"
                    icon={<PlayCircleOutlined />}
                    loading={createEvalTask.isPending}
                  >
                    提交评测
                  </Button>
                </div>
              </Form>
            </Card>
          </motion.div>
        </Col>

        <Col xs={24} xl={13}>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.08 }}
          >
            <Card
              className="scroll-card page-table-card"
              style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-default)' }}
            >
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
                scroll={{ x: 1100, y: 440 }}
                pagination={{
                  pageSize: 8,
                  showTotal: (total) => `共 ${total} 个评测任务`,
                  showSizeChanger: false,
                }}
                locale={{
                  emptyText: (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<Text type="secondary">暂无评测任务</Text>} />
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
                      <Tag style={{ fontFamily: 'var(--font-mono)' }}>benchmark · {benchmarks.length}</Tag>
                      <Tag style={{ fontFamily: 'var(--font-mono)' }}>自定义 · {datasets.length}</Tag>
                    </Space>
                  </Space>
                }
              />
            </Card>
          </motion.div>
        </Col>
      </Row>

      <TaskDetailDrawer
        task={selectedTask}
        open={Boolean(selectedTask)}
        onClose={() => setSelectedTask(undefined)}
      />
    </div>
  );
}
