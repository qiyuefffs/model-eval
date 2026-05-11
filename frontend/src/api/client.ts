import axios, { type AxiosInstance } from 'axios';

// Axios 实例 — 所有后端调用走这里，便于统一拦截器/重试/错误处理
export const apiClient: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 响应拦截器：抛出后端结构化错误
apiClient.interceptors.response.use(
  (resp) => resp,
  (error) => {
    if (error.response) {
      const detail = error.response.data?.detail ?? error.message;
      return Promise.reject(new Error(`[${error.response.status}] ${detail}`));
    }
    if (error.request) {
      return Promise.reject(new Error('网络错误：后端未响应，请检查服务是否启动'));
    }
    return Promise.reject(error);
  },
);
