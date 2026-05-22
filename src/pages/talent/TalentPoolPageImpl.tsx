import { useState, useMemo } from 'react';
import { Row, Col, Select, Button, Modal, Tag, Progress, List, Empty } from 'antd';
import { useStore } from '../../store/context';
import { TEAM_MEMBERS, PROJECTS } from '../../constants';
import { computeMemberAbility, assignTasksToMembers } from '../../lib/talent';
import type { TeamMember } from '../../types';

function MemberCard({ member, onClick }: { member: TeamMember; onClick: () => void }) {
  const { state } = useStore();
  const ability = useMemo(() => computeMemberAbility(member.id, state.tasks), [member.id, state.tasks]);
  const pct = ability.totalTasks > 0 ? Math.round((ability.doneTasks / ability.totalTasks) * 100) : 0;

  return (
    <div className="member-card" onClick={onClick}>
      <div
        style={{
          width: 48, height: 48, borderRadius: '50%',
          background: member.color, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          fontSize: 24, margin: '0 auto 12px',
        }}
      >
        {member.avatar}
      </div>
      <div style={{ fontWeight: 600, marginBottom: 2 }}>{member.name}</div>
      <div style={{ fontSize: 12, color: 'var(--mira-text-muted)', marginBottom: 12 }}>{member.role}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--mira-success)', marginBottom: 4 }}>
        {ability.doneTasks}
      </div>
      <div style={{ fontSize: 12, color: 'var(--mira-text-muted)', marginBottom: 12 }}>已完成任务</div>
      <Progress percent={pct} size="small" strokeColor={pct >= 80 ? '#52C41A' : pct >= 50 ? '#FAAD14' : '#FF4D4F'} />
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center', marginTop: 8 }}>
        {ability.tags.slice(0, 4).map((t, i) => (
          <Tag
            key={i}
            color={t.type === 'type' ? 'gold' : t.type === 'project' ? 'purple' : 'blue'}
            style={{ fontSize: 11, margin: 0 }}
          >
            {t.label}
          </Tag>
        ))}
        {ability.tags.length > 4 && (
          <Tag style={{ fontSize: 11, margin: 0, color: 'var(--mira-text-muted)' }}>
            +{ability.tags.length - 4}
          </Tag>
        )}
      </div>
    </div>
  );
}

function MemberDetailModal({ member, open, onClose }: { member: TeamMember | null; open: boolean; onClose: () => void }) {
  const { state } = useStore();
  if (!member) return null;

  const ability = computeMemberAbility(member.id, state.tasks);
  const assigned = assignTasksToMembers(state.tasks);
  const memberTasks = assigned.filter((t) => t.assignee === member.id);
  const recentTasks = [...memberTasks].sort((a, b) => b.createdAt - a.createdAt).slice(0, 8);

  const projDist = PROJECTS.map((p) => {
    const count = memberTasks.filter((t) => t.projectId === p.id).length;
    return { proj: p, count };
  }).filter((x) => x.count > 0).sort((a, b) => b.count - a.count);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={680}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: member.color, display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontSize: 20,
          }}>
            {member.avatar}
          </div>
          <div>
            <div style={{ fontWeight: 600 }}>{member.name}</div>
            <div style={{ fontSize: 12, color: 'var(--mira-text-muted)', fontWeight: 400 }}>{member.role}</div>
          </div>
        </div>
      }
    >
      {/* Stats */}
      <Row gutter={12} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <div style={{ background: '#EEF2FF', borderRadius: 8, padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--mira-primary)' }}>{ability.totalTasks}</div>
            <div style={{ fontSize: 12, color: 'var(--mira-text-muted)' }}>总任务</div>
          </div>
        </Col>
        <Col span={8}>
          <div style={{ background: '#F6FFED', borderRadius: 8, padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--mira-success)' }}>{ability.doneTasks}</div>
            <div style={{ fontSize: 12, color: 'var(--mira-text-muted)' }}>已完成</div>
          </div>
        </Col>
        <Col span={8}>
          <div style={{ background: '#FFFBE6', borderRadius: 8, padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--mira-gold)' }}>{ability.tags.length}</div>
            <div style={{ fontSize: 12, color: 'var(--mira-text-muted)' }}>能力标签</div>
          </div>
        </Col>
      </Row>

      {/* Ability tags */}
      {ability.tags.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>能力标签</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {ability.tags.map((t, i) => (
              <Tag
                key={i}
                color={t.type === 'type' ? 'gold' : t.type === 'project' ? 'purple' : 'blue'}
              >
                {t.label} ×{t.weight}
              </Tag>
            ))}
          </div>
        </div>
      )}

      {/* Project distribution */}
      {projDist.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>项目分布</div>
          {projDist.map(({ proj, count }) => (
            <div key={proj.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 12, minWidth: 160, color: 'var(--mira-text)' }}>{proj.icon} {proj.name}</span>
              <Progress
                percent={Math.round((count / ability.totalTasks) * 100)}
                size="small"
                showInfo={false}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: 12, color: 'var(--mira-text-muted)', minWidth: 40 }}>{count}项</span>
            </div>
          ))}
        </div>
      )}

      {/* Recent tasks */}
      <div>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>近期任务</div>
        <List
          dataSource={recentTasks}
          renderItem={(task) => (
            <List.Item style={{ padding: '6px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                <span>{task.done ? '✅' : '⏳'}</span>
                <span style={{ flex: 1, fontSize: 13, textDecoration: task.done ? 'line-through' : 'none', color: task.done ? 'var(--mira-text-muted)' : 'var(--mira-text)' }}>
                  {task.title}
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {task.tags.slice(0, 2).map((t) => (
                    <Tag key={t} color="gold" style={{ fontSize: 11, margin: 0 }}>{t}</Tag>
                  ))}
                </div>
              </div>
            </List.Item>
          )}
        />
      </div>
    </Modal>
  );
}

