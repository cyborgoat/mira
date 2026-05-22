import { useState, useRef, useEffect, useMemo } from 'react';
import { Row, Col, Button, Input, Tag, Badge, Progress, Select, Empty } from 'antd';
import { useStore, useActions } from '../../store/context';
import { ChatBubble, ChatLoadingBubble } from '../../components/common/ChatBubble';
import { tauriCommands, chatMsgToApiFormat } from '../../hooks/useTauri';
import { PROJECTS } from '../../constants';
import type { ChatMsg, Task } from '../../types';

const { TextArea } = Input;

function ProjectCard({ projectId, tasks, selected, onClick }: {
  projectId: string;
  tasks: Task[];
  selected: boolean;
  onClick: () => void;
}) {
  const project = PROJECTS.find((p) => p.id === projectId)!;
  const total = tasks.length;
  const done = tasks.filter((t) => t.done).length;
  const todo = total - done;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const badgeColor = pct >= 80 ? '#52C41A' : pct >= 50 ? '#FAAD14' : '#FF4D4F';
  const allTags = [...new Set(tasks.flatMap((t) => t.tags))].slice(0, 4);

  return (
    <div className={`project-card ${selected ? 'selected' : ''}`} onClick={onClick}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 24 }}>{project.icon}</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--mira-text)' }}>{project.name}</div>
            <div style={{ fontSize: 11, color: 'var(--mira-text-muted)' }}>共 {total} 项 · 完成 {done} 项</div>
          </div>
        </div>
        <Badge count={todo} style={{ backgroundColor: badgeColor }} />
      </div>
      <Progress percent={pct} size="small" strokeColor={badgeColor} showInfo={false} />
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
        {allTags.map((tag) => (
          <Tag key={tag} color="gold" style={{ fontSize: 11, margin: 0 }}>{tag}</Tag>
        ))}
      </div>
    </div>
  );
}

function ProjectDetail({ projectId, onBack }: { projectId: string; onBack: () => void }) {
  const { state } = useStore();
  const project = PROJECTS.find((p) => p.id === projectId)!;
  const [filterType, setFilterType] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const projectTasks = state.tasks.filter((t) => t.projectId === projectId);
  const filtered = projectTasks.filter((t) => {
    if (filterType && !t.tags.includes(filterType)) return false;
    if (filterPriority && t.priority !== filterPriority) return false;
    if (filterStatus === 'done' && !t.done) return false;
    if (filterStatus === 'todo' && t.done) return false;
    return true;
  });

  const done = filtered.filter((t) => t.done);
  const todo = filtered.filter((t) => !t.done);
  const allTags = [...new Set(projectTasks.flatMap((t) => t.tags))];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontWeight: 600, fontSize: 16 }}>{project.icon} {project.name}</div>
        <Button size="small" onClick={onBack}>← 返回</Button>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <Select size="small" placeholder="能力类型" allowClear style={{ width: 140 }} onChange={setFilterType}>
          {allTags.map((t) => <Select.Option key={t} value={t}>{t}</Select.Option>)}
        </Select>
        <Select size="small" placeholder="优先级" allowClear style={{ width: 100 }} onChange={setFilterPriority}>
          {['low', 'normal', 'high', 'urgent'].map((v) => <Select.Option key={v} value={v}>{v}</Select.Option>)}
        </Select>
        <Select size="small" placeholder="状态" allowClear style={{ width: 100 }} onChange={setFilterStatus}>
          <Select.Option value="done">已完成</Select.Option>
          <Select.Option value="todo">进行中</Select.Option>
        </Select>
      </div>
      <Row gutter={16}>
        <Col span={12}>
          <div style={{ fontWeight: 500, color: 'var(--mira-success)', marginBottom: 8 }}>✅ 已完成（{done.length}）</div>
          {done.length === 0 ? <Empty description="暂无" image={Empty.PRESENTED_IMAGE_SIMPLE} /> : done.map((t) => (
            <div key={t.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--mira-mist)' }}>
              <div style={{ textDecoration: 'line-through', color: 'var(--mira-text-muted)', fontSize: 13 }}>{t.title}</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                {t.tags.map((tag) => <Tag key={tag} color="gold" style={{ fontSize: 11, margin: 0 }}>{tag}</Tag>)}
              </div>
            </div>
          ))}
        </Col>
        <Col span={12}>
          <div style={{ fontWeight: 500, color: 'var(--mira-warning)', marginBottom: 8 }}>⏳ 待完成（{todo.length}）</div>
          {todo.length === 0 ? <Empty description="暂无" image={Empty.PRESENTED_IMAGE_SIMPLE} /> : todo.map((t) => (
            <div key={t.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--mira-mist)' }}>
              <div style={{ fontSize: 13 }}>{t.title}</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                {t.tags.map((tag) => <Tag key={tag} color="gold" style={{ fontSize: 11, margin: 0 }}>{tag}</Tag>)}
                <span style={{ fontSize: 11, color: 'var(--mira-text-muted)' }}>截止 {t.dueDate}</span>
              </div>
            </div>
          ))}
        </Col>
      </Row>
    </div>
  );
}

