import { useState } from 'react';
import { Avatar, Segmented } from 'antd';
import { useStore, useActions } from '../../store/context';
import { MENU_ITEMS } from '../../constants';
import type { ViewMode } from '../../types';

export function AppSider() {
  const { state } = useStore();
  const { setRoute } = useActions();
  const [viewMode, setViewMode] = useState<ViewMode>('personal');

  const handleViewChange = (val: string | number) => {
    const mode = val as ViewMode;
    setViewMode(mode);
    setRoute('tasks');
  };

  const visibleMenuItems = MENU_ITEMS.filter(
    (item) => !item.managementOnly || viewMode === 'management'
  );

  return (
    <div
      style={{
        width: 200,
        height: '100vh',
        background: '#fff',
        borderRight: '1px solid var(--mira-mist)',
        display: 'flex',
        flexDirection: 'column',
        padding: '12px 0',
        flexShrink: 0,
      }}
    >
      {/* User area */}
      <div style={{ padding: '0 16px 12px', borderBottom: '1px solid var(--mira-mist)', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <Avatar size={36} style={{ background: '#E8B86D', fontSize: 18 }}>
            🪞
          </Avatar>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--mira-text)', lineHeight: 1.4 }}>
              Mira·{viewMode === 'personal' ? 'Self' : 'Team'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--mira-text-muted)', lineHeight: 1.4 }}>
              {viewMode === 'personal' ? '咨询运营项目经理' : '团队管理者'}
            </div>
          </div>
        </div>
        <Segmented
          size="small"
          block
          value={viewMode}
          onChange={handleViewChange}
          options={[
            { label: '👤 个人', value: 'personal' },
            { label: '👥 管理', value: 'management' },
          ]}
        />
      </div>

      {/* Menu items */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {visibleMenuItems.map((item) => (
          <div
            key={item.key}
            className={`sider-menu-item ${state.route === item.key ? 'active' : ''}`}
            onClick={() => setRoute(item.key)}
          >
            <span style={{ fontSize: 16 }}>{item.icon}</span>
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      {/* Bottom slogan */}
      <div style={{ padding: '0 8px 8px' }}>
        <div
          style={{
            padding: 10,
            background: 'var(--mira-bg)',
            borderRadius: 8,
            fontSize: 11,
            color: 'var(--mira-text-muted)',
            lineHeight: 1.6,
          }}
        >
          🪞 Every step matters.{' '}
          随手记录，智写总结 标签分类，洞察工作。
        </div>
      </div>
    </div>
  );
}
