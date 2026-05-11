import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Alert,
  Button,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Tag,
  Typography,
  App,
} from 'antd';
import { LinkOutlined, KeyOutlined, RocketOutlined } from '@ant-design/icons';

import { useCreateModel, type ModelCreate } from '@/api/hooks/useModels';

const { Text } = Typography;

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(1, '请输入显示名')
    .max(120, '不超过 120 字符'),
  model_id: z
    .string()
    .trim()
    .min(1, '请输入平台侧模型 ID')
    .max(200, '不超过 200 字符'),
  api_url: z
    .string()
    .trim()
    .url('请输入合法的 URL（例如 https://api.deepseek.com/v1/chat/completions）'),
  api_key: z.string().trim().min(1, '请输入 API Key'),
  description: z.string().max(2000).optional().default(''),
  tags: z.array(z.string()).max(20, '标签最多 20 个').default([]),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
}

// 常用平台预设 — 一键填充端点
const ENDPOINT_PRESETS: Array<{ label: string; url: string; example_model: string; tags: string[] }> = [
  {
    label: 'DeepSeek 官方',
    url: 'https://api.deepseek.com/v1/chat/completions',
    example_model: 'deepseek-chat',
    tags: ['云端', '中文'],
  },
  {
    label: '阿里云百炼',
    url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    example_model: 'qwen-plus',
    tags: ['云端', '中文'],
  },
  {
    label: '硅基流动',
    url: 'https://api.siliconflow.cn/v1/chat/completions',
    example_model: 'deepseek-ai/DeepSeek-V3',
    tags: ['云端'],
  },
  {
    label: '本地 vLLM',
    url: 'http://localhost:8000/v1/chat/completions',
    example_model: 'Qwen2.5-7B-Instruct',
    tags: ['本地', 'vLLM'],
  },
];

export default function CreateModelModal({ open, onClose }: Props) {
  const { message } = App.useApp();
  const create = useCreateModel();
  const [submitting, setSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      model_id: '',
      api_url: '',
      api_key: '',
      description: '',
      tags: [],
    },
  });

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      await create.mutateAsync(values as ModelCreate);
      message.success(`模型 "${values.name}" 注册成功`);
      reset();
      onClose();
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '注册失败');
    } finally {
      setSubmitting(false);
    }
  };

  const applyPreset = (preset: (typeof ENDPOINT_PRESETS)[number]) => {
    setValue('api_url', preset.url, { shouldValidate: true });
    setValue('model_id', preset.example_model, { shouldValidate: true });
    setValue('tags', preset.tags);
  };

  return (
    <Modal
      open={open}
      onCancel={() => {
        reset();
        onClose();
      }}
      title={
        <Space>
          <RocketOutlined style={{ color: 'var(--accent-primary)' }} />
          <span>注册新模型</span>
        </Space>
      }
      footer={null}
      width={680}
      destroyOnClose
    >
      <Alert
        type="info"
        showIcon
        message={
          <Text style={{ fontSize: 13 }}>
            仅支持 <Text code>OpenAI 兼容</Text> 的 chat/completions 端点。
            API Key 将被对称加密存储，前端永远不会返回明文。
          </Text>
        }
        style={{ marginBottom: 16, background: 'rgba(106,183,255,0.08)', borderColor: 'rgba(106,183,255,0.3)' }}
      />

      {/* 平台预设快捷填充 */}
      <div style={{ marginBottom: 16 }}>
        <Text type="secondary" style={{ fontSize: 12, marginRight: 8 }}>
          快捷预设：
        </Text>
        <Space size={6} wrap>
          {ENDPOINT_PRESETS.map((p) => (
            <Tag
              key={p.label}
              style={{ cursor: 'pointer', userSelect: 'none', fontFamily: 'var(--font-mono)' }}
              onClick={() => applyPreset(p)}
            >
              {p.label}
            </Tag>
          ))}
        </Space>
      </div>

      <Form layout="vertical" onFinish={handleSubmit(onSubmit)}>
        <Form.Item
          label="显示名"
          required
          validateStatus={errors.name ? 'error' : ''}
          help={errors.name?.message}
        >
          <Controller
            name="name"
            control={control}
            render={({ field }) => (
              <Input {...field} placeholder="例如：DeepSeek-Chat (官方)" maxLength={120} />
            )}
          />
        </Form.Item>

        <Form.Item
          label={
            <Space size={4}>
              <span>API 端点</span>
              <Text type="secondary" style={{ fontSize: 12 }}>（chat/completions 完整路径）</Text>
            </Space>
          }
          required
          validateStatus={errors.api_url ? 'error' : ''}
          help={errors.api_url?.message}
        >
          <Controller
            name="api_url"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                prefix={<LinkOutlined style={{ color: 'var(--text-muted)' }} />}
                placeholder="https://api.deepseek.com/v1/chat/completions"
                style={{ fontFamily: 'var(--font-mono)' }}
              />
            )}
          />
        </Form.Item>

        <Form.Item
          label="模型 ID"
          required
          validateStatus={errors.model_id ? 'error' : ''}
          help={errors.model_id?.message ?? '平台侧的模型标识，作为请求体里的 model 字段'}
        >
          <Controller
            name="model_id"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                placeholder="例如：deepseek-chat / qwen-plus / Qwen2.5-7B-Instruct"
                style={{ fontFamily: 'var(--font-mono)' }}
              />
            )}
          />
        </Form.Item>

        <Form.Item
          label="API Key"
          required
          validateStatus={errors.api_key ? 'error' : ''}
          help={errors.api_key?.message ?? '加密后存储，仅在评测时解密用于实际请求'}
        >
          <Controller
            name="api_key"
            control={control}
            render={({ field }) => (
              <Input.Password
                {...field}
                prefix={<KeyOutlined style={{ color: 'var(--text-muted)' }} />}
                placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                style={{ fontFamily: 'var(--font-mono)' }}
              />
            )}
          />
        </Form.Item>

        <Form.Item label="标签（选填）" help="按 Enter 创建标签，便于分组与筛选">
          <Controller
            name="tags"
            control={control}
            render={({ field }) => (
              <Select
                {...field}
                mode="tags"
                placeholder="例如：云端、中文、推理"
                style={{ width: '100%' }}
                tokenSeparators={[',', ' ']}
              />
            )}
          />
        </Form.Item>

        <Form.Item label="描述（选填）">
          <Controller
            name="description"
            control={control}
            render={({ field }) => (
              <Input.TextArea
                {...field}
                placeholder="备注信息，例如版本、用途等"
                autoSize={{ minRows: 2, maxRows: 4 }}
                maxLength={2000}
                showCount
              />
            )}
          />
        </Form.Item>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button
            onClick={() => {
              reset();
              onClose();
            }}
          >
            取消
          </Button>
          <Button type="primary" htmlType="submit" loading={submitting}>
            注册
          </Button>
        </div>
      </Form>
    </Modal>
  );
}
