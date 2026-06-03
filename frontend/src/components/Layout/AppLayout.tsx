import { Avatar, Layout, Menu, Typography } from 'antd';
import type { MenuProps } from 'antd';
import {
  AppstoreOutlined,
  BarChartOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  ExperimentOutlined,
  ThunderboltOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

type MenuItem = Required<MenuProps>['items'][number];

const menuItems: MenuItem[] = [
  { key: '/', icon: <DashboardOutlined />, label: '总览' },
  { key: '/models', icon: <AppstoreOutlined />, label: '模型管理' },
  { key: '/datasets', icon: <DatabaseOutlined />, label: '数据集' },
  { key: '/eval', icon: <ExperimentOutlined />, label: '质量评测' },
  { key: '/perf', icon: <ThunderboltOutlined />, label: '性能压测' },
  { key: '/tasks', icon: <UnorderedListOutlined />, label: '任务中心' },
  { key: '/reports', icon: <BarChartOutlined />, label: '报告对比' },
];

function ModelGaugeLogo() {
  return (
    <svg width="24" height="24" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        d="M6.5 21.5a10.5 10.5 0 1 1 19 0"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M16 7v3M8.5 12l2.2 2M23.5 12l-2.2 2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="m16 20 5-5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="16" cy="20" r="2.4" fill="currentColor" />
      <path d="M7 24.5h18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* 侧边栏 */}
      <Sider
        width={232}
        style={{
          borderRight: '1px solid var(--border-subtle)',
          background: 'var(--bg-sidebar)',
          height: '100vh',
          position: 'sticky',
          top: 0,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Logo */}
          <div
            style={{
              height: 64,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              paddingLeft: 18,
              gap: 11,
              borderBottom: '1px solid var(--border-subtle)',
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 9,
                background: 'linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#04121f',
              }}
            >
              <ModelGaugeLogo />
            </div>
            <div>
              <Title
                level={5}
                style={{
                  margin: 0,
                  fontWeight: 700,
                  letterSpacing: '-0.4px',
                  color: 'var(--text-primary)',
                }}
              >
                ModelGauge
              </Title>
              <Typography.Text
                style={{ color: 'var(--text-muted)', fontSize: 10, letterSpacing: '1.2px' }}
              >
                EVALUATION HUB
              </Typography.Text>
            </div>
          </div>

          {/* 菜单 */}
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
            <Menu
              theme="dark"
              mode="inline"
              selectedKeys={[location.pathname]}
              items={menuItems}
              onClick={(e) => navigate(e.key)}
              style={{ background: 'transparent', borderRight: 0, marginTop: 12 }}
            />
          </div>

          {/* 底部：用户信息 + 系统状态 */}
          <div
            style={{
              flexShrink: 0,
              padding: '12px 16px',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <Avatar
              size={34}
              style={{ background: 'rgba(56, 189, 248, 0.16)', color: '#7dd3fc', flexShrink: 0 }}
            >
              A
            </Avatar>
            <div style={{ minWidth: 0, lineHeight: 1.3 }}>
              <div style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 600 }}>
                admin
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'var(--accent-success)',
                    flexShrink: 0,
                  }}
                />
                <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>系统正常</span>
              </div>
            </div>
          </div>
        </div>
      </Sider>

      <Layout style={{ background: 'var(--bg-primary)' }}>
        <Header
          style={{
            padding: '0 24px',
            background: 'var(--bg-primary)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Typography.Text style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            模型评估与性能洞察
          </Typography.Text>
        </Header>

        <Content className="app-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
