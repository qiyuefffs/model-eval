import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { components } from '../schema';

export type EvalTaskCreate = components['schemas']['EvalTaskCreate'];
export type EvalTaskRead = components['schemas']['EvalTaskRead'];
export type EvalResultRead = components['schemas']['EvalResultRead'];
export type EvalTaskStatus = EvalTaskRead['status'];

export interface EvalTaskFilters {
  status?: EvalTaskStatus;
  modelPk?: number;
}

const EVAL_TASKS_KEY = ['eval-tasks'] as const;

export function useEvalTasks(filters: EvalTaskFilters = {}) {
  return useQuery({
    queryKey: [...EVAL_TASKS_KEY, filters],
    refetchInterval: (query) => {
      const tasks = query.state.data as EvalTaskRead[] | undefined;
      return tasks?.some((task) => task.status === 'pending' || task.status === 'running') ? 3000 : false;
    },
    queryFn: async () => {
      const { data } = await apiClient.get<EvalTaskRead[]>('/eval-tasks', {
        params: {
          status: filters.status || undefined,
          model_pk: filters.modelPk || undefined,
        },
      });
      return data;
    },
  });
}

export function useEvalTask(taskId?: number) {
  return useQuery({
    queryKey: [...EVAL_TASKS_KEY, taskId],
    enabled: Boolean(taskId),
    refetchInterval: (query) => {
      const task = query.state.data as EvalTaskRead | undefined;
      return task?.status === 'pending' || task?.status === 'running' ? 3000 : false;
    },
    queryFn: async () => {
      const { data } = await apiClient.get<EvalTaskRead>(`/eval-tasks/${taskId}`);
      return data;
    },
  });
}

export function useCreateEvalTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: EvalTaskCreate) => {
      const { data } = await apiClient.post<EvalTaskRead>('/eval-tasks', payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: EVAL_TASKS_KEY });
    },
  });
}
