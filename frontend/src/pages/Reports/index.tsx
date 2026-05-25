import { useEffect, useMemo, useState } from 'react';
import type { Key } from 'react';
import { App, Button, Card, Col, Empty, Input, Row, Segmented, Space, Statistic, Table, Tabs, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { BarChartOutlined, FileMarkdownOutlined, Html5Outlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { motion } from 'framer-motion';
import dayjs from 'dayjs';

import {
  useExportReport,
  useReportCompare,
  useReportTasks,
  type EvalDatasetScore,
  type EvalScoreMatrixRow,
  type PerfMetricRow,
  type PerfPercentileRow,
  type ReportTaskOption,
  type ReportTaskType,
} from '@/api/hooks/useReports';

const { Title, Text } = Typography;
const chartPalette = ['#6ab7ff', '#50c878', '#ffb454', '#ff5370', '#c792ea', '#89ddff', '#f78c6c', '#c3e88d'];

function fmt(value: number | null | undefined, digits = 2) {
  return typeof value === 'number' ? value.toFixed(digits) : '—';
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function chartTextStyle() {
  return { color: '#b3b1ad', fontFamily: 'JetBrains Mono' };
}

function chartFallbackOption(message: string) {
  return {
    backgroundColor: 'transparent',
    title: {
      text: message,
      left: 'center',
      top: 'middle',
      textStyle: { color: '#5c6773', fontSize: 13, fontWeight: 400 },
    },
    series: [],
  };
}

function taskLabel(taskId: number, modelName: string) {
  return `#${taskId} ${modelName}`;
}

function percentileOrder(value: string) {
  const number = Number(value.replace('%', ''));
  return Number.isFinite(number) ? number : 999;
}

function chartTaskAxisLabel(value: string) {
  const [taskId, ...modelParts] = value.split(' ');
  return `${taskId}\n${modelParts.join(' ')}`;
}

function averageScore(scores: Record<string, number | null | undefined>) {
  const values = Object.values(scores).filter(isNumber);
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function downloadTextFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const { message } = App.useApp();
  const [taskType, setTaskType] = useState<ReportTaskType>('eval');
  const [keyword, setKeyword] = useState('');
  const [selectedTaskIds, setSelectedTaskIds] = useState<number[]>([]);
  const { data: taskOptions, isFetching: tasksFetching, refetch: refetchTasks } = useReportTasks(taskType, keyword);
  const comparePayload = useMemo(() => ({ task_type: taskType, task_ids: selectedTaskIds }), [selectedTaskIds, taskType]);
  const { data, isFetching: compareFetching, refetch: refetchCompare } = useReportCompare(comparePayload);
  const exportReport = useExportReport();
  const tasks = useMemo(() => taskOptions?.tasks ?? [], [taskOptions?.tasks]);
  const selectedTasks = useMemo(() => data?.tasks ?? [], [data?.tasks]);
  const evalScores = useMemo(() => data?.eval_dataset_scores ?? [], [data?.eval_dataset_scores]);
  const evalMatrix = useMemo(() => data?.eval_matrix ?? [], [data?.eval_matrix]);
  const perfMetrics = useMemo(() => data?.perf_metrics ?? [], [data?.perf_metrics]);
  const perfPercentiles = useMemo(() => data?.perf_percentiles ?? [], [data?.perf_percentiles]);

  useEffect(() => {
    setSelectedTaskIds([]);
  }, [taskType]);

  useEffect(() => {
    if (selectedTaskIds.length === 0 && tasks.length > 0) {
      setSelectedTaskIds([tasks[0].task_id]);
    }
  }, [selectedTaskIds.length, tasks]);

  const stats = useMemo(() => {
    const metricValues = selectedTasks
      .map((item) => item.primary_metric)
      .filter((value): value is number => typeof value === 'number');
    const avg = metricValues.length > 0 ? metricValues.reduce((sum, value) => sum + value, 0) / metricValues.length : null;
    return { total: tasks.length, selected: selectedTaskIds.length, avg };
  }, [selectedTaskIds.length, selectedTasks, tasks.length]);

  const evalBarOption = useMemo(() => {
    const rows = selectedTasks.filter((item) => isNumber(item.primary_metric)).slice().reverse();
    if (rows.length === 0) {
      return chartFallbackOption('暂无可解析的质量平均分');
    }
    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' },
      grid: { top: 32, left: 56, right: 24, bottom: 76 },
      xAxis: {
        type: 'category',
        data: rows.map((item) => taskLabel(item.task_id, item.model_name)),
        axisLabel: { ...chartTextStyle(), interval: 0, formatter: chartTaskAxisLabel },
      },
      yAxis: { type: 'value', axisLabel: chartTextStyle(), splitLine: { lineStyle: { color: 'rgba(230,225,207,0.1)' } } },
      series: [
        {
          type: 'bar',
          name: '平均分',
          data: rows.map((item) => item.primary_metric),
          itemStyle: { color: '#50c878' },
        },
      ],
    };
  }, [selectedTasks]);

  const evalRadarOption = useMemo(() => {
    const datasets = Array.from(new Set(evalScores.map((item) => item.dataset_name))).slice(0, 8);
    const rows = evalMatrix.filter((row) => datasets.some((dataset) => isNumber((row.scores ?? {})[dataset])));
    if (datasets.length === 0 || rows.length === 0) {
      return chartFallbackOption('暂无可绘制的 Dataset 分数');
    }
    if (datasets.length < 2) {
      return {
        backgroundColor: 'transparent',
        tooltip: { trigger: 'axis' },
        legend: { type: 'scroll', textStyle: chartTextStyle(), top: 0 },
        grid: { top: 54, left: 56, right: 24, bottom: 58 },
        xAxis: { type: 'category', data: datasets, axisLabel: { ...chartTextStyle(), interval: 0 } },
        yAxis: { type: 'value', axisLabel: chartTextStyle(), splitLine: { lineStyle: { color: 'rgba(230,225,207,0.1)' } } },
        series: rows.map((row) => ({
          type: 'bar',
          name: taskLabel(row.task_id, row.model_name),
          data: datasets.map((dataset) => (row.scores ?? {})[dataset] ?? null),
          itemStyle: { opacity: 0.86 },
          barMaxWidth: 72,
        })),
      };
    }
    const scoreValues = evalScores.map((item) => item.score).filter(isNumber);
    const maxScore = Math.max(...scoreValues, 1);
    return {
      backgroundColor: 'transparent',
      tooltip: {
        formatter: (params: { name: string; value: number[] }) => {
          const lines = [`${params.name}`];
          datasets.forEach((dataset, index) => {
            lines.push(`${dataset}: ${fmt(params.value[index], 4)}`);
          });
          return lines.join('<br/>');
        },
      },
      color: chartPalette,
      legend: { type: 'scroll', textStyle: chartTextStyle(), bottom: 0 },
      radar: {
        indicator: datasets.map((name) => ({ name, max: maxScore })),
        center: ['50%', '48%'],
        radius: '66%',
        axisName: chartTextStyle(),
        splitArea: { areaStyle: { color: ['rgba(106,183,255,0.04)', 'rgba(80,200,120,0.03)'] } },
        splitLine: { lineStyle: { color: 'rgba(230,225,207,0.14)' } },
        axisLine: { lineStyle: { color: 'rgba(230,225,207,0.14)' } },
      },
      series: [
        {
          type: 'radar',
          symbolSize: 4,
          lineStyle: { width: 2 },
          areaStyle: { opacity: 0.16 },
          emphasis: { lineStyle: { width: 3 }, areaStyle: { opacity: 0.28 } },
          data: rows.map((row) => ({
            name: `${row.model_name} #${row.task_id}`,
            value: datasets.map((dataset) => (row.scores ?? {})[dataset] ?? averageScore(row.scores ?? {})),
          })),
        },
      ],
    };
  }, [evalMatrix, evalScores]);

  const evalDatasetBarOption = useMemo(() => {
    const datasets = Array.from(new Set(evalScores.map((item) => item.dataset_name)));
    const rows = evalMatrix.filter((row) => datasets.some((dataset) => isNumber((row.scores ?? {})[dataset])));
    if (datasets.length === 0 || rows.length === 0) {
      return chartFallbackOption('暂无 Dataset 分组分数');
    }
    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' },
      legend: { type: 'scroll', textStyle: chartTextStyle(), top: 0 },
      grid: { top: 48, left: 56, right: 24, bottom: 58 },
      xAxis: { type: 'category', data: datasets, axisLabel: { ...chartTextStyle(), interval: 0 } },
      yAxis: { type: 'value', axisLabel: chartTextStyle(), splitLine: { lineStyle: { color: 'rgba(230,225,207,0.1)' } } },
      series: rows.map((row) => ({
        type: 'bar',
        name: taskLabel(row.task_id, row.model_name),
        data: datasets.map((dataset) => (row.scores ?? {})[dataset] ?? null),
      })),
    };
  }, [evalMatrix, evalScores]);

  const evalHeatmapOption = useMemo(() => {
    const datasets = Array.from(new Set(evalScores.map((item) => item.dataset_name)));
    const rows = evalMatrix.filter((row) => datasets.some((dataset) => isNumber((row.scores ?? {})[dataset])));
    const taskNames = rows.map((row) => taskLabel(row.task_id, row.model_name));
    if (datasets.length === 0 || taskNames.length === 0) {
      return chartFallbackOption('暂无质量分数热力图数据');
    }
    const values = rows.flatMap((row, yIndex) =>
      datasets.map((dataset, xIndex) => [xIndex, yIndex, (row.scores ?? {})[dataset] ?? null]),
    );
    const numericValues = values.map((item) => item[2]).filter((value): value is number => typeof value === 'number');
    return {
      backgroundColor: 'transparent',
      tooltip: { position: 'top' },
      grid: { top: 32, left: 120, right: 36, bottom: 48 },
      xAxis: { type: 'category', data: datasets, axisLabel: chartTextStyle(), splitArea: { show: true } },
      yAxis: { type: 'category', data: taskNames, axisLabel: chartTextStyle(), splitArea: { show: true } },
      visualMap: {
        min: numericValues.length ? Math.min(...numericValues) : 0,
        max: numericValues.length ? Math.max(...numericValues) : 1,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        textStyle: chartTextStyle(),
        inRange: { color: ['#1a212c', '#6ab7ff', '#50c878'] },
      },
      series: [{ type: 'heatmap', name: 'Score', data: values, label: { show: true, color: '#e6e1cf' } }],
    };
  }, [evalMatrix, evalScores]);

  const evalTrendOption = useMemo(() => {
    const rows = (data?.trends ?? [])
      .filter((item) => item.task_type === 'eval' && item.metric_name === 'avg_score')
      .slice();
    if (rows.length === 0) {
      return chartFallbackOption('暂无质量趋势数据');
    }
    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: rows.map((item) => dayjs(item.created_at).format('MM-DD HH:mm')), axisLabel: chartTextStyle() },
      yAxis: { type: 'value', axisLabel: chartTextStyle(), splitLine: { lineStyle: { color: 'rgba(230,225,207,0.1)' } } },
      series: [{ type: 'line', name: '平均分', data: rows.map((item) => item.metric_value), smooth: true, color: '#50c878' }],
    };
  }, [data?.trends]);

  const perfThroughputOption = useMemo(() => {
    const rows = perfMetrics.slice().reverse();
    if (rows.length === 0) {
      return chartFallbackOption('请选择性能压测任务');
    }
    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' },
      legend: { textStyle: chartTextStyle(), top: 0 },
      xAxis: { type: 'category', data: rows.map((item) => `#${item.task_id} ${item.model_name}`), axisLabel: chartTextStyle() },
      yAxis: { type: 'value', axisLabel: chartTextStyle(), splitLine: { lineStyle: { color: 'rgba(230,225,207,0.1)' } } },
      series: [
        { type: 'bar', name: 'Req/s', data: rows.map((item) => item.request_throughput), color: '#6ab7ff' },
        { type: 'bar', name: 'Token/s', data: rows.map((item) => item.total_token_throughput), color: '#50c878' },
      ],
    };
  }, [perfMetrics]);

  const perfLatencyOption = useMemo(() => {
    const rows = perfMetrics.slice().reverse();
    if (rows.length === 0) {
      return chartFallbackOption('请选择性能压测任务');
    }
    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' },
      legend: { textStyle: chartTextStyle(), top: 0 },
      xAxis: {
        type: 'category',
        data: rows.map((item) => taskLabel(item.task_id, item.model_name)),
        axisLabel: { ...chartTextStyle(), interval: 0, formatter: chartTaskAxisLabel },
      },
      yAxis: { type: 'value', axisLabel: chartTextStyle(), splitLine: { lineStyle: { color: 'rgba(230,225,207,0.1)' } } },
      series: [
        { type: 'line', name: 'TTFT(ms)', data: rows.map((item) => item.avg_ttft), smooth: true, color: '#ffb454' },
        { type: 'line', name: 'TPOT(ms)', data: rows.map((item) => item.avg_tpot), smooth: true, color: '#ff5370' },
      ],
    };
  }, [perfMetrics]);

  const perfSuccessOption = useMemo(() => {
    const rows = perfMetrics.slice().reverse();
    if (rows.length === 0) {
      return chartFallbackOption('暂无成功率数据');
    }
    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: rows.map((item) => taskLabel(item.task_id, item.model_name)), axisLabel: chartTextStyle() },
      yAxis: { type: 'value', min: 0, max: 100, axisLabel: { ...chartTextStyle(), formatter: '{value}%' }, splitLine: { lineStyle: { color: 'rgba(230,225,207,0.1)' } } },
      series: [{ type: 'bar', name: '成功率', data: rows.map((item) => (item.success_rate ?? 0) * 100), itemStyle: { color: '#50c878' } }],
    };
  }, [perfMetrics]);

  const perfPercentileLineOption = useMemo(() => {
    const percentiles = Array.from(new Set(perfPercentiles.map((item) => item.percentile))).sort(
      (a, b) => percentileOrder(a) - percentileOrder(b),
    );
    const taskNames = Array.from(new Set(perfPercentiles.map((item) => taskLabel(item.task_id, item.model_name))));
    if (percentiles.length === 0 || taskNames.length === 0) {
      return chartFallbackOption('暂无 Percentile 折线数据');
    }
    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' },
      legend: { type: 'scroll', textStyle: chartTextStyle(), top: 0 },
      grid: { top: 48, left: 56, right: 24, bottom: 42 },
      xAxis: { type: 'category', data: percentiles, axisLabel: chartTextStyle() },
      yAxis: { type: 'value', axisLabel: chartTextStyle(), splitLine: { lineStyle: { color: 'rgba(230,225,207,0.1)' } } },
      series: taskNames.flatMap((name) => {
        const rows = perfPercentiles.filter((item) => taskLabel(item.task_id, item.model_name) === name);
        return [
          {
            type: 'line',
            name: `${name} Latency`,
            data: percentiles.map((percentile) => rows.find((item) => item.percentile === percentile)?.latency ?? null),
            smooth: true,
          },
          {
            type: 'line',
            name: `${name} TTFT`,
            data: percentiles.map((percentile) => rows.find((item) => item.percentile === percentile)?.ttft ?? null),
            smooth: true,
          },
        ];
      }),
    };
  }, [perfPercentiles]);

  const perfRadarOption = useMemo(() => {
    const rows = perfMetrics;
    if (rows.length === 0) {
      return chartFallbackOption('暂无性能雷达数据');
    }
    const maxReq = Math.max(...rows.map((item) => item.request_throughput ?? 0), 1);
    const maxToken = Math.max(...rows.map((item) => item.total_token_throughput ?? 0), 1);
    const minTtft = Math.min(...rows.map((item) => item.avg_ttft ?? Number.POSITIVE_INFINITY));
    const minTpot = Math.min(...rows.map((item) => item.avg_tpot ?? Number.POSITIVE_INFINITY));
    const safeMinTtft = Number.isFinite(minTtft) ? minTtft : 1;
    const safeMinTpot = Number.isFinite(minTpot) ? minTpot : 1;
    return {
      backgroundColor: 'transparent',
      tooltip: {},
      color: chartPalette,
      legend: { type: 'scroll', textStyle: chartTextStyle(), bottom: 0 },
      radar: {
        indicator: [
          { name: 'Req/s', max: 100 },
          { name: 'Token/s', max: 100 },
          { name: '成功率', max: 100 },
          { name: '低 TTFT', max: 100 },
          { name: '低 TPOT', max: 100 },
        ],
        center: ['50%', '48%'],
        radius: '66%',
        axisName: chartTextStyle(),
        splitArea: { areaStyle: { color: ['rgba(106,183,255,0.04)', 'rgba(80,200,120,0.03)'] } },
        splitLine: { lineStyle: { color: 'rgba(230,225,207,0.14)' } },
        axisLine: { lineStyle: { color: 'rgba(230,225,207,0.14)' } },
      },
      series: [
        {
          type: 'radar',
          symbolSize: 4,
          lineStyle: { width: 2 },
          areaStyle: { opacity: 0.16 },
          emphasis: { lineStyle: { width: 3 }, areaStyle: { opacity: 0.28 } },
          data: rows.map((item) => ({
            name: taskLabel(item.task_id, item.model_name),
            value: [
              ((item.request_throughput ?? 0) / maxReq) * 100,
              ((item.total_token_throughput ?? 0) / maxToken) * 100,
              (item.success_rate ?? 0) * 100,
              item.avg_ttft ? (safeMinTtft / item.avg_ttft) * 100 : 0,
              item.avg_tpot ? (safeMinTpot / item.avg_tpot) * 100 : 0,
            ],
          })),
        },
      ],
    };
  }, [perfMetrics]);

  const perfHeatmapOption = useMemo(() => {
    const metrics = ['Req/s', 'Token/s', '成功率', 'TTFT', 'TPOT'];
    const taskNames = perfMetrics.map((item) => taskLabel(item.task_id, item.model_name));
    if (perfMetrics.length === 0) {
      return chartFallbackOption('暂无性能指标热力图数据');
    }
    const maxReq = Math.max(...perfMetrics.map((item) => item.request_throughput ?? 0), 1);
    const maxToken = Math.max(...perfMetrics.map((item) => item.total_token_throughput ?? 0), 1);
    const minTtft = Math.min(...perfMetrics.map((item) => item.avg_ttft ?? Number.POSITIVE_INFINITY));
    const minTpot = Math.min(...perfMetrics.map((item) => item.avg_tpot ?? Number.POSITIVE_INFINITY));
    const safeMinTtft = Number.isFinite(minTtft) ? minTtft : 1;
    const safeMinTpot = Number.isFinite(minTpot) ? minTpot : 1;
    const values = perfMetrics.flatMap((item, yIndex) => [
      [0, yIndex, ((item.request_throughput ?? 0) / maxReq) * 100],
      [1, yIndex, ((item.total_token_throughput ?? 0) / maxToken) * 100],
      [2, yIndex, (item.success_rate ?? 0) * 100],
      [3, yIndex, item.avg_ttft ? (safeMinTtft / item.avg_ttft) * 100 : 0],
      [4, yIndex, item.avg_tpot ? (safeMinTpot / item.avg_tpot) * 100 : 0],
    ]);
    return {
      backgroundColor: 'transparent',
      tooltip: { position: 'top' },
      grid: { top: 32, left: 120, right: 36, bottom: 48 },
      xAxis: { type: 'category', data: metrics, axisLabel: chartTextStyle(), splitArea: { show: true } },
      yAxis: { type: 'category', data: taskNames, axisLabel: chartTextStyle(), splitArea: { show: true } },
      visualMap: {
        min: 0,
        max: 100,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        textStyle: chartTextStyle(),
        inRange: { color: ['#1a212c', '#6ab7ff', '#50c878'] },
      },
      series: [{ type: 'heatmap', name: '归一化表现', data: values, label: { show: true, formatter: ({ value }: { value: number[] }) => `${Math.round(value[2])}` } }],
    };
  }, [perfMetrics]);

  const handleExport = async (format: 'markdown' | 'html') => {
    if (selectedTaskIds.length === 0) {
      message.warning('请先选择要导出的任务');
      return;
    }
    try {
      const result = await exportReport.mutateAsync({ task_type: taskType, task_ids: selectedTaskIds, format });
      const suffix = format === 'html' ? 'html' : 'md';
      const filename = `${taskType}-report-${dayjs(result.generated_at).format('YYYYMMDDHHmmss')}.${suffix}`;
      downloadTextFile(result.content, filename, format === 'html' ? 'text/html' : 'text/markdown');
      message.success(`报告已生成并下载：${result.file_path}`);
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : '导出失败');
    }
  };

  const taskColumns: ColumnsType<ReportTaskOption> = [
    {
      title: '任务',
      dataIndex: 'task_name',
      render: (name: string, record) => (
        <Space direction="vertical" size={2}>
          <Text strong ellipsis={{ tooltip: name }} style={{ maxWidth: 240 }}>{name}</Text>
          <Text type="secondary" style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}>
            #{record.task_id} · {record.model_name} · {dayjs(record.created_at).format('MM-DD HH:mm')}
          </Text>
        </Space>
      ),
    },
    {
      title: '指标',
      dataIndex: 'primary_metric',
      width: 110,
      render: (value: number | null, record) => (
        <Text style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>
          {fmt(value, taskType === 'eval' ? 4 : 2)} {record.primary_metric_name ?? ''}
        </Text>
      ),
    },
  ];

  const evalColumns: ColumnsType<EvalDatasetScore> = [
    { title: '任务', dataIndex: 'task_name', width: 180 },
    { title: '模型', dataIndex: 'model_name', width: 180 },
    { title: '数据集', dataIndex: 'dataset_name', width: 160 },
    { title: '指标', dataIndex: 'metric_name', width: 120, render: (value: string | null) => value ?? '—' },
    {
      title: '分数',
      dataIndex: 'score',
      width: 120,
      render: (value: number | null) => <Text style={{ fontFamily: 'var(--font-mono)' }}>{fmt(value, 4)}</Text>,
    },
  ];

  const evalMatrixColumns = useMemo<ColumnsType<EvalScoreMatrixRow>>(() => {
    const datasets = Array.from(new Set(evalScores.map((item) => item.dataset_name)));
    return [
      { title: '任务', dataIndex: 'task_name', width: 180 },
      { title: '模型', dataIndex: 'model_name', width: 180 },
      ...datasets.map((dataset) => ({
        title: dataset,
        key: dataset,
        width: 130,
        render: (_: unknown, record: EvalScoreMatrixRow) => (
          <Text style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>
            {fmt((record.scores ?? {})[dataset], 4)}
          </Text>
        ),
      })),
    ];
  }, [evalScores]);

  const perfColumns: ColumnsType<PerfMetricRow> = [
    { title: '任务', dataIndex: 'task_name', width: 160 },
    { title: '模型', dataIndex: 'model_name', width: 180 },
    { title: '成功率', dataIndex: 'success_rate', width: 110, render: (value: number | null) => `${fmt(value ? value * 100 : value)}%` },
    { title: 'Req/s', dataIndex: 'request_throughput', width: 110, render: (value: number | null) => fmt(value) },
    { title: 'Token/s', dataIndex: 'total_token_throughput', width: 110, render: (value: number | null) => fmt(value) },
    { title: 'TTFT', dataIndex: 'avg_ttft', width: 100, render: (value: number | null) => `${fmt(value)} ms` },
    { title: 'TPOT', dataIndex: 'avg_tpot', width: 100, render: (value: number | null) => `${fmt(value)} ms` },
  ];

  const percentileColumns: ColumnsType<PerfPercentileRow> = [
    { title: '任务', dataIndex: 'task_name', width: 160 },
    { title: 'P', dataIndex: 'percentile', width: 80 },
    { title: 'Latency', dataIndex: 'latency', width: 110, render: (value: number | null) => fmt(value) },
    { title: 'TTFT', dataIndex: 'ttft', width: 110, render: (value: number | null) => fmt(value) },
    { title: 'TPOT', dataIndex: 'tpot', width: 110, render: (value: number | null) => fmt(value) },
  ];

  const rowSelection = {
    selectedRowKeys: selectedTaskIds,
    onChange: (keys: Key[]) => {
      if (keys.length > 8) {
        message.warning('最多选择 8 个任务进行对比');
        return;
      }
      setSelectedTaskIds(keys.map(Number));
    },
  };

  const hasSelection = selectedTaskIds.length > 0;
  const selectorCardStyle = {
    background: 'var(--bg-elevated)',
    borderColor: 'var(--border-default)',
    position: 'sticky' as const,
    top: 12,
    maxHeight: 'calc(100vh - 260px)',
  };
  const analysisWindowStyle = {
    height: 'calc(100vh - 260px)',
    minHeight: 560,
    overflowY: 'auto' as const,
    overflowX: 'hidden' as const,
    paddingRight: 8,
    paddingBottom: 8,
  };

  const renderEvalAnalysis = () => (
    <Space direction="vertical" size={18} style={{ width: '100%' }}>
      <Card title="质量核心对比" className="scroll-card page-chart-card" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-default)' }}>
        <ReactECharts key="eval-bar" notMerge option={evalBarOption} style={{ height: 360 }} />
      </Card>
      <Card
        title="Dataset 分数覆盖对比"
        extra={<Text type="secondary">多 Dataset 使用透明雷达；单 Dataset 自动切换为柱状对比</Text>}
        className="scroll-card page-chart-card"
        style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-default)' }}
      >
        <ReactECharts key="eval-radar" notMerge option={evalRadarOption} style={{ height: 460 }} />
      </Card>
      <Card title="质量深入分析" className="scroll-card page-table-card" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-default)' }}>
        <Tabs
          items={[
            {
              key: 'dataset',
              label: '维度对比',
              children: <ReactECharts key="eval-dataset-bar" notMerge option={evalDatasetBarOption} style={{ height: 380 }} />,
            },
            {
              key: 'heatmap',
              label: '分数热力图',
              children: <ReactECharts key="eval-heatmap" notMerge option={evalHeatmapOption} style={{ height: 380 }} />,
            },
            {
              key: 'trend',
              label: '趋势线',
              children: <ReactECharts key="eval-trend" notMerge option={evalTrendOption} style={{ height: 340 }} />,
            },
            {
              key: 'matrix',
              label: '分数矩阵',
              children: (
                <Table<EvalScoreMatrixRow>
                  rowKey="task_id"
                  columns={evalMatrixColumns}
                  dataSource={evalMatrix}
                  scroll={{ x: 520 + evalMatrixColumns.length * 130, y: 340 }}
                  pagination={false}
                />
              ),
            },
            {
              key: 'detail',
              label: '明细表格',
              children: (
                <Table<EvalDatasetScore>
                  rowKey={(record) => `${record.task_id}-${record.dataset_name}`}
                  columns={evalColumns}
                  dataSource={evalScores}
                  scroll={{ x: 900, y: 340 }}
                  pagination={{ pageSize: 10, showSizeChanger: false }}
                />
              ),
            },
          ]}
        />
      </Card>
    </Space>
  );

  const renderPerfAnalysis = () => (
    <Space direction="vertical" size={18} style={{ width: '100%' }}>
      <Card title="吞吐核心对比" className="scroll-card page-chart-card" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-default)' }}>
        <ReactECharts key="perf-throughput" notMerge option={perfThroughputOption} style={{ height: 360 }} />
      </Card>
      <Card title="延迟趋势对比" className="scroll-card page-chart-card" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-default)' }}>
        <ReactECharts key="perf-latency" notMerge option={perfLatencyOption} style={{ height: 340 }} />
      </Card>
      <Card
        title="性能透明覆盖雷达"
        extra={<Text type="secondary">吞吐、成功率和低延迟表现统一归一化展示</Text>}
        className="scroll-card page-chart-card"
        style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-default)' }}
      >
        <ReactECharts key="perf-radar" notMerge option={perfRadarOption} style={{ height: 460 }} />
      </Card>
      <Card title="性能深入分析" className="scroll-card page-table-card" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-default)' }}>
        <Tabs
          items={[
            {
              key: 'success',
              label: '成功率',
              children: <ReactECharts key="perf-success" notMerge option={perfSuccessOption} style={{ height: 340 }} />,
            },
            {
              key: 'percentile',
              label: 'Percentile',
              children: <ReactECharts key="perf-percentile-line" notMerge option={perfPercentileLineOption} style={{ height: 380 }} />,
            },
            {
              key: 'heatmap',
              label: '指标热力图',
              children: <ReactECharts key="perf-heatmap" notMerge option={perfHeatmapOption} style={{ height: 380 }} />,
            },
            {
              key: 'metrics',
              label: '核心指标表',
              children: (
                <Table<PerfMetricRow>
                  rowKey="task_id"
                  columns={perfColumns}
                  dataSource={perfMetrics}
                  scroll={{ x: 1000, y: 340 }}
                  pagination={false}
                />
              ),
            },
            {
              key: 'detail',
              label: 'Percentile 明细',
              children: (
                <Table<PerfPercentileRow>
                  rowKey={(record) => `${record.task_id}-${record.percentile}`}
                  columns={percentileColumns}
                  dataSource={perfPercentiles}
                  scroll={{ x: 760, y: 340 }}
                  pagination={{ pageSize: 10, showSizeChanger: false }}
                />
              ),
            },
          ]}
        />
      </Card>
    </Space>
  );

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
            报告对比
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            选择质量评测或性能压测任务，查看单任务结果与多任务可视化对比。
          </Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} loading={tasksFetching || compareFetching} onClick={() => { refetchTasks(); refetchCompare(); }}>
            刷新
          </Button>
          <Button icon={<FileMarkdownOutlined />} loading={exportReport.isPending} onClick={() => handleExport('markdown')}>
            导出 Markdown
          </Button>
          <Button type="primary" icon={<Html5Outlined />} loading={exportReport.isPending} onClick={() => handleExport('html')}>
            导出 HTML
          </Button>
        </Space>
      </motion.div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} md={8}>
          <Card style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-default)' }}>
            <Statistic title="可选任务" value={stats.total} prefix={<BarChartOutlined />} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-default)' }}>
            <Statistic title="已选任务" value={stats.selected} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-default)' }}>
            <Statistic
              title={taskType === 'eval' ? '平均分' : '平均 Req/s'}
              value={stats.avg ?? '—'}
              precision={isNumber(stats.avg) ? (taskType === 'eval' ? 4 : 2) : undefined}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} align="top">
        <Col xs={24} xl={7}>
          <Card title="任务选择" className="scroll-card page-table-card" style={selectorCardStyle}>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Segmented
                block
                value={taskType}
                onChange={(value) => setTaskType(value as ReportTaskType)}
                options={[
                  { label: '质量评测', value: 'eval' },
                  { label: '性能压测', value: 'perf' },
                ]}
              />
              <Input
                prefix={<SearchOutlined />}
                allowClear
                placeholder="搜索任务 / 模型"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
              />
              <Table<ReportTaskOption>
                rowKey="task_id"
                size="small"
                loading={tasksFetching}
                rowSelection={rowSelection}
                columns={taskColumns}
                dataSource={tasks}
                scroll={{ x: 460, y: 'calc(100vh - 470px)' }}
                pagination={{ pageSize: 12, showSizeChanger: false }}
                locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无已完成任务" /> }}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                最多选择 8 个任务。单选查看详情，多选进行横向对比。
              </Text>
            </Space>
          </Card>
        </Col>

        <Col xs={24} xl={17}>
          <div style={analysisWindowStyle}>
            {!hasSelection ? (
              <Card style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-default)' }}>
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="请选择左侧任务开始可视化分析" />
              </Card>
            ) : taskType === 'eval' ? (
              renderEvalAnalysis()
            ) : (
              renderPerfAnalysis()
            )}
          </div>
        </Col>
      </Row>
    </div>
  );
}
