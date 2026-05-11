import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';

export interface HealthResponse {
  status: string;
  app_name: string;
  version: string;
  timestamp: string;
}

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const { data } = await apiClient.get<HealthResponse>('/health');
      return data;
    },
    refetchInterval: 30000, // 每 30 秒探活一次
    retry: 1,
  });
}
