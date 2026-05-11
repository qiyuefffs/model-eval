import { theme, type ThemeConfig } from 'antd';

// AntD 5 暗色主题 — 与 tokens.css 对齐
export const antdTheme: ThemeConfig = {
  algorithm: theme.darkAlgorithm,
  cssVar: true,
  token: {
    colorPrimary: '#50c878',
    colorSuccess: '#50c878',
    colorWarning: '#ffb454',
    colorError: '#ff5370',
    colorInfo: '#6ab7ff',

    colorBgBase: '#0a0e14',
    colorBgContainer: '#11161d',
    colorBgElevated: '#1a212c',
    colorBgLayout: '#0a0e14',

    colorTextBase: '#e6e1cf',
    colorText: '#e6e1cf',
    colorTextSecondary: '#b3b1ad',
    colorTextTertiary: '#5c6773',

    colorBorder: '#1f2731',
    colorBorderSecondary: '#3d4a5c',

    fontFamily: '"Manrope", system-ui, sans-serif',
    fontFamilyCode: '"JetBrains Mono", monospace',

    borderRadius: 6,
    wireframe: false,
  },
  components: {
    Layout: {
      headerBg: '#11161d',
      siderBg: '#0a0e14',
      bodyBg: '#0a0e14',
    },
    Menu: {
      darkItemBg: '#0a0e14',
      darkSubMenuItemBg: '#11161d',
      darkItemSelectedBg: 'rgba(80, 200, 120, 0.15)',
      darkItemSelectedColor: '#50c878',
    },
    Table: {
      headerBg: '#1a212c',
      rowHoverBg: '#1a212c',
      borderColor: '#1f2731',
    },
    Button: {
      fontWeight: 600,
    },
    Card: {
      colorBgContainer: '#11161d',
    },
    Tag: {
      defaultBg: '#1a212c',
      defaultColor: '#b3b1ad',
    },
  },
};
