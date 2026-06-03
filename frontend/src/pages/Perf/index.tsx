import { useMemo, useState } from 'react';
import { Button } from 'antd';
import {
  AimOutlined,
  ClockCircleOutlined,
  DashboardOutlined,
  PlusOutlined,
  ProfileOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';

import { useCustomDatasets } from '@/api/hooks/useDatasets';
import { useModels } from '@/api/hooks/useModels';
import { usePerfTasks, type PerfTaskRead } from '@/api/hooks/usePerfTasks';
import PageHeader from '@/components/common/PageHeader';
import MetricCard from '@/components/common/MetricCard';
import PerfTrendChart from './PerfTrendChart';
import PerfTaskTable from './PerfTaskTable';
import PerfCreateDrawer, { type PerfFormValues } from './PerfCreateDrawer';
import PerfDetailDrawer from './PerfDetailDrawer';

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/** 从任务的 detailed_metrics.client.ttft_ms.p95 取 TTFT P95（毫秒 → 秒）。 */
function ttftP95Seconds(task?: PerfTaskRead): number | null {
  const client = asRecord(asRecord(task?.result?.detailed_metrics)?.client);
  const ttft = asRecord(client?.ttft_ms);
  const p95 = ttft?.p95;
  return typeof p95 === 'number' ? p95 / 1000 : null;
}

export default function PerfPage() {
  const { data: models = [], isFetching: modelsFetching, refetch: refetchModels } = useModels();
  const {
    data: datasets = [],
    isFetching: datasetsFetching,
    refetch: refetchDatasets,
  } = useCustomDatasets();
  const { data: tasks = [], isFetching: tasksFetching, isLoading, refetch } = usePerfTasks();

  const [selectedTask, setSelectedTask] = useState<PerfTaskRead>();
  const [createOpen, setCreateOpen] = useState(false);
  const [createInitial, setCreateInitial] = useState<Partial<PerfFormValues>>();

  const kpis = useMemo(() => {
    const running = tasks.filter(
      (task) => task.status === 'running' || task.status === 'pending',
    ).length;
    const withResult = tasks.filter((task) => task.result);
    const totalReq = withResult.reduce((sum, task) => sum + (task.result?.total_requests ?? 0), 0);
    const totalOk = withResult.reduce((sum, task) => sum + (task.result?.succeed_requests ?? 0), 0);
    const latest = tasks.find((task) => task.status === 'succeeded' && task.result);
    return {
      total: tasks.length,
      running,
      successRate: totalReq > 0 ? totalOk / totalReq : null,
      throughput: latest?.result?.total_token_throughput ?? null,
      ttftP95: ttftP95Seconds(latest),
    };
  }, [tasks]);

  const handleRefresh = () => {
    refetchModels();
    refetchDatasets();
    refetch();
  };

  const handleCreate = () => {
    setCreateInitial(undefined);
    setCreateOpen(true);
  };

  const handleRerun = (task: PerfTaskRead) => {
    setCreateInitial({
      name: `${task.name} (复跑)`,
      model_pk: task.model_pk,
      request_count: task.request_count,
      concurrency: task.concurrency,
      rate: task.rate,
      perf_dataset: task.perf_dataset as PerfFormValues['perf_dataset'],
      custom_dataset_id: task.custom_dataset_id ?? undefined,
      prompt: task.prompt ?? '',
      max_tokens: task.max_tokens,
      temperature: task.temperature,
      stream: task.stream,
      total_timeout: task.total_timeout ?? 21600,
      metrics_url: task.metrics_url ?? undefined,
      tags: task.tags ?? [],
      description: task.description ?? undefined,
    });
    setCreateOpen(true);
  };

  return (
    <div>
      <PageHeader
        title="性能压测"
        subtitle="独立队列发起 OpenAI 兼容接口压测，观察 TTFT、TPOT、吞吐与成功率。"
        actions={
          <>
            <Button
              icon={<ReloadOutlined />}
              loading={modelsFetching || datasetsFetching || tasksFetching}
              onClick={handleRefresh}
            >
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
              新建压测
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
          tone="primary"
          icon={<ProfileOutlined />}
          title="压测任务"
          value={kpis.total}
          description="总任务数"
        />
        <MetricCard
          tone="warning"
          icon={<ThunderboltOutlined />}
          title="运行中"
          value={kpis.running}
          description="运行中任务"
        />
        <MetricCard
          tone="success"
          icon={<AimOutlined />}
          title="成功率"
          value={kpis.successRate === null ? '—' : `${(kpis.successRate * 100).toFixed(2)}%`}
          description="整体成功率"
        />
        <MetricCard
          tone="info"
          icon={<DashboardOutlined />}
          title="最近吞吐"
          value={kpis.throughput === null ? '—' : kpis.throughput.toFixed(2)}
          description="tokens/s"
        />
        <MetricCard
          tone="purple"
          icon={<ClockCircleOutlined />}
          title="P95 延迟"
          value={kpis.ttftP95 === null ? '—' : `${kpis.ttftP95.toFixed(2)}s`}
          description="TTFT P95"
        />
      </div>

      <PerfTrendChart />

      <PerfTaskTable
        tasks={tasks}
        loading={isLoading}
        onDetail={setSelectedTask}
        onRerun={handleRerun}
      />

      <PerfCreateDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        models={models}
        datasets={datasets}
        initialValues={createInitial}
        onCreated={refetch}
      />

      <PerfDetailDrawer
        task={selectedTask}
        open={Boolean(selectedTask)}
        onClose={() => setSelectedTask(undefined)}
      />
    </div>
  );
}