function WikiChat() {
  const { state } = useStore();
  const { addWikiChatMessage } = useActions();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.wikiChatHistory, loading]);

  const handleSend = async () => {
    const q = input.trim();
    if (!q || loading) return;

    const userMsg: ChatMsg = { role: 'user', content: q, time: Date.now() };
    addWikiChatMessage(userMsg);
    setInput('');
    setLoading(true);

    try {
      const messages = [...state.wikiChatHistory, userMsg].map(chatMsgToApiFormat);
      const projectContext = {
        projectName: '',
        tasks: state.tasks.slice(0, 30),
      };
      const reply = await tauriCommands.askWiki(messages, projectContext);
      addWikiChatMessage({ role: 'assistant', content: reply, time: Date.now() });
    } catch (e: any) {
      addWikiChatMessage({
        role: 'assistant',
        content: e?.toString() || '出现错误，请检查 API Key 配置。',
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 12 }}>
        {state.wikiChatHistory.length === 0 && !loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--mira-text-muted)' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📚</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>对话式工作洞察</div>
            <div style={{ fontSize: 13 }}>点击左侧项目卡片查看详情，或在此对话提问</div>
          </div>
        ) : (
          <>
            {state.wikiChatHistory.map((msg, i) => (
              <ChatBubble key={i} msg={msg} avatarEmoji="📚" />
            ))}
            {loading && <ChatLoadingBubble avatarEmoji="📚" text="分析中..." />}
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
  );
}

export function WikiPage() {
  const { state } = useStore();
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  const tasksByProject = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const t of state.tasks) {
      if (!map[t.projectId]) map[t.projectId] = [];
      map[t.projectId].push(t);
    }
    return map;
  }, [state.tasks]);

  return (
    <div>
      <div className="page-header-card">
        <h3>📚 工作库</h3>
        <p className="subtitle">按项目分类，标签筛选，对话式洞察</p>
      </div>

      <Row gutter={20} style={{ height: 'calc(100vh - 200px)' }}>
        {/* Left: project cards */}
        <Col span={8}>
          <div style={{ maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}>
            {PROJECTS.map((proj) => (
              <ProjectCard
                key={proj.id}
                projectId={proj.id}
                tasks={tasksByProject[proj.id] || []}
                selected={selectedProject === proj.id}
                onClick={() => setSelectedProject(selectedProject === proj.id ? null : proj.id)}
              />
            ))}
          </div>
        </Col>

        {/* Right: detail or chat */}
        <Col span={16}>
          <div className="mira-card" style={{ height: 'calc(100vh - 220px)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {selectedProject ? (
              <div style={{ flex: 1, overflowY: 'auto' }}>
                <ProjectDetail
                  projectId={selectedProject}
                  onBack={() => setSelectedProject(null)}
                />
              </div>
            ) : (
              <WikiChat />
            )}
          </div>
        </Col>
      </Row>
    </div>
  );
}
