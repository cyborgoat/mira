import { lazy, Suspense } from 'react';
import { useStore } from '../../store/context';
import { AppSider } from './AppSider';

const TasksPage = lazy(() => import('../../pages/tasks/TasksPage').then(m => ({ default: m.TasksPage })));
const ReportPage = lazy(() => import('../../pages/report/ReportPage').then(m => ({ default: m.ReportPage })));
const WikiPage = lazy(() => import('../../pages/wiki/WikiPage').then(m => ({ default: m.WikiPage })));
const AskMiraPage = lazy(() => import('../../pages/ask/AskMiraPage').then(m => ({ default: m.AskMiraPage })));
const TalentPoolPage = lazy(() => import('../../pages/talent/TalentPoolPage').then(m => ({ default: m.TalentPoolPage })));
const SettingsPage = lazy(() => import('../../pages/settings/SettingsPage').then(m => ({ default: m.SettingsPage })));

function RouteRenderer({ route }: { route: string }) {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: 'var(--mira-text-muted)' }}>加载中…</div>}>
      {route === 'tasks' && <TasksPage />}
      {route === 'report' && <ReportPage />}
      {route === 'wiki' && <WikiPage />}
      {route === 'ask' && <AskMiraPage />}
      {route === 'talent' && <TalentPoolPage />}
      {route === 'settings' && <SettingsPage />}
    </Suspense>
  );
}

export function MainLayout() {
  const { state } = useStore();

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--mira-bg)' }}>
      <AppSider />
      <main
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px 28px',
        }}
      >
        <RouteRenderer route={state.route} />
      </main>
    </div>
  );
}
