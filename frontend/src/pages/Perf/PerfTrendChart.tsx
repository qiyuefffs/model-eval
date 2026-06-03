import { Card, Typography } from 'antd';
import ReactECharts from 'echarts-for-react';

const { Text } = Typography;

// TODO: replace with API data —— 当前后端暂无时序趋势接口，使用 mock 数据占位，
// 数据结构与真实接口对齐：{ time, ttft(s), tpot(s), throughput(tokens/s) }。
const perfTrendData = [
  { time: '16:35', ttft: 0.82, tpot: 0.42, throughput: 118 },
  { time: '16:40', ttft: 0.95, tpot: 0.51, throughput: 135 },
  { time: '16:45', ttft: 0.76, tpot: 0.48, throughput: 122 },
  { time: '16:50', ttft: 1.12, tpot: 0.62, throughput: 152 },
  { time: '16:55', ttft: 0.88, tpot: 0.45, throughput: 128 },
  { time: '17:00', ttft: 0.93, tpot: 0.39, throughput: 141 },
];

const AXIS_COLOR = '#64748b';
const GRID_COLOR = 'rgba(148, 163, 184, 0.12)';

export default function PerfTrendChart() {
  const option = {
    grid: { top: 48, right: 56, bottom: 36, left: 48 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#020617',
      borderColor: 'rgba(148, 163, 184, 0.18)',
      borderWidth: 1,
      textStyle: { color: '#e5e7eb', fontSize: 12 },
    },
    legend: {
      top: 8,
      right: 8,
      icon: 'roundRect',
      itemWidth: 12,
      itemHeight: 4,
      textStyle: { color: '#94a3b8', fontSize: 12 },
      data: ['TTFT (s)', 'TPOT (s)', 'tokens/s'],
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: perfTrendData.map((d) => d.time),
      axisLine: { lineStyle: { color: GRID_COLOR } },
      axisTick: { show: false },
      axisLabel: { color: AXIS_COLOR, fontSize: 11 },
    },
    yAxis: [
      {
        type: 'value',
        name: 's',
        nameTextStyle: { color: AXIS_COLOR, fontSize: 11 },
        axisLabel: { color: AXIS_COLOR, fontSize: 11 },
        splitLine: { lineStyle: { color: GRID_COLOR } },
      },
      {
        type: 'value',
        name: 'tokens/s',
        nameTextStyle: { color: AXIS_COLOR, fontSize: 11 },
        axisLabel: { color: AXIS_COLOR, fontSize: 11 },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: 'TTFT (s)',
        type: 'line',
        smooth: true,
        symbolSize: 5,
        lineStyle: { width: 2 },
        itemStyle: { color: '#3b82f6' },
        data: perfTrendData.map((d) => d.ttft),
      },
      {
        name: 'TPOT (s)',
        type: 'line',
        smooth: true,
        symbolSize: 5,
        lineStyle: { width: 2 },
        itemStyle: { color: '#8b5cf6' },
        data: perfTrendData.map((d) => d.tpot),
      },
      {
        name: 'tokens/s',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        symbolSize: 5,
        lineStyle: { width: 2 },
        itemStyle: { color: '#14b8a6' },
        data: perfTrendData.map((d) => d.throughput),
      },
    ],
  };

  return (
    <Card
      style={{ marginBottom: 16 }}
      title={
        <div>
          <Text strong style={{ fontSize: 14 }}>
            性能趋势
          </Text>
          <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
            最近 30 分钟
          </Text>
        </div>
      }
    >
      <ReactECharts option={option} style={{ height: 300 }} notMerge lazyUpdate />
    </Card>
  );
}
