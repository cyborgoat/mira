const API_BASE = import.meta.env.VITE_MIRA_API_URL ?? "http://localhost:8000";

export type Member = {
  id: string;
  name: string;
  role: string;
  department: string;
  is_manager: number;
};

export type Todo = {
  id: string;
  member_id: string;
  content: string;
  summary?: string | null;
  category: string;
  priority: "low" | "normal" | "high";
  done: number;
  week_key: string;
  created_at: string;
  finished_at?: string | null;
};

export type Report = {
  id: string;
  member_id: string;
  week_key: string;
  completed: string[];
  in_progress: string[];
  next_week: string[];
  risks: string[];
  archived: number;
  markdown_path?: string | null;
  created_at: string;
  updated_at: string;
};

export type KnowledgeEntry = {
  id: string;
  member_id: string;
  report_id: string;
  week_key: string;
  text: string;
  source: string;
  markdown_path?: string | null;
  created_at: string;
};

export type Tag = {
  id: string;
  member_id: string;
  name: string;
  count: number;
  last_week: string;
  sleeping: number;
};

export type Achievement = {
  id: string;
  member_id: string;
  badge_id: string;
  badge_name: string;
  progress: number;
  threshold: number;
  unlocked: number;
  trace: string;
};

export type MiraState = {
  members: Member[];
  todos: Todo[];
  reports: Report[];
  knowledge: KnowledgeEntry[];
  tags: Tag[];
  achievements: Achievement[];
};

export type ImportResult = {
  id: string;
  report: Report;
  knowledge_entries: number;
  markdown_path: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json() as Promise<T>;
}

async function upload<T>(path: string, body: FormData): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { method: "POST", body });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json() as Promise<T>;
}

export const api = {
  state: () => request<MiraState>("/state"),
  createTodo: (body: { member_id: string; content: string; category?: string; priority?: string }) =>
    request<Todo>("/todos", { method: "POST", body: JSON.stringify(body) }),
  updateTodo: (id: string, body: { content?: string; summary?: string | null; category?: string; priority?: string; done?: boolean }) =>
    request<Todo>(`/todos/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  generateReport: (body: { member_id: string; weekly_note: string }) =>
    request<Report>("/reports/generate", { method: "POST", body: JSON.stringify(body) }),
  updateReport: (id: string, body: Pick<Report, "completed" | "in_progress" | "next_week" | "risks">) =>
    request<Report>(`/reports/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  archiveReport: (report_id: string) =>
    request<{ report: Report; knowledge_entries: number; markdown_path: string }>("/reports/archive", {
      method: "POST",
      body: JSON.stringify({ report_id }),
    }),
  importText: (body: { member_id: string; filename: string; content: string; week_key?: string; archive?: boolean; language?: "en" | "zh" }) =>
    request<ImportResult>("/imports/text", { method: "POST", body: JSON.stringify(body) }),
  importFile: (body: { member_id: string; file: File; week_key?: string; archive?: boolean; language?: "en" | "zh" }) => {
    const form = new FormData();
    form.append("member_id", body.member_id);
    form.append("file", body.file);
    form.append("archive", String(body.archive ?? true));
    if (body.week_key) form.append("week_key", body.week_key);
    if (body.language) form.append("language", body.language);
    return upload<ImportResult>("/imports/file", form);
  },
  searchKb: (body: { member_id: string; query: string }) =>
    request<KnowledgeEntry[]>("/kb/search", { method: "POST", body: JSON.stringify(body) }),
  teamSummary: (body: { member_ids: string[]; weeks: number; language?: "en" | "zh" }) =>
    request<{ id: string; markdown: string; markdown_path: string; created_at: string }>("/team-summary/generate", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
