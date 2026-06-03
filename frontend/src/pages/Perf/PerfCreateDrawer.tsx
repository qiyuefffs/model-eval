import { useEffect } from 'react';
import {
  App,
  Alert,
  Button,
  Col,
  Drawer,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Switch,
} from 'antd';

import type { ModelRead } from '@/api/hooks/useModels';
import type { CustomDatasetRead } from '@/api/hooks/useDatasets';
import { useCreatePerfTask, type PerfTaskCreate } from '@/api/hooks/usePerfTasks';

export interface PerfFormValues {
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
  metrics_url?: string;
  tags?: string[];
  description?: string;
}

const DEFAULT_VALUES: Partial<PerfFormValues> = {
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
};

interface PerfCreateDrawerProps {
  open: boolean;
  onClose: () => void;
  models: ModelRead[];
  datasets: CustomDatasetRead[];
  initialValues?: Partial<PerfFormValues>;
  onCreated?: () => void;
}

export default function PerfCreateDrawer({
  open,
  onClose,
  models,
  datasets,
  initialValues,
  onCreated,
}: PerfCreateDrawerProps) {
  const [form] = Form.useForm<PerfFormValues>();
  const { message } = App.useApp();
  const createPerfTask = useCreatePerfTask();
  const perfDataset = Form.useWatch('perf_dataset', form) ?? 'prompt';

  // 打开时重置为默认值 + 复跑预填值（Drawer 常驻时 initialValues 不会自动生效）。
  useEffect(() => {
    if (open) {
      form.resetFields();
      form.setFieldsValue({ ...DEFAULT_VALUES, ...initialValues });
    }
  }, [open, initialValues, form]);

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
      metrics_url: values.metrics_url || null,
      description: values.description || null,
      tags: values.tags ?? [],
    };

    try {
      const task = await createPerfTask.mutateAsync(payload);
      message.success(`压测任务 "${task.name}" 已入队`);
      onClose();
      onCreated?.();
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '创建压测任务失败');
    }
  };

  return (
    <Drawer
      title="新建压测任务"
      open={open}
      onClose={onClose}
      width={460}
      styles={{ body: { paddingBottom: 80 } }}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" loading={createPerfTask.isPending} onClick={() => form.submit()}>
            创建任务
          </Button>
        </div>
      }
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="首次联调建议小流量"
        description="例如 5 个请求、并发 1，确认端点稳定后再逐步提高并发或切换 open-loop rate。"
      />
      <Form<PerfFormValues>
        form={form}
        layout="vertical"
        initialValues={DEFAULT_VALUES}
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
          <Input placeholder="请输入任务名称" maxLength={160} />
        </Form.Item>

        <Form.Item
          label="目标模型"
          name="model_pk"
          rules={[{ required: true, message: '请选择目标模型' }]}
        >
          <Select
            showSearch
            placeholder="请选择目标模型"
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
          <Col span={12}>
            <Form.Item label="请求数" name="request_count">
              <InputNumber min={1} max={100000} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="并发数" name="concurrency">
              <InputNumber min={1} max={4096} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item label="Rate" name="rate" help="-1 为 closed-loop；大于 0 为 open-loop req/s">
          <InputNumber min={-1} step={0.5} style={{ width: '100%' }} />
        </Form.Item>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item label="最大 Token" name="max_tokens">
              <InputNumber min={1} max={20000} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Temperature" name="temperature">
              <InputNumber min={0} max={2} step={0.1} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item label="总超时（秒）" name="total_timeout">
          <InputNumber min={1} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item label="流式输出" name="stream" valuePropName="checked">
          <Switch checkedChildren="stream" unCheckedChildren="non-stream" />
        </Form.Item>

        <Form.Item
          label="vLLM Metrics URL（选填）"
          name="metrics_url"
          help="留空时根据模型 API URL 自动推断为 /metrics；非 vLLM 服务可忽略。"
        >
          <Input placeholder="例如：http://localhost:8000/metrics" maxLength={1000} />
        </Form.Item>

        {perfDataset === 'prompt' && (
          <Form.Item
            label="Prompt"
            name="prompt"
            rules={[{ required: true, message: '请输入压测 prompt' }]}
          >
            <Input.TextArea autoSize={{ minRows: 3, maxRows: 6 }} maxLength={8000} showCount />
          </Form.Item>
        )}

        <Form.Item label="标签（选填）" name="tags">
          <Select
            mode="tags"
            placeholder="例如：冒烟、并发8、本地vLLM"
            tokenSeparators={[',', ' ']}
          />
        </Form.Item>

        <Form.Item label="描述（选填）" name="description">
          <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} maxLength={2000} showCount />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
