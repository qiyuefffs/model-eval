import { useMemo, useState } from 'react';
import { Button, Card, Col, Row, Space, Tabs, Tag, Typography } from 'antd';
import {
  AppstoreAddOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  ReloadOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { motion } from 'framer-motion';

import { useBenchmarks, useCustomDatasets } from '@/api/hooks/useDatasets';
import BenchmarkTable from './BenchmarkTable';
import DatasetTable from './DatasetTable';
import UploadDatasetModal from './UploadDatasetModal';

const { Title, Text } = Typography;

export default function DatasetsPage() {
  const [uploadOpen, setUploadOpen] = useState(false);
  const { data: benchmarks = [], isFetching: benchmarksFetching, refetch: refetchBenchmarks } = useBenchmarks();
  const { data: datasets = [], isFetching: datasetsFetching, refetch: refetchDatasets } = useCustomDatasets();

  const stats = useMemo(() => {
    const datasetRows = datasets.reduce((sum, item) => sum + item.row_count, 0);
    const typeCounts = datasets.reduce<Record<string, number>>((acc, item) => {
      acc[item.dataset_type] = (acc[item.dataset_type] ?? 0) + 1;
      return acc;
    }, {});
    const topBenchmarkTags = benchmarks
      .flatMap((item) => item.tags ?? [])
      .reduce<Record<string, number>>((acc, tag) => {
        acc[tag] = (acc[tag] ?? 0) + 1;
        return acc;
      }, {});

    return {
      benchmarkTotal: benchmarks.length,
      datasetTotal: datasets.length,
      datasetRows,
      datasetTypes: Object.entries(typeCounts).sort(([, a], [, b]) => b - a),
      benchmarkTags: Object.entries(topBenchmarkTags)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 6),
    };
  }, [benchmarks, datasets]);

  const refreshAll = () => {
    refetchBenchmarks();
    refetchDatasets();
  };

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
            数据集
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            浏览 EvalScope 内置 benchmark，上传并管理业务回归评测数据。
          </Text>
        </div>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            loading={benchmarksFetching || datasetsFetching}
            onClick={refreshAll}
          >
            刷新
          </Button>
          <Button type="primary" icon={<UploadOutlined />} onClick={() => setUploadOpen(true)}>
            上传数据集
          </Button>
        </Space>
      </motion.div>

      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col xs={24} md={8}>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
          >
            <Card style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-default)' }}>
              <Space direction="vertical" size={4}>
                <Text type="secondary" style={{ fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' }}>
                  <DatabaseOutlined /> 内置基准
                </Text>
                <Title
                  level={2}
                  style={{ margin: 0, fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}
                >
                  {stats.benchmarkTotal}
                </Title>
              </Space>
            </Card>
          </motion.div>
        </Col>
        <Col xs={24} md={8}>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <Card style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-default)' }}>
              <Space direction="vertical" size={4}>
                <Text type="secondary" style={{ fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' }}>
                  <AppstoreAddOutlined /> 自定义数据集
                </Text>
                <Title
                  level={2}
                  style={{ margin: 0, fontFamily: 'var(--font-mono)', color: 'var(--accent-info)' }}
                >
                  {stats.datasetTotal}
                </Title>
              </Space>
            </Card>
          </motion.div>
        </Col>
        <Col xs={24} md={8}>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
          >
            <Card style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-default)' }}>
              <Space direction="vertical" size={4}>
                <Text type="secondary" style={{ fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' }}>
                  <FileTextOutlined /> 自定义样本
                </Text>
                <Title
                  level={2}
                  style={{ margin: 0, fontFamily: 'var(--font-mono)', color: 'var(--accent-warning)' }}
                >
                  {stats.datasetRows}
                </Title>
              </Space>
            </Card>
          </motion.div>
        </Col>
      </Row>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: 0.2 }}>
        <Card
          className="scroll-card page-table-card"
          style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-default)' }}
        >
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            {(stats.datasetTypes.length > 0 || stats.benchmarkTags.length > 0) && (
              <Space size={6} wrap>
                {stats.datasetTypes.map(([type, count]) => (
                  <Tag key={type} style={{ fontFamily: 'var(--font-mono)' }}>
                    {type} · {count}
                  </Tag>
                ))}
                {stats.benchmarkTags.map(([tag, count]) => (
                  <Tag
                    key={tag}
                    style={{
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--accent-primary)',
                      borderColor: 'rgba(80,200,120,0.3)',
                      background: 'rgba(80,200,120,0.08)',
                    }}
                  >
                    {tag} · {count}
                  </Tag>
                ))}
              </Space>
            )}
            <Tabs
              items={[
                {
                  key: 'benchmarks',
                  label: '内置基准',
                  children: <BenchmarkTable />,
                },
                {
                  key: 'custom',
                  label: '自定义数据集',
                  children: <DatasetTable />,
                },
              ]}
            />
          </Space>
        </Card>
      </motion.div>

      <UploadDatasetModal open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </div>
  );
}
