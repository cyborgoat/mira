import { Tag } from 'antd';
import type { SourceCard as SourceCardType } from '../../types';

interface SourceCardBubbleProps {
  sources: SourceCardType[];
}

export function SourceCardBubble({ sources }: SourceCardBubbleProps) {
  return (
    <div className="chat-source-card">
      <div style={{ marginBottom: 6, fontWeight: 500, color: 'var(--mira-text)' }}>
        📎 来源
      </div>
      {sources.map((s, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <Tag color="blue" style={{ margin: 0, fontSize: 11 }}>
            {s.type}
          </Tag>
          <span style={{ flex: 1, fontSize: 12, color: 'var(--mira-text)' }}>{s.text}</span>
          <Tag
            color={s.status === '已完成' ? 'success' : 'processing'}
            style={{ margin: 0, fontSize: 11 }}
          >
            {s.status}
          </Tag>
        </div>
      ))}
    </div>
  );
}
