import { useCallback, useEffect, useState } from "react";
import type { MeetingNote, Period, Task, TaskPriority, TaskStatus, TeamNode, User, WorkView, WorkspaceExport, LlmConfig, UpdateLlmConfigPayload, ReportProfile, ReportGenerateResult, ReportColdStartResult, TaskRefineMessage, TaskRefineResult, LocalTaskSuggestion, ReportRefineMessage, ReportRefineResult, ReportSources, ReportStylePreset, WorkArchive } from "./types";
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
  loadReportProfile: () => Promise<ReportProfile>;
  loadReportSources: (payload: { period: Period; scope?: "personal" | "team" }) => Promise<ReportSources>;
  generateReport: (payload: {
    period: Period;
    scope?: "personal" | "team";
    language: "en" | "zh";
    includedTaskIds?: string[];
    includedNoteIds?: string[];
    stylePreset?: ReportStylePreset;
  }) => Promise<ReportGenerateResult>;
  assembleReport: (payload: {
    period: Period;
    scope?: "personal" | "team";
    language: "en" | "zh";
    includedTaskIds?: string[];
    includedNoteIds?: string[];
  }) => Promise<ReportGenerateResult>;
  loadLocalTaskSuggestion: (scope?: "personal" | "team") => Promise<LocalTaskSuggestion>;
  loadWorkArchive: () => Promise<WorkArchive>;
  uploadReportHistory: (files: Array<{ filename: string; content: string }>) => Promise<{ saved: string[]; count: number }>;
  processReportColdStart: (language: "en" | "zh") => Promise<ReportColdStartResult>;
  refineTasks: (payload: { language: "en" | "zh"; scope?: "personal" | "team"; messages: TaskRefineMessage[] }) => Promise<TaskRefineResult>;
  refineReport: (payload: {
    language: "en" | "zh";
    period: Period;
    scope?: "personal" | "team";
    draft: string;
    message: string;
    messages?: ReportRefineMessage[];
    stylePreset?: ReportStylePreset;
  }) => Promise<ReportRefineResult>;
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
  return useCallback(async <T,>(path: string, options: RequestInit = {}, manualAi = false) => {
    const headers = new Headers(options.headers);
    headers.set("Content-Type", "application/json");
    if (token) headers.set("Authorization", `Bearer ${token}`);
    if (manualAi) headers.set("X-Mira-AI-Manual", "1");
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
      let response: Response;
      try {
        response = await fetch(`${API_URL}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
      } catch {
        throw new Error("无法连接本地服务，请重启 Mira 应用后重试");
      }
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(typeof body.message === "string" ? body.message : i18n.t("login.error"));
      }
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
    loadReportProfile: () => request<ReportProfile>("/me/reports/profile"),
    loadReportSources: (payload) => {
      const params = new URLSearchParams({ period: payload.period });
      if (payload.scope) params.set("scope", payload.scope);
      return request<ReportSources>(`/me/reports/sources?${params.toString()}`);
    },
    generateReport: (payload) =>
      request<ReportGenerateResult>("/me/reports/generate", { method: "POST", body: JSON.stringify(payload) }, true),
    assembleReport: (payload) =>
      request<ReportGenerateResult>("/me/reports/assemble", { method: "POST", body: JSON.stringify(payload) }),
    loadLocalTaskSuggestion: (scope) => {
      const params = scope ? `?scope=${scope}` : "";
      return request<LocalTaskSuggestion>(`/me/tasks/local-suggestion${params}`);
    },
    loadWorkArchive: () => request<WorkArchive>("/me/work/archive"),
    uploadReportHistory: (files) => request<{ saved: string[]; count: number }>("/me/reports/cold-start/upload", { method: "POST", body: JSON.stringify({ files }) }),
    processReportColdStart: (language) =>
      request<ReportColdStartResult>("/me/reports/cold-start/process", { method: "POST", body: JSON.stringify({ language }) }, true),
    refineTasks: (payload) =>
      request<TaskRefineResult>("/me/tasks/ai-refine", { method: "POST", body: JSON.stringify(payload) }, true),
    refineReport: (payload) =>
      request<ReportRefineResult>("/me/reports/refine", { method: "POST", body: JSON.stringify(payload) }, true),
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
