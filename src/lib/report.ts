import dayjs from 'dayjs';
import type { Task, PeriodType } from '../types';
import { PROJECTS, TEAM_MEMBERS } from '../constants';
import { assignTasksToMembers } from './talent';

function getPeriodLabel(period: PeriodType): string {
  return { daily: '日报', weekly: '周报', monthly: '月报' }[period];
}

function getPeriodCutoff(period: PeriodType): number {
  const days = { daily: 1, weekly: 7, monthly: 30 }[period];
  return dayjs().subtract(days, 'day').valueOf();
}

export function filterTasksByPeriod(tasks: Task[], period: PeriodType): Task[] {
  const cutoff = getPeriodCutoff(period);
  return tasks.filter((t) => t.createdAt > cutoff);
}

export function generatePersonalReport(tasks: Task[], period: PeriodType, projectId?: string): string {
  const filtered = projectId ? tasks.filter((t) => t.projectId === projectId) : tasks;
  const project = projectId ? PROJECTS.find((p) => p.id === projectId) : null;
  const done = filtered.filter((t) => t.done);
  const todo = filtered.filter((t) => !t.done);
  const periodLabel = getPeriodLabel(period);
  const dateStr = `${dayjs().year()}年${dayjs().month() + 1}月${dayjs().date()}日`;

  let md = `# ${project ? project.name + '-' : ''}${periodLabel} — ${dateStr}\n\n`;

  md += `## 已完成工作\n`;
  if (done.length === 0) {
    md += '_暂无已完成任务_\n';
  } else {
    done.forEach((t, i) => {
      md += `${i + 1}. **${t.title}**${t.detail ? '：' + t.detail : ''}\n`;
    });
  }

  md += `\n## 待完成工作\n`;
  if (todo.length === 0) {
    md += '_暂无待完成任务_\n';
  } else {
    todo.forEach((t, i) => {
      md += `${i + 1}. ${t.title}${t.detail ? '（' + t.detail + '）' : ''}\n`;
    });
  }

  return md;
}

export function generateTeamReport(tasks: Task[], period: PeriodType, selectedMemberIds: string[]): string {
  const assigned = assignTasksToMembers(tasks);
  const memberTasks = assigned.filter((t) => selectedMemberIds.includes(t.assignee));

  const selectedMembers = TEAM_MEMBERS.filter((m) => selectedMemberIds.includes(m.id));
  const periodLabel = getPeriodLabel(period);
  const dateStr = `${dayjs().year()}年${dayjs().month() + 1}月${dayjs().date()}日`;

  let md = `# 团队${periodLabel} — ${dateStr}\n\n`;
  md += `> 圈选成员：${selectedMembers.map((m) => m.name).join('、')}\n\n`;

  // Group by project
  const projectGroups = PROJECTS.map((proj) => {
    const projTasks = memberTasks.filter((t) => t.projectId === proj.id);
    if (projTasks.length === 0) return null;

    const participants = [...new Set(projTasks.map((t) => t.assignee))]
      .map((id) => TEAM_MEMBERS.find((m) => m.id === id))
      .filter(Boolean);

    const done = projTasks.filter((t) => t.done);
    const todo = projTasks.filter((t) => !t.done);

    return { proj, projTasks, participants, done, todo };
  }).filter(Boolean);

  for (const group of projectGroups) {
    if (!group) continue;
    md += `## ${group.proj.icon} ${group.proj.name}\n\n`;
    md += `**参与人员：** ${group.participants.map((m) => m ? `${m.avatar} ${m.name}` : '').join('、')}\n\n`;

    if (group.done.length > 0) {
      md += `### 已完成（${group.done.length}项）\n`;
      for (const t of group.done) {
        const member = TEAM_MEMBERS.find((m) => m.id === t.assignee);
        md += `- ${member?.name || ''}：**${t.title}**${t.detail ? '—' + t.detail : ''}\n`;
      }
      md += '\n';
    }

    if (group.todo.length > 0) {
      md += `### 进行中（${group.todo.length}项）\n`;
      for (const t of group.todo) {
        const member = TEAM_MEMBERS.find((m) => m.id === t.assignee);
        md += `- ${member?.name || ''}：${t.title}${t.detail ? '（' + t.detail + '）' : ''}\n`;
      }
      md += '\n';
    }

    md += '---\n\n';
  }

  // Team summary
  const total = memberTasks.length;
  const doneCount = memberTasks.filter((t) => t.done).length;
  const projDist = PROJECTS.map((p) => {
    const pt = memberTasks.filter((t) => t.projectId === p.id);
    return pt.length > 0 ? `- ${p.name}：${pt.length}项（已完成${pt.filter((t) => t.done).length}项）` : null;
  }).filter(Boolean);

  const typeDist: Record<string, number> = {};
  for (const t of memberTasks) {
    for (const tag of t.tags) {
      typeDist[tag] = (typeDist[tag] || 0) + 1;
    }
  }
  const typeLines = Object.entries(typeDist)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k, v]) => `- ${k}：${v}项`);

  md += `## 团队汇总\n\n`;
  md += `- 总任务数：${total}\n`;
  md += `- 已完成：${doneCount}（${total > 0 ? Math.round((doneCount / total) * 100) : 0}%）\n`;
  md += `- 进行中：${total - doneCount}\n\n`;
  if (projDist.length > 0) {
    md += `**项目分布：**\n${projDist.join('\n')}\n\n`;
  }
  if (typeLines.length > 0) {
    md += `**能力分布：**\n${typeLines.join('\n')}\n`;
  }

  return md;
}