export function TalentPoolPage() {
  const { state } = useStore();
  const [filterProject, setFilterProject] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterKw, setFilterKw] = useState('');
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);

  const filteredMembers = useMemo(() => {
    return TEAM_MEMBERS.filter((member) => {
      const ability = computeMemberAbility(member.id, state.tasks);
      if (filterProject) {
        const assigned = assignTasksToMembers(state.tasks);
        const hasProjTask = assigned.some((t) => t.assignee === member.id && t.projectId === filterProject);
        if (!hasProjTask) return false;
      }
      if (filterType) {
        const hasType = ability.tags.some((t) => t.type === 'type' && t.label === filterType);
        if (!hasType) return false;
      }
      if (filterKw) {
        const hasKw = ability.tags.some((t) => t.label.includes(filterKw));
        if (!hasKw) return false;
      }
      return true;
    });
  }, [state.tasks, filterProject, filterType, filterKw]);

  const allTypes = [...new Set(
    TEAM_MEMBERS.flatMap((m) => computeMemberAbility(m.id, state.tasks).topTypes.map((t) => t.label))
  )];

  return (
    <div>
      <div className="page-header-card">
        <h3>👥 人才库</h3>
        <p className="subtitle">基于任务数据自动生成能力标签，多维度圈选团队成员</p>
      </div>

      {/* Filters */}
      <div className="mira-card" style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <Select
          size="small"
          placeholder="按项目"
          allowClear
          style={{ width: 200 }}
          value={filterProject || undefined}
          onChange={(v) => setFilterProject(v || '')}
        >
          {PROJECTS.map((p) => <Select.Option key={p.id} value={p.id}>{p.icon} {p.name}</Select.Option>)}
        </Select>
        <Select
          size="small"
          placeholder="按能力类型"
          allowClear
          style={{ width: 150 }}
          value={filterType || undefined}
          onChange={(v) => setFilterType(v || '')}
        >
          {allTypes.map((t) => <Select.Option key={t} value={t}>{t}</Select.Option>)}
        </Select>
        <Select
          size="small"
          placeholder="按关键词"
          allowClear
          style={{ width: 150 }}
          value={filterKw || undefined}
          onChange={(v) => setFilterKw(v || '')}
          showSearch
        >
          {['需求调研', '方案设计', '客户汇报', '数据分析', '合规审查', '培训赋能'].map((kw) => (
            <Select.Option key={kw} value={kw}>{kw}</Select.Option>
          ))}
        </Select>
        <Button size="small" onClick={() => { setFilterProject(''); setFilterType(''); setFilterKw(''); }}>
          重置筛选
        </Button>
      </div>

      {/* Member grid */}
      {filteredMembers.length === 0 ? (
        <Empty description="没有匹配的团队成员" />
      ) : (
        <Row gutter={[16, 16]}>
          {filteredMembers.map((member) => (
            <Col key={member.id} span={8}>
              <MemberCard member={member} onClick={() => setSelectedMember(member)} />
            </Col>
          ))}
        </Row>
      )}

      <MemberDetailModal
        member={selectedMember}
        open={!!selectedMember}
        onClose={() => setSelectedMember(null)}
      />
    </div>
  );
}
