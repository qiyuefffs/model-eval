import { useMemo, useState } from 'react';
import { Button, Empty, Input, Popconfirm, Space, Table, Tag, Tooltip, Typography, App } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

import { useDeleteModel, useModels, type ModelRead } from '@/api/hooks/useModels';
import TestConnectivityButton from './TestConnectivityButton';

const { Text } = Typography;

export default function ModelTable() {
  const { data: models = [], isLoading } = useModels();
  const deleteModel = useDeleteModel();
  const { message } = App.useApp();

  const [keyword, setKeyword] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // 所有出现过的 tag（用于过滤胶囊）
  const allTags = useMemo(() => {
    const s = new Set<string>();
    models.forEach((m) => m.tags?.forEach((t) => s.add(t)));
    return Array.from(s).sort();
  }, [models]);

  const filtered = useMemo(() => {
    return models.filter((m) => {
      if (keyword) {
        const lower = keyword.toLowerCase();
        if (
          !m.name.toLowerCase().includes(lower) &&
          !m.model_id.toLowerCase().includes(lower) &&
          !m.api_url.toLowerCase().includes(lower)
        ) {
          return false;
        }
      }
      if (selectedTags.length > 0) {
        if (!selectedTags.every((t) => m.tags?.includes(t))) return false;
      }
      return true;
    });
  }, [models, keyword, selectedTags]);

  const handleDelete = async (m: ModelRead) => {
    try {
      await deleteModel.mutateAsync(m.id);
      message.success(`已删除模型 "${m.name}"`);
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const columns: ColumnsType<ModelRead> = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 60,
      render: (id: number) => (
        <Text style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>#{id}</Text>
      ),
    },
    {
      title: '显示名',
      dataIndex: 'name',
      render: (name: string, record) => (
        <Space direction="vertical" size={2}>
          <Text strong>{name}</Text>
          {record.description && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.description}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: '模型 ID',
      dataIndex: 'model_id',
      render: (model_id: string) => (
        <Text style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>{model_id}</Text>
      ),
    },
    {
      title: 'API 端点',
      dataIndex: 'api_url',
      ellipsis: true,
      render: (url: string) => (
        <Tooltip title={url}>
          <Text
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: 'var(--text-secondary)',
              maxWidth: 280,
              display: 'inline-block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {url}
          </Text>
        </Tooltip>
      ),
    },
    {
      title: 'API Key',
      dataIndex: 'api_key_preview',
      width: 140,
      render: (preview: string) => (
        <Text style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-info)' }}>
          {preview}
        </Text>
      ),
    },
    {
      title: '标签',
      dataIndex: 'tags',
      render: (tags: string[]) =>
        tags && tags.length > 0 ? (
          <Space size={4} wrap>
            {tags.map((t) => (
              <Tag key={t} style={{ marginInlineEnd: 0 }}>
                {t}
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
      width: 230,
      render: (_, record) => (
        <Space size={4}>
          <TestConnectivityButton modelPk={record.id} modelName={record.name} />
          <Popconfirm
            title={`删除模型 "${record.name}"？`}
            description="此操作不可恢复，但相关历史评测记录会保留。"
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
              loading={deleteModel.isPending && deleteModel.variables === record.id}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* 工具栏 */}
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }} wrap>
        <Input
          placeholder="搜索名称 / 模型 ID / URL"
          prefix={<SearchOutlined />}
          allowClear
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          style={{ width: 320 }}
        />
        {allTags.length > 0 && (
          <Space size={4} wrap>
            <Text type="secondary" style={{ fontSize: 12 }}>
              筛选标签：
            </Text>
            {allTags.map((tag) => (
              <Tag.CheckableTag
                key={tag}
                checked={selectedTags.includes(tag)}
                onChange={() => toggleTag(tag)}
              >
                {tag}
              </Tag.CheckableTag>
            ))}
            {selectedTags.length > 0 && (
              <Button size="small" type="link" onClick={() => setSelectedTags([])}>
                清除
              </Button>
            )}
          </Space>
        )}
      </Space>

      <Table<ModelRead>
        rowKey="id"
        loading={isLoading}
        columns={columns}
        dataSource={filtered}
        scroll={{ x: 1200, y: 430 }}
        pagination={{
          pageSize: 20,
          showTotal: (total) => `共 ${total} 个模型`,
          showSizeChanger: false,
        }}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                models.length === 0 ? (
                  <Text type="secondary">尚未注册任何模型，点击右上角"注册模型"开始</Text>
                ) : (
                  <Text type="secondary">没有匹配的模型</Text>
                )
              }
            />
          ),
        }}
      />
    </div>
  );
}
