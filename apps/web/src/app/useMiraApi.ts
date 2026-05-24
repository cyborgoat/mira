import { useCallback, useEffect, useState } from "react";
import type { MeetingNote, Period, Task, TaskPriority, TaskStatus, TeamNode, User, WorkView, LlmWikiOverview, LlmWikiOwner, LlmWikiPeriod, LlmWikiScope, LlmWikiReferenceStats, LlmWikiIngestResult, LlmWikiLintResult, LlmWikiPageContent, LlmWikiSource, LlmWikiPage, AskMiraResult, ViewMode, WorkspaceExport, LlmConfig, UpdateLlmConfigPayload } from "./types";
import i18n from "@/i18n";
import { errorMessage, parseWorkspaceExport, sortNodesForDelete, sortNodesForImport, downloadJson } from "./helpers";

const API_URL = import.meta.env.VITE_MIRA_API_URL ?? (window.__TAURI_INTERNALS__ ? "http://127.0.0.1:8173" : "http://127.0.0.1:8000");
const TOKEN_KEY = "mira-api-token-v1";

export type MiraApi = {
  user: User | null;
  teamNodes: TeamNode[];
  workView: WorkView | null;
  teamView: WorkView | null;
  error: string;
  loading: boolean;
  revision: number;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loadWorkspace: (period: Period) => Promise<void>;
  updateProfile: (payload: { name: string; email: string; role: string }) => Promise<void>;
  updatePassword: (payload: { currentPassword: string; newPassword: string }) => Promise<void>;
  createTask: (payload: { title: string; details: string; priority: TaskPriority; dueDate?: string }) => Promise<void>;
  updateTask: (
    id: string,
    payload: { title?: string; details?: string; status?: TaskStatus; priority?: TaskPriority; dueDate?: string | null },
  ) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  createNote: (payload: { title: string; date: string; content: string; tags: string }) => Promise<MeetingNote>;
  updateNote: (id: string, payload: { title?: string; date?: string; content?: string; tags?: string }) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  loadLlmWiki: (payload?: { ownerId?: string; view?: ViewMode; scope?: LlmWikiScope }) => Promise<LlmWikiOverview>;
  loadLlmWikiOwners: () => Promise<LlmWikiOwner[]>;
  loadLlmWikiReferenceStats: (payload: { period: LlmWikiPeriod; scope: LlmWikiScope; ownerId?: string }) => Promise<LlmWikiReferenceStats>;
  generateLlmWiki: (payload: { period: LlmWikiPeriod; scope: LlmWikiScope; language: "en" | "zh" }) => Promise<LlmWikiIngestResult>;
  uploadLlmWikiSource: (payload: { filename: string; content: string; view?: ViewMode }) => Promise<LlmWikiSource>;
  ingestLlmWikiSource: (payload: { sourcePath: string; language: "en" | "zh"; view?: ViewMode }) => Promise<LlmWikiIngestResult>;
  askMira: (payload: { question: string; language: "en" | "zh"; scope: "personal" | "team"; ownerId?: string }) => Promise<AskMiraResult>;
  lintLlmWiki: (payload: { language: "en" | "zh"; view?: ViewMode }) => Promise<LlmWikiLintResult>;
  readLlmWikiPage: (path: string, payload?: { ownerId?: string; view?: ViewMode; scope?: LlmWikiScope }) => Promise<LlmWikiPageContent>;
  updateLlmWikiPage: (payload: { path: string; content: string; view?: ViewMode }) => Promise<LlmWikiPageContent>;
  deleteLlmWikiPage: (path: string, view?: ViewMode) => Promise<{ path: string; deleted: boolean }>;
  createTeamNode: (payload: { name: string; title?: string; parentId?: string }) => Promise<void>;
  updateTeamNode: (id: string, payload: { name?: string; title?: string | null; parentId?: string | null }) => Promise<void>;
  deleteTeamNode: (id: string) => Promise<void>;
  loadLlmConfig: () => Promise<LlmConfig>;
  updateLlmConfig: (payload: UpdateLlmConfigPayload) => Promise<LlmConfig>;
  exportWorkspace: () => Promise<void>;
  importWorkspace: (file: File | undefined) => Promise<void>;
  resetWorkspace: () => Promise<void>;
};

function useRequest(token: string, setError: (value: string) => void) {
  return useCallback(async <T,>(path: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers);
    headers.set("Content-Type", "application/json");
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const response = await fetch(`${API_URL}${path}`, { ...options, headers });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message || body.detail || i18n.t("errors.requestFailed", { status: response.status }));
    }
    return (await response.json()) as T;
  }, [token]);
}

