import { useMemo, useState } from 'react';
import { Button, Card, Tabs } from 'antd';
import {
  AppstoreAddOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  ReloadOutlined,
  UploadOutlined,
} from '@ant-design/icons';

import { useBenchmarks, useCustomDatasets } from '@/api/hooks/useDatasets';
import PageHeader from '@/components/common/PageHeader';
import MetricCard from '@/components/common/MetricCard';
import BenchmarkTable from './BenchmarkTable';
import DatasetTable from './DatasetTable';
import UploadDatasetModal from './UploadDatasetModal';

export default function DatasetsPage() {
  const [uploadOpen, setUploadOpen] = useState(false);
  const {
    data: benchmarks = [],
    isFetching: benchmarksFetching,
    refetch: refetchBenchmarks,
  } = useBenchmarks();
  const {
    data: datasets = [],
    isFetching: datasetsFetching,
    refetch: refetchDatasets,
  } = useCustomDatasets();

  const stats = useMemo(() => {
    const datasetRows = datasets.reduce((sum, item) => sum + item.row_count, 0);
    return {
      benchmarkTotal: benchmarks.length,
      datasetTotal: datasets.length,
      datasetRows,
    };
  }, [benchmarks, datasets]);

  const refreshAll = () => {
    refetchBenchmarks();
    refetchDatasets();
  };

  return (
    <div>
      <PageHeader
        title="数据集"
        subtitle="浏览 EvalScope 内置 benchmark，上传并管理业务回归评测数据。"
        actions={
          <>
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
          </>
        }
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: 16,
          marginBottom: 16,
        }}
      >
        <MetricCard
          icon={<DatabaseOutlined />}
          tone="primary"
          title="内置基准"
          value={stats.benchmarkTotal}
          description="EvalScope benchmark"
        />
        <MetricCard
          icon={<AppstoreAddOutlined />}
          tone="info"
          title="自定义数据集"
          value={stats.datasetTotal}
          description="已上传数据集"
        />
        <MetricCard
          icon={<FileTextOutlined />}
          tone="warning"
          title="自定义样本"
          value={stats.datasetRows}
          description="总样本条数"
        />
      </div>

      <Card>
        <Tabs
          items={[
            { key: 'benchmarks', label: '内置基准', children: <BenchmarkTable /> },
            { key: 'custom', label: '自定义数据集', children: <DatasetTable /> },
          ]}
        />
      </Card>

      <UploadDatasetModal open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </div>
  );
}
