import { useMemo, useState } from 'react';
import { App, Button, Empty, Input, Popconfirm, Select, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

import {
  useCustomDatasets,
  useDeleteDataset,
  type CustomDatasetRead,
} from '@/api/hooks/useDatasets';

const { Text } = Typography;

const DATASET_TYPE_LABELS: Record<string, string> = {
  general_qa: '问答 QA',
  general_mcq: '选择题 MCQ',
  general_fc: '工具调用 FC',
};

export default function DatasetTable() {
  const { data: datasets = [], isLoading } = useCustomDatasets();
  const deleteDataset = useDeleteDataset();
  const { message } = App.useApp();
  const [keyword, setKeyword] = useState('');
  const [datasetType, setDatasetType] = useState<string>();

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return datasets.filter((item) => {
      if (
        q &&
        !item.name.toLowerCase().includes(q) &&
        !item.file_name.toLowerCase().includes(q) &&
        !(item.description ?? '').toLowerCase().includes(q)
      ) {
        return false;
      }
      if (datasetType && item.dataset_type !== datasetType) return false;
      return true;
    });
  }, [datasets, datasetType, keyword]);

  const handleDelete = async (dataset: CustomDatasetRead) => {
    try {
      await deleteDataset.mutateAsync(dataset.id);
      message.success(`已删除数据集 "${dataset.name}"`);
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  const columns: ColumnsType<CustomDatasetRead> = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 70,
      render: (id: number) => (
        <Text style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>#{id}</Text>
      ),
    },
    {
      title: '数据集',
      dataIndex: 'name',
      render: (name: string, record) => (
        <Space direction="vertical" size={2}>
          <Text strong>{name}</Text>
          <Text style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>
            {record.file_name}
          </Text>
          {record.description && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.description}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'dataset_type',
      width: 150,
      render: (type: string) => (
        <Tag
          style={{
            fontFamily: 'var(--font-mono)',
            color: 'var(--accent-info)',
            borderColor: 'rgba(106,183,255,0.35)',
            background: 'rgba(106,183,255,0.08)',
          }}
        >
          {DATASET_TYPE_LABELS[type] ?? type}
        </Tag>
      ),
    },
    {
      title: '样本',
      dataIndex: 'row_count',
      width: 100,
      render: (count: number) => (
        <Text style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>{count}</Text>
      ),
    },
    {
      title: '格式',
      dataIndex: 'file_format',
      width: 90,
      render: (format: string) => <Text style={{ fontFamily: 'var(--font-mono)' }}>{format}</Text>,
    },
    {
      title: '标签',
      dataIndex: 'tags',
      render: (tags: string[]) =>
        tags.length > 0 ? (
          <Space size={4} wrap>
            {tags.map((tag) => (
              <Tag key={tag} style={{ marginInlineEnd: 0 }}>
                {tag}
              </Tag>
            ))}
          </Space>
        ) : (
          <Text type="secondary">—</Text>
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
        <Popconfirm
          title={`删除数据集 "${record.name}"？`}
          description="将同时删除服务端保存的上传文件。"
          okText="确认删除"
          cancelText="取消"
          okButtonProps={{ danger: true }}
          onConfirm={() => handleDelete(record)}
        >
          <Button
            size="small"
            danger
            type="text"
            icon={<DeleteOutlined />}
            loading={deleteDataset.isPending && deleteDataset.variables === record.id}
          />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }} wrap>
        <Input
          placeholder="搜索名称 / 文件 / 描述"
          prefix={<SearchOutlined />}
          allowClear
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          style={{ width: 320 }}
        />
        <Select
          allowClear
          placeholder="数据类型"
          value={datasetType}
          onChange={setDatasetType}
          options={Object.entries(DATASET_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
          style={{ width: 180 }}
        />
      </Space>

      <Table<CustomDatasetRead>
        rowKey="id"
        loading={isLoading}
        columns={columns}
        dataSource={filtered}
        scroll={{ x: 1100, y: 380 }}
        pagination={{
          pageSize: 10,
          showTotal: (total) => `共 ${total} 个自定义数据集`,
          showSizeChanger: false,
        }}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                datasets.length === 0 ? (
                  <Text type="secondary">尚未上传自定义数据集，点击右上角"上传数据集"开始</Text>
                ) : (
                  <Text type="secondary">没有匹配的自定义数据集</Text>
                )
              }
            />
          ),
        }}
      />
    </div>
  );
}
