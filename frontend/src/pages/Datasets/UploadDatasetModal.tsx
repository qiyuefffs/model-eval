import { useState } from 'react';
import { App, Alert, Button, Form, Input, Modal, Select, Space, Typography, Upload } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import { InboxOutlined } from '@ant-design/icons';

import { useUploadDataset } from '@/api/hooks/useDatasets';

const { Text } = Typography;

interface Props {
  open: boolean;
  onClose: () => void;
}

interface FormValues {
  name: string;
  datasetType: string;
  description?: string;
  tags?: string[];
}

const DATASET_TYPE_OPTIONS = [
  {
    value: 'general_qa',
    label: 'general_qa · 问答',
    help: '题干字段 + 答案字段，例如 question/answer',
  },
  {
    value: 'general_mcq',
    label: 'general_mcq · 选择题',
    help: '题干字段 + choices/options + answer/label',
  },
  {
    value: 'general_fc',
    label: 'general_fc · 工具调用',
    help: 'messages/conversation/prompt + tools/functions',
  },
];

export default function UploadDatasetModal({ open, onClose }: Props) {
  const { message } = App.useApp();
  const uploadDataset = useUploadDataset();
  const [form] = Form.useForm<FormValues>();
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  const resetAndClose = () => {
    form.resetFields();
    setFileList([]);
    onClose();
  };

  const handleSubmit = async (values: FormValues) => {
    const file = fileList[0]?.originFileObj;
    if (!file) {
      message.warning('请选择 JSON 或 JSONL 文件');
      return;
    }

    try {
      await uploadDataset.mutateAsync({
        name: values.name,
        datasetType: values.datasetType,
        file,
        description: values.description,
        tags: values.tags,
      });
      message.success(`数据集 "${values.name}" 上传成功`);
      resetAndClose();
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '上传失败');
    }
  };

  return (
    <Modal
      open={open}
      onCancel={resetAndClose}
      title={
        <Space>
          <InboxOutlined style={{ color: 'var(--accent-primary)' }} />
          <span>上传自定义数据集</span>
        </Space>
      }
      footer={null}
      width={720}
      destroyOnClose
    >
      <Alert
        type="info"
        showIcon
        message={
          <Text style={{ fontSize: 13 }}>
            支持 UTF-8 编码的 <Text code>JSON</Text> / <Text code>JSONL</Text>。
            后端会按 EvalScope 的 general_* 通用数据格式做基础结构校验。
          </Text>
        }
        style={{ marginBottom: 16, background: 'rgba(106,183,255,0.08)', borderColor: 'rgba(106,183,255,0.3)' }}
      />

      <Form<FormValues>
        form={form}
        layout="vertical"
        initialValues={{ datasetType: 'general_qa', tags: [] }}
        onFinish={handleSubmit}
      >
        <Form.Item
          label="数据集名称"
          name="name"
          rules={[
            { required: true, message: '请输入数据集名称' },
            { max: 120, message: '不超过 120 字符' },
          ]}
        >
          <Input placeholder="例如：客服问答回归集 v1" maxLength={120} />
        </Form.Item>

        <Form.Item
          label="数据类型"
          name="datasetType"
          rules={[{ required: true, message: '请选择数据类型' }]}
          help={DATASET_TYPE_OPTIONS.find((item) => item.value === form.getFieldValue('datasetType'))?.help}
        >
          <Select options={DATASET_TYPE_OPTIONS.map(({ value, label }) => ({ value, label }))} />
        </Form.Item>

        <Form.Item label="标签（选填）" name="tags" help="按 Enter 创建标签，上传时会以逗号分隔传给后端">
          <Select mode="tags" placeholder="例如：客服、回归、中文" tokenSeparators={[',', ' ']} />
        </Form.Item>

        <Form.Item label="描述（选填）" name="description">
          <Input.TextArea
            placeholder="备注数据来源、用途或版本"
            autoSize={{ minRows: 2, maxRows: 4 }}
            maxLength={2000}
            showCount
          />
        </Form.Item>

        <Form.Item label="数据文件" required>
          <Upload.Dragger
            accept=".json,.jsonl,application/json"
            maxCount={1}
            fileList={fileList}
            beforeUpload={() => false}
            onChange={({ fileList: nextFileList }) => setFileList(nextFileList.slice(-1))}
            onRemove={() => setFileList([])}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined style={{ color: 'var(--accent-primary)' }} />
            </p>
            <p className="ant-upload-text">拖拽文件到这里，或点击选择</p>
            <p className="ant-upload-hint">仅保存到后端 custom_datasets 目录，不会上传到外部服务。</p>
          </Upload.Dragger>
        </Form.Item>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={resetAndClose}>取消</Button>
          <Button type="primary" htmlType="submit" loading={uploadDataset.isPending}>
            上传
          </Button>
        </div>
      </Form>
    </Modal>
  );
}
