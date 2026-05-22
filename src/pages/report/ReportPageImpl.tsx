import { useState, useMemo } from 'react';
import { Row, Col, Segmented, Button, Checkbox, Select, Empty, Tag, message } from 'antd';
import dayjs from 'dayjs';
import { marked } from 'marked';
import { useStore } from '../../store/context';
import type { PeriodType, ReportTab } from '../../types';
import { PROJECTS, TEAM_MEMBERS } from '../../constants';
import { filterTasksByPeriod, generatePersonalReport, generateTeamReport } from '../../lib/report';
import { assignTasksToMembers, computeMemberAbility } from '../../lib/talent';
import { tauriCommands } from '../../hooks/useTauri';

function MdPreview({ markdown }: { markdown: string }) {
  return (
    <div
      className="md-preview"
      dangerouslySetInnerHTML={{ __html: marked.parse(markdown) as string }}
    />
  );
}

function PersonalTab({ period }: { period: PeriodType }) {
  const { state } = useStore();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [projectFilter, setProjectFilter] = useState<string>('');
  const [report, setReport] = useState('');
  const [polishing, setPolishing] = useState(false);

  const periodTasks = useMemo(() => filterTasksByPeriod(state.tasks, period), [state.tasks, period]);
  const filtered = projectFilter ? periodTasks.filter((t) => t.projectId === projectFilter) : periodTasks;

  const done = filtered.filter((t) => t.done);
  const todo = filtered.filter((t) => !t.done);
  const allIds = filtered.map((t) => t.id);

  const toggleAll = (checked: boolean) => setSelectedIds(checked ? allIds : []);
  const toggle = (id: string, checked: boolean) =>
    setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));

  const generate = () => {
    const selected = state.tasks.filter((t) => selectedIds.includes(t.id));
    setReport(generatePersonalReport(selected, period, projectFilter || undefined));
  };

  const polishWithAi = async () => {
    setPolishing(true);
    try {
      const ctx = JSON.stringify(state.tasks.slice(0, 20));
      const result = await tauriCommands.polishReport(report, ctx);
      setReport(result);
    } catch (e: any) {
      message.error(e?.toString() || 'AI 润色失败');
    } finally {
      setPolishing(false);
    }
  };

  const copy = () => {
    navigator.clipboard.writeText(report);
    message.success('已复制');
  };

  const periodLabel = { daily: '日', weekly: '周', monthly: '月' }[period];

  return (
    <Row gutter={20}>
      <Col span={13}>
        <div className="mira-card" style={{ height: 'calc(100vh - 280px)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
            <Select
              size="small"
              placeholder="按项目筛选"
              style={{ width: 200 }}
              allowClear
              value={projectFilter || undefined}
              onChange={(v) => setProjectFilter(v || '')}
            >
              {PROJECTS.map((p) => (
                <Select.Option key={p.id} value={p.id}>{p.icon} {p.name}</Select.Option>
              ))}
            </Select>
            <Button size="small" onClick={() => toggleAll(true)}>全选</Button>
            <Button size="small" onClick={() => toggleAll(false)}>清空</Button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {done.length > 0 && (
              <>
                <div style={{ color: 'var(--mira-success)', fontWeight: 500, marginBottom: 8 }}>✅ 已完成</div>
                {done.map((t) => (
                  <div key={t.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
                    <Checkbox
                      checked={selectedIds.includes(t.id)}
                      onChange={(e) => toggle(t.id, e.target.checked)}
                    />
                    <div>
                      <div style={{ fontSize: 13 }}>{t.title}</div>
                      {t.detail && <div style={{ fontSize: 12, color: 'var(--mira-text-muted)' }}>{t.detail}</div>}
                      <Tag color="purple" style={{ fontSize: 11 }}>
                        {PROJECTS.find((p) => p.id === t.projectId)?.name.slice(0, 6)}
                      </Tag>
                    </div>
                  </div>
                ))}
              </>
            )}
            {todo.length > 0 && (
              <>
                <div style={{ color: 'var(--mira-warning)', fontWeight: 500, margin: '12px 0 8px' }}>⏳ 待完成</div>
                {todo.map((t) => (
                  <div key={t.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
                    <Checkbox
                      checked={selectedIds.includes(t.id)}
                      onChange={(e) => toggle(t.id, e.target.checked)}
                    />
                    <div>
                      <div style={{ fontSize: 13 }}>{t.title}</div>
                      {t.detail && <div style={{ fontSize: 12, color: 'var(--mira-text-muted)' }}>{t.detail}</div>}
                      <Tag color="purple" style={{ fontSize: 11 }}>
                        {PROJECTS.find((p) => p.id === t.projectId)?.name.slice(0, 6)}
                      </Tag>
                    </div>
                  </div>
                ))}
              </>
            )}
            {filtered.length === 0 && <Empty description="该时段暂无工作项" />}
          </div>
        </div>
      </Col>
      <Col span={11}>
        <div className="mira-card" style={{ height: 'calc(100vh - 280px)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <Button
              type="primary"
              disabled={selectedIds.length === 0}
              onClick={generate}
            >
              生成{periodLabel}报
            </Button>
            {report && (
              <>
                <Button onClick={copy}>复制</Button>
                <Button
                  onClick={polishWithAi}
                  loading={polishing}
                  style={{ background: 'var(--mira-gold)', borderColor: 'var(--mira-gold)', color: 'var(--mira-primary)' }}
                >
                  ✨ AI 润色
                </Button>
              </>
            )}
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {report ? (
              <MdPreview markdown={report} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--mira-text-muted)' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📝</div>
                <div>勾选左侧工作项后点击生成{periodLabel}报</div>
              </div>
            )}
          </div>
        </div>
      </Col>
    </Row>
  );
}

function TeamTab({ period }: { period: PeriodType }) {
  const { state } = useStore();
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [report, setReport] = useState('');
  const [polishing, setPolishing] = useState(false);

  const periodTasks = useMemo(() => filterTasksByPeriod(state.tasks, period), [state.tasks, period]);
  const assigned = useMemo(() => assignTasksToMembers(periodTasks), [periodTasks]);

  const toggleMember = (id: string, checked: boolean) =>
    setSelectedMembers((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));

  const generate = () => {
    setReport(generateTeamReport(periodTasks, period, selectedMembers));
  };

  const polishWithAi = async () => {
    setPolishing(true);
    try {
      const ctx = JSON.stringify(periodTasks.slice(0, 20));
      const result = await tauriCommands.polishReport(report, ctx);
      setReport(result);
    } catch (e: any) {
      message.error(e?.toString() || 'AI 润色失败');
    } finally {
      setPolishing(false);
    }
  };

  const copy = () => {
    navigator.clipboard.writeText(report);
    message.success('已复制');
  };

  const periodLabel = { daily: '日', weekly: '周', monthly: '月' }[period];

  return (
    <Row gutter={20}>
      <Col span={13}>
        <div className="mira-card" style={{ height: 'calc(100vh - 280px)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <Button size="small" onClick={() => setSelectedMembers(TEAM_MEMBERS.map((m) => m.id))}>全选</Button>
            <Button size="small" onClick={() => setSelectedMembers([])}>清空</Button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {TEAM_MEMBERS.map((member) => {
              const ability = computeMemberAbility(member.id, periodTasks);
              const memberTaskCount = assigned.filter((t) => t.assignee === member.id && t.done).length;
              return (
                <div key={member.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 12 }}>
                  <Checkbox
                    checked={selectedMembers.includes(member.id)}
                    onChange={(e) => toggleMember(member.id, e.target.checked)}
                  />
                  <div
                    style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: member.color, display: 'flex',
                      alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0,
                    }}
                  >
                    {member.avatar}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500 }}>{member.name} <span style={{ fontSize: 12, color: 'var(--mira-text-muted)' }}>{member.role}</span></div>
                    <div style={{ fontSize: 12, color: 'var(--mira-text-muted)' }}>已完成 {memberTaskCount} 项</div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                      {ability.tags.slice(0, 3).map((t) => (
                        <Tag key={t.label} color={t.type === 'type' ? 'gold' : t.type === 'project' ? 'purple' : 'blue'} style={{ fontSize: 11 }}>
                          {t.label}
                        </Tag>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Col>
      <Col span={11}>
        <div className="mira-card" style={{ height: 'calc(100vh - 280px)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <Button
              type="primary"
              disabled={selectedMembers.length === 0}
              onClick={generate}
            >
              生成团队{periodLabel}报
            </Button>
            {report && (
              <>
                <Button onClick={copy}>复制</Button>
                <Button
                  onClick={polishWithAi}
                  loading={polishing}
                  style={{ background: 'var(--mira-gold)', borderColor: 'var(--mira-gold)', color: 'var(--mira-primary)' }}
                >
                  ✨ AI 润色
                </Button>
              </>
            )}
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {report ? (
              <MdPreview markdown={report} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--mira-text-muted)' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>👥</div>
                <div>勾选左侧团队成员后点击生成团队{periodLabel}报</div>
              </div>
            )}
          </div>
        </div>
      </Col>
    </Row>
  );
}

export function ReportPage() {
  const [tab, setTab] = useState<ReportTab>('personal');
  const [period, setPeriod] = useState<PeriodType>('weekly');

  return (
    <div>
      <div className="page-header-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3>📝 写总结</h3>
            <p className="subtitle">{dayjs().format('YYYY年M月D日')}</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Segmented
              size="small"
              value={tab}
              onChange={(v) => setTab(v as ReportTab)}
              options={[
                { label: '个人总结', value: 'personal' },
                { label: '团队总结', value: 'team' },
              ]}
            />
            <Segmented
              size="small"
              value={period}
              onChange={(v) => setPeriod(v as PeriodType)}
              options={[
                { label: 'Daily', value: 'daily' },
                { label: 'Weekly', value: 'weekly' },
                { label: 'Monthly', value: 'monthly' },
              ]}
            />
          </div>
        </div>
        <div className="watermark">📝</div>
      </div>

      {tab === 'personal' ? <PersonalTab period={period} /> : <TeamTab period={period} />}
    </div>
  );
}
