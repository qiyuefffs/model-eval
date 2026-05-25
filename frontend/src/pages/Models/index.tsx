import { useMemo, useState } from 'react';
import { Button, Card, Col, Row, Space, Tag, Typography } from 'antd';
import { PlusOutlined, ReloadOutlined, ApiOutlined, TagsOutlined } from '@ant-design/icons';
import { motion } from 'framer-motion';

import { useModels } from '@/api/hooks/useModels';
import CreateModelModal from './CreateModelModal';
import ModelTable from './ModelTable';

const { Title, Text } = Typography;

export default function ModelsPage() {
  const { data: models = [], isFetching, refetch } = useModels();
  const [modalOpen, setModalOpen] = useState(false);

  // 顶部统计：总数 + 按 tag 分布
  const stats = useMemo(() => {
    const tagCounts: Record<string, number> = {};
    models.forEach((m) => {
      m.tags?.forEach((t) => {
        tagCounts[t] = (tagCounts[t] ?? 0) + 1;
      });
    });
    const topTags = Object.entries(tagCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6);
    return { total: models.length, topTags };
  }, [models]);

  return (
    <div>
      {/* 标题区 */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}
      >
        <div>
          <Title level={3} style={{ margin: 0, fontFamily: 'var(--font-display)' }}>
            模型管理
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            注册待评测的云端 / 本地 OpenAI 兼容模型。API Key 加密存储，仅评测时解密。
          </Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} loading={isFetching} onClick={() => refetch()}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
            注册模型
          </Button>
        </Space>
      </motion.div>

      {/* 统计卡片 */}
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
                  <ApiOutlined /> 模型总数
                </Text>
                <Title
                  level={2}
                  style={{ margin: 0, fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}
                >
                  {stats.total}
                </Title>
              </Space>
            </Card>
          </motion.div>
        </Col>
        <Col xs={24} md={16}>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <Card
              style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-default)', height: '100%' }}
            >
              <Space direction="vertical" size={6} style={{ width: '100%' }}>
                <Text type="secondary" style={{ fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' }}>
                  <TagsOutlined /> 热门标签
                </Text>
                {stats.topTags.length === 0 ? (
                  <Text type="secondary">还没有标签</Text>
                ) : (
                  <Space size={6} wrap>
                    {stats.topTags.map(([tag, count]) => (
                      <Tag
                        key={tag}
                        style={{
                          fontFamily: 'var(--font-mono)',
                          padding: '2px 8px',
                          background: 'rgba(122,255,159,0.08)',
                          borderColor: 'rgba(122,255,159,0.3)',
                          color: 'var(--accent-primary)',
                        }}
                      >
                        {tag} · {count}
                      </Tag>
                    ))}
                  </Space>
                )}
              </Space>
            </Card>
          </motion.div>
        </Col>
      </Row>

      {/* 表格 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.15 }}
      >
        <Card
          className="scroll-card page-table-card"
          style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-default)' }}
        >
          <ModelTable />
        </Card>
      </motion.div>

      <CreateModelModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
