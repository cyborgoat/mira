import { ConfigProvider } from 'antd';
import { StoreProvider, useStore } from './store/context';
import { MainLayout } from './components/layout/MainLayout';
import { BootLoader } from './components/layout/BootLoader';
import './styles/global.css';
import './styles/components.css';

function AppInner() {
  const { ready } = useStore();
  if (!ready) return <BootLoader />;
  return <MainLayout />;
}

export default function App() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#1B2A4E',
          colorLink: '#E8B86D',
          borderRadius: 8,
          fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif',
        },
      }}
    >
      <StoreProvider>
        <AppInner />
      </StoreProvider>
    </ConfigProvider>
  );
}
