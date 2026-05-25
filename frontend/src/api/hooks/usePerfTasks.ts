import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { components } from '../schema';

export type PerfTaskCreate = components['schemas']['PerfTaskCreate'];
export type PerfTaskRead = components['schemas']['PerfTaskRead'];
export type PerfResultRead = components['schemas']['PerfResultRead'];
export type PerfTaskStatus = PerfTaskRead['status'];

export interface PerfTaskFilters {
  status?: PerfTaskStatus;
  modelPk?: number;
}

const PERF_TASKS_KEY = ['perf-tasks'] as const;

export function usePerfTasks(filters: PerfTaskFilters = {}) {
  return useQuery({
    queryKey: [...PERF_TASKS_KEY, filters],
    refetchInterval: (query) => {
      const tasks = query.state.data as PerfTaskRead[] | undefined;
      return tasks?.some((task) => task.status === 'pending' || task.status === 'running') ? 3000 : false;
    },
    queryFn: async () => {
      const { data } = await apiClient.get<PerfTaskRead[]>('/perf-tasks', {
        params: {
          status: filters.status || undefined,
          model_pk: filters.modelPk || undefined,
        },
      });
      return data;
    },
  });
}

export function usePerfTask(taskId?: number) {
  return useQuery({
    queryKey: [...PERF_TASKS_KEY, taskId],
    enabled: Boolean(taskId),
    refetchInterval: (query) => {
      const task = query.state.data as PerfTaskRead | undefined;
      return task?.status === 'pending' || task?.status === 'running' ? 3000 : false;
    },
    queryFn: async () => {
      const { data } = await apiClient.get<PerfTaskRead>(`/perf-tasks/${taskId}`);
      return data;
    },
  });
}

export function useCreatePerfTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: PerfTaskCreate) => {
      const { data } = await apiClient.post<PerfTaskRead>('/perf-tasks', payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PERF_TASKS_KEY });
    },
  });
}
