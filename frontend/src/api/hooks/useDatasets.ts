import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { components } from '../schema';

export type BenchmarkInfo = components['schemas']['BenchmarkInfo'];
export type CustomDatasetRead = components['schemas']['CustomDatasetRead'];

export interface BenchmarkFilters {
  keyword?: string;
  tag?: string;
  backend?: string;
  evalType?: string;
}

export interface DatasetFilters {
  datasetType?: string;
  tag?: string;
}

export interface DatasetUploadPayload {
  name: string;
  datasetType: string;
  file: File;
  description?: string;
  tags?: string[];
}

const BENCHMARKS_KEY = ['benchmarks'] as const;
const DATASETS_KEY = ['datasets'] as const;

export function useBenchmarks(filters: BenchmarkFilters = {}) {
  return useQuery({
    queryKey: [...BENCHMARKS_KEY, filters],
    queryFn: async () => {
      const { data } = await apiClient.get<BenchmarkInfo[]>('/benchmarks', {
        params: {
          keyword: filters.keyword || undefined,
          tag: filters.tag || undefined,
          backend: filters.backend || undefined,
          eval_type: filters.evalType || undefined,
        },
      });
      return data;
    },
  });
}

export function useCustomDatasets(filters: DatasetFilters = {}) {
  return useQuery({
    queryKey: [...DATASETS_KEY, filters],
    queryFn: async () => {
      const { data } = await apiClient.get<CustomDatasetRead[]>('/datasets', {
        params: {
          dataset_type: filters.datasetType || undefined,
          tag: filters.tag || undefined,
        },
      });
      return data;
    },
  });
}

export function useUploadDataset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: DatasetUploadPayload) => {
      const form = new FormData();
      form.append('name', payload.name);
      form.append('dataset_type', payload.datasetType);
      form.append('file', payload.file);
      if (payload.description) form.append('description', payload.description);
      if (payload.tags && payload.tags.length > 0) form.append('tags', payload.tags.join(','));

      const { data } = await apiClient.post<CustomDatasetRead>('/datasets', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: DATASETS_KEY });
    },
  });
}

export function useDeleteDataset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (datasetPk: number) => {
      await apiClient.delete(`/datasets/${datasetPk}`);
      return datasetPk;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: DATASETS_KEY });
    },
  });
}
