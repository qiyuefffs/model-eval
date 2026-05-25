import { useMemo, useState } from 'react';
import { Empty, Input, Select, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { SearchOutlined } from '@ant-design/icons';

import { useBenchmarks, type BenchmarkInfo } from '@/api/hooks/useDatasets';

const { Text } = Typography;

export default function BenchmarkTable() {
  const [keyword, setKeyword] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>();
  const [selectedBackend, setSelectedBackend] = useState<string>();
  const { data: benchmarks = [], isLoading } = useBenchmarks();

  const filterOptions = useMemo(() => {
    const tags = new Set<string>();
    const backends = new Set<string>();
    benchmarks.forEach((item) => {
      item.tags?.forEach((tag) => tags.add(tag));
      item.backends?.forEach((backend) => backends.add(backend));
    });
    return {
      tags: Array.from(tags).sort(),
      backends: Array.from(backends).sort(),
    };
  }, [benchmarks]);

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return benchmarks.filter((item) => {
      if (
        q &&
        !item.name.toLowerCase().includes(q) &&
        !item.display_name.toLowerCase().includes(q) &&
        !item.description.toLowerCase().includes(q)
      ) {
        return false;
      }
      if (selectedTag && !item.tags?.includes(selectedTag)) return false;
      if (selectedBackend && !item.backends?.includes(selectedBackend)) return false;
      return true;
    });
  }, [benchmarks, keyword, selectedBackend, selectedTag]);

  const columns: ColumnsType<BenchmarkInfo> = [
    {
      title: 'Benchmark',
      dataIndex: 'display_name',
      width: 220,
      render: (displayName: string, record) => (
        <Space direction="vertical" size={2}>
          <Text strong>{displayName}</Text>
          <Text style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-info)' }}>
            {record.name}
          </Text>
        </Space>
      ),
    },
    {
      title: '说明',
      dataIndex: 'description',
      render: (description: string) => (
        <Text type="secondary" style={{ fontSize: 13 }}>
          {description || '—'}
        </Text>
      ),
    },
    {
      title: '标签',
      dataIndex: 'tags',
      width: 240,
      render: (tags: string[] | undefined) =>
        tags && tags.length > 0 ? (
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
      title: '后端',
      dataIndex: 'backends',
      width: 180,
      render: (backends: string[] | undefined) =>
        backends && backends.length > 0 ? (
          <Space size={4} wrap>
            {backends.map((backend) => (
              <Tag
                key={backend}
                style={{
                  marginInlineEnd: 0,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--accent-primary)',
                  borderColor: 'rgba(80,200,120,0.35)',
                  background: 'rgba(80,200,120,0.08)',
                }}
              >
                {backend}
              </Tag>
            ))}
          </Space>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: '来源',
      dataIndex: 'source',
      width: 110,
      render: (source: string) => (
        <Text style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>
          {source}
        </Text>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }} wrap>
        <Input
          placeholder="搜索名称 / 描述"
          prefix={<SearchOutlined />}
          allowClear
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          style={{ width: 320 }}
        />
        <Space wrap>
          <Select
            allowClear
            placeholder="标签"
            value={selectedTag}
            onChange={setSelectedTag}
            options={filterOptions.tags.map((tag) => ({ label: tag, value: tag }))}
            style={{ width: 160 }}
          />
          <Select
            allowClear
            placeholder="后端"
            value={selectedBackend}
            onChange={setSelectedBackend}
            options={filterOptions.backends.map((backend) => ({ label: backend, value: backend }))}
            style={{ width: 160 }}
          />
        </Space>
      </Space>

      <Table<BenchmarkInfo>
        rowKey="name"
        loading={isLoading}
        columns={columns}
        dataSource={filtered}
        scroll={{ x: 1000, y: 380 }}
        pagination={{
          pageSize: 12,
          showTotal: (total) => `共 ${total} 个基准`,
          showSizeChanger: false,
        }}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={<Text type="secondary">没有匹配的内置 benchmark</Text>}
            />
          ),
        }}
      />
    </div>
  );
}
