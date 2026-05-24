export type Route = "tasks" | "notes" | "stats" | "llm-wiki" | "ask-mira" | "settings";
export type ViewMode = "personal" | "team";
export type TaskStatus = "open" | "complete";
export type TaskPriority = "low" | "normal" | "high" | "urgent";
export type Period = "daily" | "weekly" | "monthly";
export type LlmWikiPeriod = Period | "historical";
export type LlmWikiScope = "personal" | "team";
export type LlmWikiTarget = "team" | string;
export type SettingsTab = "account" | "security" | "team";
export type AskMiraSourceType = "wiki" | "wiki-index" | "wiki-page" | "task" | "note" | "team-member";

export type TeamNode = {
  id: string;
  parentId: string | null;
  name: string;
  title: string | null;
  sortOrder: number;
  active: boolean;
};

export type Task = {
  id: string;
  ownerNodeId: string;
  title: string;
  details: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  createdAt: string;
  completedAt: string | null;
  updatedAt: string;
};

export type MeetingNote = {
  id: string;
  ownerNodeId: string;
  title: string;
  date: string;
  content: string;
  tags: string;
  updatedAt: string;
};

export type User = {
  id: string;
  email: string;
  role: string | null;
  isSuperuser: boolean;
  teamNodeId: string | null;
  teamNode: Pick<TeamNode, "id" | "name" | "title" | "parentId"> | null;
  canViewTeam: boolean;
  canManageSettings: boolean;
};

export type Stats = {
  tasks: number;
  completedTasks: number;
  notes: number;
  noteWords: number;
  completionRate: number;
};

export type WorkView = {
  selectedNode: TeamNode | null;
  descendantIds: string[];
  tasks: Task[];
  notes: MeetingNote[];
  stats: Stats;
};

export type WorkspaceExport = {
  exportedAt: string;
  teamNodes: TeamNode[];
  tasks: Task[];
  notes: MeetingNote[];
};

export type LlmWikiSource = {
  path: string;
  filename: string;
  size: number;
  updatedAt: string;
};

export type LlmWikiPage = {
  path: string;
  title: string;
  size: number;
  updatedAt: string;
};

export type LlmWikiOwner = {
  id: string;
  name: string;
  title: string | null;
  email: string;
  teamNodeId: string | null;
  canEdit: boolean;
};

export type LlmWikiReferenceStats = {
  wikiPages: number;
  tasks: number;
  meetingNotes: number;
  resources: number;
};

export type LlmWikiOverview = {
  sources: LlmWikiSource[];
  pages: LlmWikiPage[];
  index: string;
  log: string;
  owner: LlmWikiOwner;
  referenceStats: LlmWikiReferenceStats;
};

export type LlmWikiIngestResult = {
  sourcePath: string;
  summary: string;
  writtenPages: string[];
  logEntry?: string;
  referenceStats?: LlmWikiReferenceStats;
};

export type LlmWikiLintResult = {
  findings: string[];
  notes: string;
  logEntry?: string;
};

export type LlmWikiPageContent = {
  path: string;
  content: string;
};

export type AskMiraSource = {
  id: string;
  type: AskMiraSourceType;
  title: string;
  ownerId: string;
  ownerName: string;
  path?: string;
  snippet: string;
  content: string;
};

export type AskMiraResult = {
  answer: string;
  sources: AskMiraSource[];
};

export type AskMiraMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  sources?: AskMiraSource[];
};

export type StatsSnapshot = Stats;
