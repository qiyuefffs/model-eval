import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // 避免与 AntD 的样式冲突：禁用 preflight、加前缀做隔离（如需）
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        // 与 AntD 主题对齐的企业级低对比暗色风格
        bg: {
          primary: '#080c14',
          secondary: '#0f172a',
          elevated: '#111827',
          sidebar: '#020617',
        },
        accent: {
          primary: '#38bdf8', // sky：主操作
          success: '#22c55e', // 绿色：成功
          warning: '#f59e0b', // 琥珀：运行中/警告
          danger: '#ef4444', // 红色：失败
          info: '#38bdf8', // 青蓝：信息
          purple: '#8b5cf6', // 紫色：辅助维度
        },
        muted: {
          DEFAULT: '#64748b',
        },
        border: {
          subtle: 'rgba(148, 163, 184, 0.16)',
          strong: 'rgba(148, 163, 184, 0.24)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
      animation: {
        breathe: 'breathe 2.4s ease-in-out infinite',
      },
      keyframes: {
        breathe: {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
