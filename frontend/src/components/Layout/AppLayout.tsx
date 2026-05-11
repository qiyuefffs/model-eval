import { Layout, Menu, Typography } from 'antd';
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
import { motion } from 'framer-motion';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

type MenuItem = Required<MenuProps>['items'][number];

const menuItems: MenuItem[] = [
  { key: '/', icon: <DashboardOutlined />, label: '总览' },
  { key: '/models', icon: <AppstoreOutlined />, label: '模型管理' },
  { key: '/datasets', icon: <DatabaseOutlined />, label: '数据集' },
  { key: '/eval', icon: <ExperimentOutlined />, label: '质量评测' },
  { key: '/perf', icon: <ThunderboltOutlined />, label: '性能压测' },
  { key: '/tasks', icon: <UnorderedListOutlined />, label: '任务监控' },
  { key: '/reports', icon: <BarChartOutlined />, label: '报告对比' },
];

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* 侧边栏 */}
      <Sider
        width={220}
        style={{
          borderRight: '1px solid var(--border-subtle)',
          background: 'var(--bg-primary)',
        }}
      >
        {/* Logo */}
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            paddingLeft: 20,
            gap: 12,
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <motion.div
            initial={{ scale: 0, rotate: -90 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200 }}
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: 'linear-gradient(135deg, #50c878 0%, #6ab7ff 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0a0e14',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
            }}
          >
            E
          </motion.div>
          <Title
            level={5}
            style={{
              margin: 0,
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            EvalPlatform
          </Title>
        </div>

        {/* 菜单 */}
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={(e) => navigate(e.key)}
          style={{ background: 'transparent', borderRight: 0, marginTop: 12 }}
        />
      </Sider>

      <Layout style={{ background: 'var(--bg-primary)' }}>
        <Header
          style={{
            padding: '0 24px',
            background: 'var(--bg-secondary)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Typography.Text
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: 'var(--text-muted)',
            }}
          >
            $ evalscope --version | tail -1
          </Typography.Text>
        </Header>

        <Content style={{ overflow: 'auto' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
