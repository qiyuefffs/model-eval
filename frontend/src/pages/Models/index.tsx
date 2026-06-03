import { useMemo, useState } from 'react';
import { Button, Card } from 'antd';
import { ApiOutlined, PlusOutlined, ReloadOutlined, TagsOutlined } from '@ant-design/icons';

import { useModels } from '@/api/hooks/useModels';
import PageHeader from '@/components/common/PageHeader';
import MetricCard from '@/components/common/MetricCard';
import CreateModelModal from './CreateModelModal';
import ModelTable from './ModelTable';

export default function ModelsPage() {
  const { data: models = [], isFetching, refetch } = useModels();
  const [modalOpen, setModalOpen] = useState(false);

  const stats = useMemo(() => {
    const tags = new Set<string>();
    models.forEach((m) => m.tags?.forEach((t) => tags.add(t)));
    return { total: models.length, tagCount: tags.size };
  }, [models]);

  return (
    <div>
      <PageHeader
        title="模型管理"
        subtitle="注册待评测的云端 / 本地 OpenAI 兼容模型。API Key 加密存储，仅评测时解密。"
        actions={
          <>
            <Button icon={<ReloadOutlined />} loading={isFetching} onClick={() => refetch()}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
              注册模型
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
          icon={<ApiOutlined />}
          tone="primary"
          title="模型总数"
          value={stats.total}
          description="已注册模型"
        />
        <MetricCard
          icon={<TagsOutlined />}
          tone="info"
          title="标签种类"
          value={stats.tagCount}
          description="去重标签数"
        />
      </div>

      <Card>
        <ModelTable />
      </Card>

      <CreateModelModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
