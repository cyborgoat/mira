export type Route = "tasks" | "report" | "my-work" | "settings";
export type TaskStatus = "open" | "complete";
export type TaskPriority = "low" | "normal" | "high" | "urgent";
export type Period = "daily" | "weekly" | "monthly";
export type SettingsTab = "account" | "security" | "team" | "llm";
export type LlmProvider = "openai" | "openrouter" | "anthropic" | "custom-openai-compatible";

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

export type LlmConfig = {
  provider: LlmProvider;
  baseUrl: string;
  model: string;
  maxTokens: number;
  timeoutMs: number;
  proxy: string;
  hasApiKey: boolean;
  source: "file" | "env" | "defaults";
};

export type UpdateLlmConfigPayload = Partial<Pick<LlmConfig, "provider" | "baseUrl" | "model" | "maxTokens" | "timeoutMs" | "proxy">> & {
  apiKey?: string;
  clearApiKey?: boolean;
};

export type ReportSource = {
  id: string;
  type: "task" | "note" | "team-member";
  title: string;
  ownerId: string;
  ownerName: string;
  snippet: string;
  content: string;
};

export type ReportProfile = {
  ready: boolean;
  sampleCount: number;
  importedTaskCount: number;
  lastProcessedAt: string | null;
  rawReportCount: number;
  toneSummary: string | null;
};

export type ReportGenerateResult = {
  answer: string;
  sources: ReportSource[];
  period: Period;
  scope: "personal" | "team";
};

export type ReportSourceTask = {
  id: string;
  title: string;
  status: TaskStatus;
  completedAt: string | null;
  confidence: "high" | "uncertain";
};

export type ReportSources = {
  period: Period;
  scope: "personal" | "team";
  tasks: ReportSourceTask[];
  notes: Array<{ id: string; title: string; date: string }>;
};

export type ReportStylePreset = "concise" | "value" | "effort";

export type WorkArchiveWeek = {
  weekStart: string;
  label: string;
  taskCount: number;
  preview: string;
};

export type WorkArchiveProject = {
  tag: string;
  taskCount: number;
  noteCount: number;
};

export type WorkArchive = {
  weeks: WorkArchiveWeek[];
  projects: WorkArchiveProject[];
};

export type TaskRefineMessage = {
  role: "user" | "assistant";
  content: string;
};

export type TaskRefineResult = {
  assistantMessage: string;
  suggestions: Array<{ title: string; details?: string }>;
};

export type LocalTaskSuggestion = {
  title: string;
  details?: string;
  source: "task" | "note";
};

export type ReportRefineMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ReportRefineResult = {
  revisedDraft: string;
  assistantMessage: string;
};

export type ReportColdStartResult = {
  imported: number;
  skipped: number;
  profileReady: boolean;
  styleSummary: string;
  sampleCount: number;
};
