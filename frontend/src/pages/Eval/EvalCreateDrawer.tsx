import { useEffect, useMemo } from 'react';
import {
  App,
  Button,
  Card,
  Col,
  Drawer,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Typography,
} from 'antd';

import type { BenchmarkInfo, CustomDatasetRead } from '@/api/hooks/useDatasets';
import { useCreateEvalTask, type EvalTaskCreate } from '@/api/hooks/useEvalTasks';
import type { ModelRead } from '@/api/hooks/useModels';

const { Text } = Typography;

export interface EvalFormValues {
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

const INITIAL_VALUES: Partial<EvalFormValues> = {
  eval_batch_size: 1,
  temperature: 0,
  max_tokens: 1024,
  benchmark_names: [],
  benchmark_subsets: {},
  custom_dataset_ids: [],
  tags: [],
};

interface EvalCreateDrawerProps {
  open: boolean;
  onClose: () => void;
  models: ModelRead[];
  benchmarks: BenchmarkInfo[];
  datasets: CustomDatasetRead[];
  onCreated?: () => void;
}

export default function EvalCreateDrawer({
  open,
  onClose,
  models,
  benchmarks,
  datasets,
  onCreated,
}: EvalCreateDrawerProps) {
  const [form] = Form.useForm<EvalFormValues>();
  const { message } = App.useApp();
  const createEvalTask = useCreateEvalTask();
  const watchedBenchmarkNames = Form.useWatch('benchmark_names', form);
  const selectedBenchmarkNames = useMemo(
    () => watchedBenchmarkNames ?? [],
    [watchedBenchmarkNames],
  );

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

  useEffect(() => {
    if (open) {
      form.resetFields();
    }
  }, [open, form]);

  // 选中带子集的 benchmark 时，默认勾选第一个子集（冒烟），并清理已取消的 benchmark 子集。
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
      onClose();
      onCreated?.();
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '创建评测任务失败');
    }
  };

  return (
    <Drawer
      title="新建评测任务"
      open={open}
      onClose={onClose}
      width={480}
      styles={{ body: { paddingBottom: 80 } }}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" loading={createEvalTask.isPending} onClick={() => form.submit()}>
            提交评测
          </Button>
        </div>
      }
    >
      <Form<EvalFormValues>
        form={form}
        layout="vertical"
        initialValues={INITIAL_VALUES}
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

        <Form.Item
          label="目标模型"
          name="model_pk"
          rules={[{ required: true, message: '请选择模型' }]}
        >
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

        <Form.Item
          label="内置 benchmark"
          name="benchmark_names"
          help="可多选；若只想跑自定义数据集，可留空"
        >
          <Select
            mode="multiple"
            showSearch
            placeholder="例如 MMLU / C-Eval / GSM8K"
            optionFilterProp="label"
            options={benchmarkOptions}
          />
        </Form.Item>

        {selectedBenchmarkItems.some((item) => (item.subsets?.length ?? 0) > 0) && (
          <Card size="small" style={{ marginBottom: 24 }}>
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
                      options={(item.subsets ?? []).map((subset) => ({
                        label: subset,
                        value: subset,
                      }))}
                    />
                  </Form.Item>
                ))}
            </Space>
          </Card>
        )}

        <Form.Item
          label="自定义数据集"
          name="custom_dataset_ids"
          help="与内置 benchmark 至少选择一类"
        >
          <Select
            mode="multiple"
            showSearch
            placeholder="选择已上传的 JSON / JSONL 数据集"
            optionFilterProp="label"
            options={datasetOptions}
          />
        </Form.Item>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item
              label="并发批量"
              name="eval_batch_size"
              help="传给 EvalScope 的 eval_batch_size"
            >
              <InputNumber min={1} max={64} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="样本限制" name="limit" help="可填样本数，留空表示全量">
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item label="最大输出 Token" name="max_tokens">
              <InputNumber min={1} max={20000} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Temperature" name="temperature" help="默认 0，适合稳定回归">
              <InputNumber min={0} max={2} step={0.1} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>

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
      </Form>
    </Drawer>
  );
}
