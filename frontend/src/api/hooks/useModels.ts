import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { components } from '../schema';

// 从 OpenAPI 自动生成的 schema 取类型，保证前后端零漂移
export type ModelCreate = components['schemas']['ModelCreate'];
export type ModelRead = components['schemas']['ModelRead'];
export type ConnectivityTestResult = components['schemas']['ConnectivityTestResult'];

const MODELS_KEY = ['models'] as const;

// 列表
export function useModels() {
  return useQuery({
    queryKey: MODELS_KEY,
    queryFn: async () => {
      const { data } = await apiClient.get<ModelRead[]>('/models');
      return data;
    },
  });
}

// 创建
export function useCreateModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ModelCreate) => {
      const { data } = await apiClient.post<ModelRead>('/models', payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MODELS_KEY });
    },
  });
}

// 删除
export function useDeleteModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (modelPk: number) => {
      await apiClient.delete(`/models/${modelPk}`);
      return modelPk;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MODELS_KEY });
    },
  });
}

// 连通性测试 — 不刷新列表，但成功后单独更新该行
export function useTestModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (modelPk: number) => {
      const { data } = await apiClient.post<ConnectivityTestResult>(`/models/${modelPk}/test`);
      return { modelPk, result: data };
    },
    onSuccess: ({ result }) => {
      // 成功测试会更新 updated_at，刷新列表显示新时间
      if (result.ok) {
        qc.invalidateQueries({ queryKey: MODELS_KEY });
      }
    },
  });
}
