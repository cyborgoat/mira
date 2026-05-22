import dayjs from 'dayjs';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import isoWeek from 'dayjs/plugin/isoWeek';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import type { Task, AppState } from '../types';
import { PROJECTS, TAG_TYPES, KEYWORD_DICT } from '../constants';

dayjs.extend(weekOfYear);
dayjs.extend(isoWeek);
dayjs.extend(customParseFormat);

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function weekKey(date: dayjs.Dayjs): string {
  return date.format('GGGG-[W]WW');
}

const PRIORITIES: Task['priority'][] = ['low', 'normal', 'high', 'urgent'];

function makeTask(overrides: Partial<Task> & { createdAt: number }): Task {
  const date = dayjs(overrides.createdAt);
  const project = pick(PROJECTS);
  const tags = pickN(TAG_TYPES, Math.floor(Math.random() * 3) + 1);
  const kw = pickN(KEYWORD_DICT, 1)[0];
  const title = `${kw}（${project.name.slice(0, 4)}）`;
  const done = Math.random() > 0.4;

  return {
    id: randomId(),
    weekKey: weekKey(date),
    projectId: project.id,
    title,
    detail: `完成${kw}相关工作，确保项目推进符合预期目标。`,
    priority: pick(PRIORITIES),
    dueDate: date.add(3, 'day').format('YYYY-MM-DD'),
    done,
    tags,
    finishedAt: done ? overrides.createdAt + 1000 * 60 * 60 * 2 : null,
    ...overrides,
  };
}

function generateHistoryTasks(weeks: number): Task[] {
  const tasks: Task[] = [];
  for (let w = 1; w <= weeks; w++) {
    const weekStart = dayjs().subtract(w, 'week').startOf('isoWeek');
    const count = Math.floor(Math.random() * 4) + 2;
    for (let i = 0; i < count; i++) {
      const dayOffset = Math.floor(Math.random() * 5);
      const ts = weekStart.add(dayOffset, 'day').add(8 + Math.random() * 8, 'hour').valueOf();
      tasks.push(makeTask({ createdAt: ts }));
    }
  }
  return tasks;
}

function generateCurrentTasks(): Task[] {
  const now = Date.now();
  const week = weekKey(dayjs());
  return PROJECTS.map((project, i) => {
    const kw = KEYWORD_DICT[i * 2 % KEYWORD_DICT.length];
    const done = i >= 3;
    return {
      id: randomId(),
      weekKey: week,
      projectId: project.id,
      title: `${kw}（${project.name.slice(0, 4)}）`,
      detail: `${kw}工作，确保按时交付。`,
      priority: ['normal', 'high', 'urgent', 'normal', 'low'][i] as Task['priority'],
      dueDate: dayjs().add(i + 1, 'day').format('YYYY-MM-DD'),
      done,
      tags: pickN(TAG_TYPES, 2),
      createdAt: now - i * 1000 * 60 * 30,
      finishedAt: done ? now - 1000 * 60 * 10 : null,
    };
  });
}

export function buildSeed(): Pick<AppState, 'tasks' | 'projects' | 'chatHistory' | 'wikiChatHistory'> {
  const history = generateHistoryTasks(8);
  const current = generateCurrentTasks();
  return {
    tasks: [...current, ...history],
    projects: PROJECTS,
    chatHistory: [],
    wikiChatHistory: [],
  };
}
