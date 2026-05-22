import { Avatar } from 'antd';
import dayjs from 'dayjs';
import type { ChatMsg } from '../../types';
import { SourceCardBubble } from './SourceCard';

interface ChatBubbleProps {
  msg: ChatMsg;
  avatarEmoji: string;
  avatarColor?: string;
}

export function ChatBubble({ msg, avatarEmoji, avatarColor = '#E8B86D' }: ChatBubbleProps) {
  const isUser = msg.role === 'user';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isUser ? 'row-reverse' : 'row',
        gap: 8,
        marginBottom: 16,
        alignItems: 'flex-start',
      }}
    >
      <Avatar
        size={32}
        style={{
          background: isUser ? 'var(--mira-primary)' : avatarColor,
          fontSize: 16,
          flexShrink: 0,
        }}
      >
        {avatarEmoji}
      </Avatar>
      <div style={{ maxWidth: '75%' }}>
        <div className={`chat-bubble ${isUser ? 'user' : 'assistant'}`}>
          {msg.content}
        </div>
        {!isUser && msg.sources && msg.sources.length > 0 && (
          <SourceCardBubble sources={msg.sources} />
        )}
        <div className="chat-time" style={{ textAlign: isUser ? 'right' : 'left' }}>
          {dayjs(msg.time).format('HH:mm')}
        </div>
      </div>
    </div>
  );
}

export function ChatLoadingBubble({ avatarEmoji, text = '思考中...', avatarColor = '#E8B86D' }: {
  avatarEmoji: string;
  text?: string;
  avatarColor?: string;
}) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'flex-start' }}>
      <Avatar size={32} style={{ background: avatarColor, fontSize: 16, flexShrink: 0 }}>
        {avatarEmoji}
      </Avatar>
      <div className="chat-bubble assistant chat-loading">{text}</div>
    </div>
  );
}
