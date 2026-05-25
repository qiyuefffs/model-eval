import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { components } from '../schema';

export type ReportCompareRequest = components['schemas']['ReportCompareRequest'];
export type ReportCompareResponse = components['schemas']['ReportCompareResponse'];
export type ReportExportRequest = components['schemas']['ReportExportRequest'];
export type ReportExportResponse = components['schemas']['ReportExportResponse'];
export type ReportTaskType = components['schemas']['ReportCompareRequest']['task_type'];
export type ReportTaskOption = components['schemas']['ReportTaskOption'];
export type ReportTaskSummary = components['schemas']['ReportTaskSummary'];
export type EvalDatasetScore = components['schemas']['EvalDatasetScore'];
export type EvalScoreMatrixRow = components['schemas']['EvalScoreMatrixRow'];
export type PerfMetricRow = components['schemas']['PerfMetricRow'];
export type PerfPercentileRow = components['schemas']['PerfPercentileRow'];
export type ReportTrendPoint = components['schemas']['ReportTrendPoint'];

const REPORT_COMPARE_KEY = ['reports', 'compare'] as const;
const REPORT_TASKS_KEY = ['reports', 'tasks'] as const;

export function useReportTasks(taskType: ReportTaskType, keyword?: string) {
  return useQuery({
    queryKey: [...REPORT_TASKS_KEY, taskType, keyword],
    queryFn: async () => {
      const { data } = await apiClient.get<{ task_type: ReportTaskType; tasks: ReportTaskOption[] }>('/reports/tasks', {
        params: {
          task_type: taskType,
          keyword: keyword || undefined,
        },
      });
      return data;
    },
  });
}

export function useReportCompare(payload: ReportCompareRequest) {
  return useQuery({
    queryKey: [...REPORT_COMPARE_KEY, payload],
    enabled: (payload.task_ids?.length ?? 0) > 0,
    queryFn: async () => {
      const { data } = await apiClient.post<ReportCompareResponse>('/reports/compare', payload);
      return data;
    },
  });
}

export function useExportReport() {
  return useMutation({
    mutationFn: async (payload: ReportExportRequest) => {
      const { data } = await apiClient.post<ReportExportResponse>('/reports/export', payload);
      return data;
    },
  });
}