export function useMiraApi(): MiraApi {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) ?? "");
  const [user, setUser] = useState<User | null>(null);
  const [teamNodes, setTeamNodes] = useState<TeamNode[]>([]);
  const [workView, setWorkView] = useState<WorkView | null>(null);
  const [teamView, setTeamView] = useState<WorkView | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const request = useRequest(token, setError);

  const refreshUser = useCallback(async () => {
    const current = await request<User>("/auth/me");
    setUser(current);
    return current;
  }, [request]);

  const loadWorkspace = useCallback(
    async (period: Period) => {
      try {
        setError("");
        const current = user ?? await refreshUser();
        const [nodes, own] = await Promise.all([request<TeamNode[]>("/team/tree"), request<WorkView>(`/me/work?period=${period}`)]);
        setTeamNodes(nodes);
        setWorkView(own);
        if (current.canViewTeam) setTeamView(await request<WorkView>(`/me/team-view?period=${period}`));
        else setTeamView(null);
      } catch (err) {
        setError(errorMessage(err));
      }
    },
    [refreshUser, request, user],
  );

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      setError("");
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) throw new Error(i18n.t("login.error"));
      const data = (await response.json()) as { accessToken: string; user: User };
      localStorage.setItem(TOKEN_KEY, data.accessToken);
      setToken(data.accessToken);
      setUser(data.user);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken("");
    setUser(null);
    setTeamNodes([]);
    setWorkView(null);
    setTeamView(null);
  };

  useEffect(() => {
    if (!token) return;
    void refreshUser().catch(() => logout());
  }, [token, refreshUser]);

  const mutate = async (operation: () => Promise<unknown>) => {
    setLoading(true);
    try {
      setError("");
      await operation();
      setRevision((current) => current + 1);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const exportWorkspace = async () => {
    const [allTasks, allNotes] = await Promise.all([request<Task[]>("/tasks"), request<MeetingNote[]>("/notes")]);
    downloadJson({ exportedAt: new Date().toISOString(), teamNodes, tasks: allTasks, notes: allNotes });
  };

  const importWorkspace = async (file: File | undefined) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".json")) {
      setError(i18n.t("errors.jsonOnly"));
      return;
    }
    await mutate(async () => {
      const payload = parseWorkspaceExport(await file.text());
      const idMap = new Map<string, string>();
      for (const node of sortNodesForImport(payload.teamNodes)) {
        const created = await request<TeamNode>("/team/nodes", {
          method: "POST",
          body: JSON.stringify({ name: node.name, title: node.title || undefined, parentId: node.parentId ? idMap.get(node.parentId) : undefined }),
        });
        idMap.set(node.id, created.id);
      }
      for (const task of payload.tasks) {
        const ownerNodeId = idMap.get(task.ownerNodeId);
        if (!ownerNodeId) continue;
        const created = await request<Task>("/tasks", { method: "POST", body: JSON.stringify({ ownerNodeId, title: task.title, details: task.details, priority: task.priority, dueDate: task.dueDate }) });
        if (task.status === "complete") await request(`/tasks/${created.id}`, { method: "PATCH", body: JSON.stringify({ status: "complete" }) });
      }
      for (const note of payload.notes) {
        const ownerNodeId = idMap.get(note.ownerNodeId);
        if (!ownerNodeId) continue;
        await request("/notes", { method: "POST", body: JSON.stringify({ ownerNodeId, title: note.title, date: note.date, content: note.content, tags: note.tags || "" }) });
      }
    });
  };

  const resetWorkspace = async () => {
    await mutate(async () => {
      const [allTasks, allNotes, nodes] = await Promise.all([request<Task[]>("/tasks"), request<MeetingNote[]>("/notes"), request<TeamNode[]>("/team/tree")]);
      for (const task of allTasks) await request(`/tasks/${task.id}`, { method: "DELETE" });
      for (const note of allNotes) await request(`/notes/${note.id}`, { method: "DELETE" });
      for (const node of sortNodesForDelete(nodes)) await request(`/team/nodes/${node.id}`, { method: "DELETE" });
    });
  };

  const updateProfile = async (payload: { name: string; email: string; role: string }) => {
    setLoading(true);
    try {
      setError("");
      await request<User>("/me/profile", { method: "PATCH", body: JSON.stringify(payload) });
      const updated = await refreshUser();
      setUser(updated);
      setRevision((current) => current + 1);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return {
    user,
    teamNodes,
    workView,
    teamView,
    error,
    loading,
    revision,
    login,
    logout,
    loadWorkspace,
    updateProfile,
    updatePassword: (payload) => mutate(() => request("/me/password", { method: "PATCH", body: JSON.stringify(payload) })),
    createTask: (payload) => mutate(() => request("/me/tasks", { method: "POST", body: JSON.stringify(payload) })),
    updateTask: (id, payload) => mutate(() => request(`/me/tasks/${id}`, { method: "PATCH", body: JSON.stringify(payload) })),
    deleteTask: (id) => mutate(() => request(`/me/tasks/${id}`, { method: "DELETE" })),
    createNote: async (payload) => {
      let created: MeetingNote | null = null;
      await mutate(async () => {
        created = await request<MeetingNote>("/me/notes", { method: "POST", body: JSON.stringify(payload) });
      });
      return created!;
    },
    updateNote: (id, payload) => mutate(() => request(`/me/notes/${id}`, { method: "PATCH", body: JSON.stringify(payload) })),
    deleteNote: (id) => mutate(() => request(`/me/notes/${id}`, { method: "DELETE" })),
    loadLlmWiki: (payload) => {
      const params = new URLSearchParams();
      if (payload?.ownerId) params.set("ownerId", payload.ownerId);
      if (payload?.view) params.set("view", payload.view);
      if (payload?.scope) params.set("scope", payload.scope);
      const query = params.toString();
      return request<LlmWikiOverview>(`/me/llm-wiki${query ? `?${query}` : ""}`);
    },
    loadLlmWikiOwners: () => request<LlmWikiOwner[]>("/me/llm-wiki/owners"),
    loadLlmWikiReferenceStats: (payload) => {
      const params = new URLSearchParams({ period: payload.period, scope: payload.scope });
      if (payload.ownerId) params.set("ownerId", payload.ownerId);
      return request<LlmWikiReferenceStats>(`/me/llm-wiki/reference-stats?${params.toString()}`);
    },
    generateLlmWiki: (payload) => request<LlmWikiIngestResult>("/me/llm-wiki/generate", { method: "POST", body: JSON.stringify(payload) }),
    uploadLlmWikiSource: (payload) => request<LlmWikiSource>("/me/llm-wiki/sources", { method: "POST", body: JSON.stringify(payload) }),
    ingestLlmWikiSource: (payload) => request<LlmWikiIngestResult>("/me/llm-wiki/ingest", { method: "POST", body: JSON.stringify(payload) }),
    askMira: (payload) => request<AskMiraResult>("/me/ask-mira", { method: "POST", body: JSON.stringify(payload) }),
    lintLlmWiki: (payload) => request<LlmWikiLintResult>("/me/llm-wiki/lint", { method: "POST", body: JSON.stringify(payload) }),
    readLlmWikiPage: (path, payload) => {
      const params = new URLSearchParams({ path });
      if (payload?.ownerId) params.set("ownerId", payload.ownerId);
      if (payload?.view) params.set("view", payload.view);
      if (payload?.scope) params.set("scope", payload.scope);
      return request<LlmWikiPageContent>(`/me/llm-wiki/pages?${params.toString()}`);
    },
    updateLlmWikiPage: (payload) => request<LlmWikiPageContent>("/me/llm-wiki/pages", { method: "PATCH", body: JSON.stringify(payload) }),
    deleteLlmWikiPage: (path, view) => {
      const params = new URLSearchParams({ path });
      if (view) params.set("view", view);
      return request<{ path: string; deleted: boolean }>(`/me/llm-wiki/pages?${params.toString()}`, { method: "DELETE" });
    },
    createTeamNode: (payload) => mutate(() => request("/team/nodes", { method: "POST", body: JSON.stringify(payload) })),
    updateTeamNode: (id, payload) => mutate(() => request(`/team/nodes/${id}`, { method: "PATCH", body: JSON.stringify(payload) })),
    deleteTeamNode: (id) => mutate(() => request(`/team/nodes/${id}`, { method: "DELETE" })),
    loadLlmConfig: () => request<LlmConfig>("/me/settings/llm-config"),
    updateLlmConfig: (payload) => request<LlmConfig>("/me/settings/llm-config", { method: "PATCH", body: JSON.stringify(payload) }),
    exportWorkspace,
    importWorkspace,
    resetWorkspace,
  };
}
