import React, { useState, useRef, useEffect } from 'react';
import { Button, Input, message } from 'antd';
import { useStore, useActions } from '../../store/context';
import { ChatBubble, ChatLoadingBubble } from '../../components/common/ChatBubble';
import { tauriCommands, chatMsgToApiFormat } from '../../hooks/useTauri';
import type { ChatMsg } from '../../types';

const { TextArea } = Input;

export function AskMiraPage() {
  const { state } = useStore();
  const { addChatMessage, clearChat } = useActions();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.chatHistory, loading]);

  const handleClear = () => {
    clearChat();
    message.success('已清空');
  };

  const handleSend = async () => {
    const q = input.trim();
    if (!q || loading) return;

    const userMsg: ChatMsg = { role: 'user', content: q, time: Date.now() };
    addChatMessage(userMsg);
    setInput('');
    setLoading(true);

    try {
      const messages = [...state.chatHistory, userMsg].map(chatMsgToApiFormat);
      const tasksContext = JSON.stringify(
        state.tasks.slice(0, 30).map((t) => ({
          id: t.id,
          title: t.title,
          detail: t.detail,
          done: t.done,
          projectId: t.projectId,
          tags: t.tags,
        }))
      );
      const reply = await tauriCommands.askMira(messages, tasksContext);
      const assistantMsg: ChatMsg = {
        role: 'assistant',
        content: reply,
        time: Date.now(),
        sources: state.tasks
          .filter((t) => t.title.includes(q) || t.detail?.includes(q))
          .slice(0, 3)
          .map((t) => ({
            type: '任务',
            text: t.title,
            status: t.done ? '已完成' : '进行中',
          })),
      };
      addChatMessage(assistantMsg);
    } catch (e: any) {
      addChatMessage({
        role: 'assistant',
        content: e?.toString() || '抱歉，出现了错误，请检查 API Key 配置。',
        time: Date.now(),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div>
      {/* Top card (white) */}
      <div className="mira-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--mira-text)' }}>🪞 Ask Mira</div>
          <div style={{ fontSize: 13, color: 'var(--mira-text-muted)' }}>把你的全部任务数据作为上下文，智能问答助手</div>
        </div>
        <Button size="small" onClick={handleClear} disabled={state.chatHistory.length === 0}>
          清空历史
        </Button>
      </div>

      {/* Chat area */}
      <div className="mira-card" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 220px)' }}>
        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 12 }}>
          {state.chatHistory.length === 0 && !loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--mira-text-muted)' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🪞</div>
              <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Ask Mira anything</div>
              <div style={{ fontSize: 13 }}>试试："上周做了哪些高优先级任务？" 或 "数字化转型项目进展如何？"</div>
            </div>
          ) : (
            <>
              {state.chatHistory.map((msg, i) => (
                <ChatBubble key={i} msg={msg} avatarEmoji="🪞" />
              ))}
              {loading && <ChatLoadingBubble avatarEmoji="🪞" text="思考中..." />}
            </>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="chat-input-area">
          <TextArea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入问题（Enter 发送，Shift+Enter 换行）"
            autoSize={{ minRows: 1, maxRows: 4 }}
            disabled={loading}
            style={{ flex: 1 }}
          />
          <Button
            type="primary"
            loading={loading}
            onClick={handleSend}
            disabled={!input.trim()}
            style={{ height: 40 }}
          >
            提问
          </Button>
        </div>
      </div>
    </div>
  );
}
