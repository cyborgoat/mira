import dayjs from 'dayjs';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import isoWeek from 'dayjs/plugin/isoWeek';
import type { AppState, Task, ChatMsg } from '../types';
import { PROJECTS } from '../constants';

dayjs.extend(weekOfYear);
dayjs.extend(isoWeek);

export type Action =
  | { type: 'SET_ROUTE'; route: string }
  | { type: 'ADD_TASK'; task: Partial<Task> }
  | { type: 'UPDATE_TASK'; id: string; patch: Partial<Task> }
  | { type: 'REMOVE_TASK'; id: string }
  | { type: 'ADD_CHAT_MESSAGE'; msg: ChatMsg }
  | { type: 'CLEAR_CHAT' }
  | { type: 'ADD_WIKI_CHAT_MESSAGE'; msg: ChatMsg }
  | { type: 'CLEAR_WIKI_CHAT' }
  | { type: 'RESET_ALL' }
  | { type: 'HYDRATE'; state: Partial<AppState> };

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_ROUTE':
      return { ...state, route: action.route };

    case 'ADD_TASK': {
      const now = Date.now();
      const newTask: Task = {
        id: randomId(),
        weekKey: dayjs().format('GGGG-[W]WW'),
        projectId: PROJECTS[0].id,
        title: '',
        priority: 'normal',
        dueDate: dayjs().add(1, 'day').format('YYYY-MM-DD'),
        done: false,
        tags: [],
        createdAt: now,
        finishedAt: null,
        ...action.task,
      };
      return { ...state, tasks: [newTask, ...state.tasks] };
    }

    case 'UPDATE_TASK': {
      const now = Date.now();
      return {
        ...state,
        tasks: state.tasks.map((t) => {
          if (t.id !== action.id) return t;
          const updated = { ...t, ...action.patch };
          if (action.patch.done && !t.done) {
            updated.finishedAt = now;
          }
          return updated;
        }),
      };
    }

    case 'REMOVE_TASK':
      return { ...state, tasks: state.tasks.filter((t) => t.id !== action.id) };

    case 'ADD_CHAT_MESSAGE':
      return { ...state, chatHistory: [...state.chatHistory, action.msg] };

    case 'CLEAR_CHAT':
      return { ...state, chatHistory: [] };

    case 'ADD_WIKI_CHAT_MESSAGE':
      return { ...state, wikiChatHistory: [...state.wikiChatHistory, action.msg] };

    case 'CLEAR_WIKI_CHAT':
      return { ...state, wikiChatHistory: [] };

    case 'RESET_ALL':
      return {
        tasks: [],
        projects: PROJECTS,
        route: 'tasks',
        chatHistory: [],
        wikiChatHistory: [],
      };

    case 'HYDRATE':
      return {
        ...state,
        ...action.state,
        route: action.state.route || 'tasks',
        projects: Array.isArray(action.state.projects) && action.state.projects.length > 0
          ? action.state.projects
          : PROJECTS,
        chatHistory: Array.isArray(action.state.chatHistory) ? action.state.chatHistory : [],
        wikiChatHistory: Array.isArray(action.state.wikiChatHistory) ? action.state.wikiChatHistory : [],
      };

    default:
      return state;
  }
}
