export interface Task {
  id: string;
  weekKey: string;
  projectId: string;
  title: string;
  detail?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  dueDate: string;
  done: boolean;
  tags: string[];
  createdAt: number;
  finishedAt: number | null;
}

export interface Project {
  id: string;
  name: string;
  color: string;
  icon: string;
}

export interface SourceCard {
  type: string;
  text: string;
  status: string;
}

export interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
  time: number;
  sources?: SourceCard[];
}

export interface AppState {
  tasks: Task[];
  projects: Project[];
  route: string;
  chatHistory: ChatMsg[];
  wikiChatHistory: ChatMsg[];
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  avatar: string;
  color: string;
}

export interface MemberAbility {
  memberId: string;
  tags: Array<{ label: string; type: 'type' | 'project' | 'keyword'; weight: number }>;
  totalTasks: number;
  doneTasks: number;
  topTypes: Array<{ label: string; count: number }>;
  topProj: Array<{ label: string; count: number }>;
  topKw: Array<{ label: string; count: number }>;
}

export interface ProjectContext {
  projectName: string;
  tasks: Task[];
}

export type PeriodType = 'daily' | 'weekly' | 'monthly';
export type ReportTab = 'personal' | 'team';
export type ViewMode = 'personal' | 'management';
