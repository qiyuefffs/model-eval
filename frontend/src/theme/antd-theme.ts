import { theme, type ThemeConfig } from 'antd';

// AntD 5 企业级低对比暗色主题 — 与 tokens.css 对齐
export const antdTheme: ThemeConfig = {
  algorithm: theme.darkAlgorithm,
  cssVar: true,
  token: {
    colorPrimary: '#38bdf8',
    colorSuccess: '#22c55e',
    colorWarning: '#f59e0b',
    colorError: '#ef4444',
    colorInfo: '#38bdf8',

    colorBgBase: '#080c14',
    colorBgContainer: '#0f172a',
    colorBgElevated: '#111827',
    colorBgLayout: '#080c14',

    colorTextBase: '#e5e7eb',
    colorText: '#e5e7eb',
    colorTextSecondary: '#94a3b8',
    colorTextTertiary: '#64748b',

    colorBorder: 'rgba(148, 163, 184, 0.16)',
    colorBorderSecondary: 'rgba(148, 163, 184, 0.24)',

    fontFamily: '"Inter", system-ui, sans-serif',
    fontFamilyCode: '"IBM Plex Mono", monospace',

    borderRadius: 10,
    wireframe: false,
  },
  components: {
    Layout: {
      headerBg: '#080c14',
      siderBg: '#020617',
      bodyBg: '#080c14',
    },
    Menu: {
      darkItemBg: '#020617',
      darkSubMenuItemBg: '#020617',
      darkItemSelectedBg: 'rgba(56, 189, 248, 0.12)',
      darkItemSelectedColor: '#7dd3fc',
      itemBorderRadius: 8,
    },
    Table: {
      headerBg: '#0f172a',
      rowHoverBg: 'rgba(148, 163, 184, 0.06)',
      borderColor: 'rgba(148, 163, 184, 0.10)',
    },
    Button: {
      fontWeight: 600,
    },
    Card: {
      colorBgContainer: '#0f172a',
    },
    Tag: {
      defaultBg: '#111827',
      defaultColor: '#94a3b8',
    },
  },
};
