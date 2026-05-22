import type { Task, MemberAbility } from '../types';
import { TEAM_MEMBERS, KEYWORD_DICT } from '../constants';

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return h;
}

export function assignTasksToMembers(tasks: Task[]): Array<Task & { assignee: string }> {
  const mIds = TEAM_MEMBERS.map((m) => m.id);
  return tasks.map((t) => ({
    ...t,
    assignee: mIds[Math.abs(hashCode(t.id)) % mIds.length],
  }));
}

export function getMemberTasks(
  memberId: string,
  assignedTasks: Array<Task & { assignee: string }>
): Task[] {
  return assignedTasks.filter((t) => t.assignee === memberId);
}

export function computeMemberAbility(memberId: string, allTasks: Task[]): MemberAbility {
  const assigned = assignTasksToMembers(allTasks);
  const memberTasks = assigned.filter((t) => t.assignee === memberId);

  const typeCount: Record<string, number> = {};
  const projCount: Record<string, number> = {};
  const kwCount: Record<string, number> = {};

  for (const task of memberTasks) {
    for (const tag of task.tags) {
      typeCount[tag] = (typeCount[tag] || 0) + 1;
    }
    projCount[task.projectId] = (projCount[task.projectId] || 0) + 1;
    for (const kw of KEYWORD_DICT) {
      if (task.title.includes(kw) || task.detail?.includes(kw)) {
        kwCount[kw] = (kwCount[kw] || 0) + 1;
      }
    }
  }

  const topTypes = Object.entries(typeCount)
    .filter(([, c]) => c >= 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, count]) => ({ label, count }));

  const topProj = Object.entries(projCount)
    .filter(([, c]) => c >= 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([label, count]) => ({ label, count }));

  const topKw = Object.entries(kwCount)
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, count]) => ({ label, count }));

  const tags = [
    ...topTypes.map(({ label, count }) => ({ label, type: 'type' as const, weight: count })),
    ...topProj.map(({ label, count }) => ({ label, type: 'project' as const, weight: count })),
    ...topKw.map(({ label, count }) => ({ label, type: 'keyword' as const, weight: count })),
  ];

  return {
    memberId,
    tags,
    totalTasks: memberTasks.length,
    doneTasks: memberTasks.filter((t) => t.done).length,
    topTypes,
    topProj,
    topKw,
  };
}
