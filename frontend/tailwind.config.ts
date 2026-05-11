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
        // 与 AntD 主题对齐的暗色终端美学
        bg: {
          primary: '#0a0e14',
          secondary: '#11161d',
          elevated: '#1a212c',
        },
        accent: {
          primary: '#50c878', // 终端绿：通过/主操作
          warning: '#ffb454', // 橙：运行中
          danger: '#ff5370', // 红：失败
          info: '#6ab7ff', // 蓝：信息
        },
        muted: {
          DEFAULT: '#5c6773',
        },
        border: {
          subtle: '#1f2731',
          strong: '#3d4a5c',
        },
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
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
