import { useEffect, useState } from 'react';
import { Button, Popover, Space, Tag, Typography } from 'antd';
import {
  CheckCircleFilled,
  CloseCircleFilled,
  LoadingOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';

import { useTestModel, type ConnectivityTestResult } from '@/api/hooks/useModels';

const { Text } = Typography;

interface Props {
  modelPk: number;
  modelName: string;
}

/**
 * 连通性测试按钮
 *
 * 点击后立即触发后端 /api/models/{id}/test，按钮变 loading；
 * 测试完成后显示结果徽标（成功/失败 + 延迟），徽标持续 8 秒后淡出回到默认态。
 */
export default function TestConnectivityButton({ modelPk, modelName }: Props) {
  const mutation = useTestModel();
  const [lastResult, setLastResult] = useState<ConnectivityTestResult | null>(null);
  const [showResult, setShowResult] = useState(false);

  const handleClick = () => {
    setShowResult(false);
    mutation.mutate(modelPk, {
      onSuccess: ({ result }) => {
        setLastResult(result);
        setShowResult(true);
      },
    });
  };

  // 结果展示 8 秒后自动收起
  useEffect(() => {
    if (!showResult) return;
    const timer = setTimeout(() => setShowResult(false), 8000);
    return () => clearTimeout(timer);
  }, [showResult, lastResult]);

  const isLoading = mutation.isPending;
  const renderResultBadge = () => {
    if (!lastResult) return null;
    const { ok, latency_ms, http_status, detail } = lastResult;
    return (
      <Popover
        content={
          <div style={{ maxWidth: 320 }}>
            <Space direction="vertical" size={4}>
              <Text strong style={{ color: ok ? 'var(--accent-primary)' : 'var(--accent-danger)' }}>
                {ok ? '连通成功' : '连通失败'}
              </Text>
              {http_status != null && (
                <Text style={{ fontSize: 12 }}>
                  HTTP 状态：<Text code>{http_status}</Text>
                </Text>
              )}
              {latency_ms != null && (
                <Text style={{ fontSize: 12 }}>
                  耗时：<Text code>{latency_ms} ms</Text>
                </Text>
              )}
              <Text
                style={{ fontSize: 12, fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}
              >
                {detail}
              </Text>
            </Space>
          </div>
        }
        title={`模型 "${modelName}" 的测试结果`}
        trigger="hover"
      >
        <Tag
          color={ok ? 'success' : 'error'}
          icon={ok ? <CheckCircleFilled /> : <CloseCircleFilled />}
          style={{ cursor: 'help', fontFamily: 'var(--font-mono)' }}
        >
          {ok ? `${latency_ms ?? '?'}ms` : `失败${http_status != null ? ` ${http_status}` : ''}`}
        </Tag>
      </Popover>
    );
  };

  return (
    <Space size={6}>
      <Button
        size="small"
        type="default"
        icon={isLoading ? <LoadingOutlined /> : <ThunderboltOutlined />}
        loading={isLoading}
        onClick={handleClick}
      >
        {isLoading ? '测试中' : '测试连通'}
      </Button>
      {showResult && lastResult && <div>{renderResultBadge()}</div>}
    </Space>
  );
}
