import {
  BarChart3,
  CheckCircle2,
  Download,
  Edit3,
  FileText,
  GitFork,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Plus,
  Save,
  Search,
  Settings,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import i18n from "./i18n";
import "./styles.css";

type Route = "dashboard" | "tasks" | "notes" | "stats" | "settings";
type ViewMode = "personal" | "team";
type TaskStatus = "open" | "complete";
type TaskPriority = "low" | "normal" | "high" | "urgent";
type Period = "daily" | "weekly" | "monthly";
type SettingsTab = "account" | "security" | "team";

type TeamNode = {
  id: string;
  parentId: string | null;
  name: string;
  title: string | null;
  sortOrder: number;
  active: boolean;
};

type Task = {
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

type MeetingNote = {
  id: string;
  ownerNodeId: string;
  title: string;
  date: string;
  content: string;
  tags: string;
  updatedAt: string;
};

type User = {
  id: string;
  email: string;
  role: string | null;
  isSuperuser: boolean;
  teamNodeId: string | null;
  teamNode: Pick<TeamNode, "id" | "name" | "title" | "parentId"> | null;
  canViewTeam: boolean;
  canManageSettings: boolean;
};

type WorkView = {
  selectedNode: TeamNode | null;
  descendantIds: string[];
  tasks: Task[];
  notes: MeetingNote[];
  stats: ReturnType<typeof buildStats>;
};

type WorkspaceExport = {
  exportedAt: string;
  teamNodes: TeamNode[];
  tasks: Task[];
  notes: MeetingNote[];
};

const API_URL = import.meta.env.VITE_MIRA_API_URL ?? "http://127.0.0.1:8000";
const TOKEN_KEY = "mira-api-token-v1";

const nav: Array<{ key: Route; icon: React.ComponentType<{ size?: number }> }> = [
  { key: "dashboard", icon: LayoutDashboard },
  { key: "tasks", icon: ListChecks },
  { key: "notes", icon: FileText },
  { key: "stats", icon: BarChart3 },
  { key: "settings", icon: Settings },
];

function App() {
  const { t } = useTranslation();
  const [route, setRoute] = useState<Route>(resolveRouteFromHash());
  const [period, setPeriod] = useState<Period>("weekly");
  const [viewMode, setViewMode] = useState<ViewMode>("personal");
  const api = useMiraApi();
  const activeView = viewMode === "team" && api.teamView ? api.teamView : api.workView;
  const visibleTasks = activeView?.tasks ?? [];
  const visibleNotes = activeView?.notes ?? [];
  const currentNav = nav.find((item) => item.key === route) ?? nav[0];

  useEffect(() => {
    const handleHashChange = () => setRoute(resolveRouteFromHash());
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    if (!api.user) return;
    void api.loadWorkspace(period);
  }, [api.user, period, api.revision, api.loadWorkspace]);

  useEffect(() => {
    if (viewMode === "team" && !api.user?.canViewTeam) setViewMode("personal");
  }, [api.user?.canViewTeam, viewMode]);

  const navigateTo = (nextRoute: Route) => {
    window.location.hash = nextRoute;
    setRoute(nextRoute);
  };

  if (!api.user) return <LoginScreen onLogin={api.login} error={api.error} loading={api.loading} />;
  const headerEyebrow = route === "settings" ? t("header.accountSettings") : viewMode === "team" ? t("header.readOnlyTeam") : api.user.role || t("header.personalWorkspace");
  const headerCopy = route === "settings"
    ? t("header.settingsCopy")
    : viewMode === "team"
      ? t("header.teamCopy")
      : t("header.personalCopy");

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">M</span>
          <div className="brand-stack">
            <span className="brand-name">{t("common.appName")}</span>
            <span className="brand-slogan">{t("common.appSubtitle")}</span>
          </div>
        </div>
        <div className="row topbar-controls">
          {api.user.canViewTeam && (
            <ViewModeSwitch value={viewMode} onChange={setViewMode} />
          )}
          <LanguageSelect compact />
          <Badge>{api.user.teamNode?.name ?? api.user.email}</Badge>
          <Button type="button" variant="ghost" size="sm" onClick={api.logout}>
            <LogOut size={15} /> {t("common.signOut")}
          </Button>
        </div>
      </header>

      <aside className="sidebar">
        <div className="stack">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={`nav-button ${route === item.key ? "active" : ""}`}
                key={item.key}
                onClick={() => navigateTo(item.key)}
              >
                <Icon size={17} />
                {t(`nav.${item.key}`)}
              </Button>
            );
          })}
        </div>
      </aside>

      <main className="main">
        {api.error && <div className="form-error page-error">{api.error}</div>}
        <div className="page-header">
          <div>
            <div className="eyebrow">{headerEyebrow}</div>
            <h1>{t(`nav.${currentNav.key}`)}</h1>
            <p className="muted">{headerCopy}</p>
          </div>
          {(route === "dashboard" || route === "stats") && <PeriodControl value={period} onChange={setPeriod} />}
        </div>

        {route === "dashboard" && <DashboardView view={activeView} mode={viewMode} nodes={api.teamNodes} />}
        {route === "tasks" && (
          <TasksView
            tasks={visibleTasks}
            nodes={api.teamNodes}
            readOnly={viewMode === "team"}
            onCreate={api.createTask}
            onUpdate={api.updateTask}
            onDelete={api.deleteTask}
          />
        )}
        {route === "notes" && (
          <NotesView
            notes={visibleNotes}
            nodes={api.teamNodes}
            readOnly={viewMode === "team"}
            onCreate={api.createNote}
            onUpdate={api.updateNote}
            onDelete={api.deleteNote}
          />
        )}
        {route === "stats" && <StatsView view={activeView} period={period} nodes={api.teamNodes} showOwners={viewMode === "team"} />}
        {route === "settings" && (
          <SettingsView
            user={api.user}
            nodes={api.teamNodes}
            teamView={api.teamView}
            onUpdateProfile={api.updateProfile}
            onUpdatePassword={api.updatePassword}
            onCreate={api.createTeamNode}
            onUpdate={api.updateTeamNode}
            onDelete={api.deleteTeamNode}
            onExport={api.exportWorkspace}
            onImport={api.importWorkspace}
            onReset={api.resetWorkspace}
          />
        )}
      </main>
    </div>
  );
}

function LoginScreen({ onLogin, error, loading }: { onLogin: (email: string, password: string) => Promise<void>; error: string; loading: boolean }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState("manager@mira.local");
  const [password, setPassword] = useState("local-password");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    await onLogin(email, password);
  };

  return (
    <div className="login-shell">
      <Card className="stack login-card">
        <div className="login-brand">
          <span className="brand-mark">M</span>
          {t("common.appName")}
          <LanguageSelect compact />
        </div>
        <div>
          <h1>{t("login.title")}</h1>
          <p className="muted">{t("login.mockUsers")}</p>
        </div>
        {error && <div className="form-error">{error}</div>}
        <form className="stack" onSubmit={submit}>
          <label className="field">
            <span>{t("login.email")}</span>
            <Input value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label className="field">
            <span>{t("login.password")}</span>
            <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <Button type="submit" disabled={loading}>
            {loading ? t("login.signingIn") : t("login.submit")}
          </Button>
        </form>
      </Card>
    </div>
  );
}

function DashboardView({ view, mode, nodes }: { view: WorkView | null; mode: ViewMode; nodes: TeamNode[] }) {
  const { t } = useTranslation();
  const tasks = view?.tasks ?? [];
  const notes = view?.notes ?? [];
  const dueTasks = tasks.filter((task) => task.status === "open" && task.dueDate).slice(0, 5);
  return (
    <div className="stack">
      <StatsGrid stats={buildStats(tasks, notes)} />
      <div className="grid two-col work-grid">
        <Card className="stack">
          <div className="row-between">
            <h2>{mode === "team" ? t("dashboard.teamTasks") : t("dashboard.myTasks")}</h2>
            <Badge>{tasks.length} {t("common.records")}</Badge>
          </div>
          <SummaryList
            items={tasks.slice(0, 8).map((task) => ({
              id: task.id,
              date: task.completedAt ?? task.dueDate ?? task.createdAt,
              title: task.title,
              body: `${nodeLabel(nodes, task.ownerNodeId)} · ${priorityLabel(task.priority, t)} · ${t(`status.${task.status}`)}`,
            }))}
          />
        </Card>
        <Card className="stack">
          <div className="row-between">
            <h2>{mode === "team" ? t("dashboard.teamNotes") : t("dashboard.myNotes")}</h2>
            <Badge>{notes.length} {t("common.notes")}</Badge>
          </div>
          <SummaryList items={notes.slice(0, 8).map((note) => ({ id: note.id, date: note.date, title: note.title, body: note.tags || firstLines(note.content) }))} />
        </Card>
      </div>
      <Card className="stack">
        <h2>{t("dashboard.dueSoon")}</h2>
        <SummaryList items={dueTasks.map((task) => ({ id: task.id, date: task.dueDate!, title: task.title, body: task.details }))} />
      </Card>
    </div>
  );
}

function TasksView({
  tasks,
  nodes,
  readOnly,
  onCreate,
  onUpdate,
  onDelete,
}: {
  tasks: Task[];
  nodes: TeamNode[];
  readOnly: boolean;
  onCreate: (payload: { title: string; details: string; priority: TaskPriority; dueDate?: string }) => Promise<void>;
  onUpdate: (id: string, payload: { title?: string; details?: string; status?: TaskStatus; priority?: TaskPriority; dueDate?: string | null }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState({ title: "", details: "", priority: "normal" as TaskPriority, dueDate: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | TaskStatus>("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | TaskPriority>("all");
  const editingTask = tasks.find((task) => task.id === editingId);
  const visibleTasks = tasks.filter((task) => {
    const matchesQuery = `${task.title} ${task.details}`.toLowerCase().includes(query.toLowerCase());
    const matchesStatus = statusFilter === "all" || task.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || task.priority === priorityFilter;
    return matchesQuery && matchesStatus && matchesPriority;
  });

  const saveTask = useCallback(async () => {
    const title = draft.title.trim();
    if (!title || readOnly) return;
    if (editingTask) {
      await onUpdate(editingTask.id, { title, details: draft.details.trim(), priority: draft.priority, dueDate: draft.dueDate || null });
      setEditingId(null);
    } else {
      await onCreate({ title, details: draft.details.trim(), priority: draft.priority, dueDate: draft.dueDate || undefined });
    }
    setDraft({ title: "", details: "", priority: "normal", dueDate: "" });
  }, [draft, editingTask, onCreate, onUpdate, readOnly]);

  const newTask = useCallback(() => {
    setEditingId(null);
    setDraft({ title: "", details: "", priority: "normal", dueDate: "" });
  }, []);

  const startEdit = (task: Task) => {
    if (readOnly) return;
    setEditingId(task.id);
    setDraft({ title: task.title, details: task.details, priority: task.priority, dueDate: task.dueDate ? toDateInput(task.dueDate) : "" });
  };

  useKeyboardShortcuts({ onSave: saveTask, onNew: newTask, enabled: !readOnly });

  return (
    <div className="grid two-col work-grid">
      {!readOnly && (
        <Card className="stack editor-panel">
          <div className="row-between">
            <h2>{editingTask ? t("tasks.editTask") : t("tasks.newTask")}</h2>
            {editingTask && <Badge>{formatDate(editingTask.createdAt)}</Badge>}
          </div>
          <Input value={draft.title} placeholder={t("tasks.titlePlaceholder")} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
          <div className="editor-fields">
            <PrioritySelect value={draft.priority} onChange={(priority) => setDraft({ ...draft, priority })} />
            <Input type="date" value={draft.dueDate} onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })} />
          </div>
          <Textarea className="compact" value={draft.details} placeholder={t("tasks.detailsPlaceholder")} onChange={(event) => setDraft({ ...draft, details: event.target.value })} />
          <div className="row-between">
            <Button variant="secondary" type="button" onClick={newTask}>
              {t("common.clear")}
            </Button>
            <Button type="button" disabled={!draft.title.trim()} onClick={saveTask}>
              {editingTask ? <Save size={16} /> : <Plus size={16} />} {editingTask ? t("tasks.saveTask") : t("tasks.addTask")}
            </Button>
          </div>
        </Card>
      )}

      <Card className="stack">
        <div className="row-between">
          <h2>{readOnly ? t("tasks.teamDetails") : t("tasks.taskList")}</h2>
          <Badge>{tasks.filter((task) => task.status === "complete").length} {t("common.complete")}</Badge>
        </div>
        <div className="search-field">
          <Search size={16} />
          <Input value={query} placeholder={t("tasks.search")} onChange={(event) => setQuery(event.target.value)} />
        </div>
        <div className="filter-row">
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as "all" | TaskStatus)}>
            <SelectTrigger><SelectValue placeholder={t("tasks.status")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("tasks.allStatus")}</SelectItem>
              <SelectItem value="open">{t("status.open")}</SelectItem>
              <SelectItem value="complete">{t("status.complete")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={(value) => setPriorityFilter(value as "all" | TaskPriority)}>
            <SelectTrigger><SelectValue placeholder={t("tasks.priority")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("tasks.allPriority")}</SelectItem>
              {(["low", "normal", "high", "urgent"] as TaskPriority[]).map((priority) => (
                <SelectItem value={priority} key={priority}>{priorityLabel(priority, t)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="item-list">
          {visibleTasks.map((task) => (
            <div className={`todo task-row ${task.status === "complete" ? "done" : ""}`} key={task.id}>
              <div className="row-between">
                <label className="row task-check">
                  {!readOnly && <Checkbox checked={task.status === "complete"} onCheckedChange={(checked) => onUpdate(task.id, { status: checked ? "complete" : "open" })} />}
                  <span className="todo-title">{task.title}</span>
                </label>
                <div className="row badge-row">
                  <Badge>{priorityLabel(task.priority, t)}</Badge>
                  <Badge>{nodeLabel(nodes, task.ownerNodeId)}</Badge>
                </div>
              </div>
              {task.details && <p className="muted item-body">{task.details}</p>}
              <div className="item-actions">
                <span className="muted">{task.dueDate ? t("tasks.due", { date: formatDate(task.dueDate) }) : formatDate(task.completedAt ?? task.createdAt)}</span>
                {!readOnly && (
                  <>
                    <Button type="button" variant="ghost" size="sm" onClick={() => startEdit(task)}>
                      <Edit3 size={14} /> {t("common.edit")}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => confirmAction(t("tasks.deleteConfirm"), () => onDelete(task.id))}>
                      <Trash2 size={14} /> {t("common.delete")}
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
          {!visibleTasks.length && <EmptyState title={t("tasks.emptyTitle")} text={t("tasks.emptyText")} actionLabel={readOnly ? undefined : t("tasks.newTask")} onAction={newTask} />}
        </div>
      </Card>
    </div>
  );
}

function NotesView({
  notes,
  nodes,
  readOnly,
  onCreate,
  onUpdate,
  onDelete,
}: {
  notes: MeetingNote[];
  nodes: TeamNode[];
  readOnly: boolean;
  onCreate: (payload: { title: string; date: string; content: string; tags: string }) => Promise<MeetingNote>;
  onUpdate: (id: string, payload: { title?: string; date?: string; content?: string; tags?: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [activeId, setActiveId] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const activeNote = activeId ? notes.find((note) => note.id === activeId) ?? null : null;
  const [draft, setDraft] = useState(createBlankNote);
  const [uploadError, setUploadError] = useState("");

  useEffect(() => {
    if (!activeId && !isCreating && notes[0]) setActiveId(notes[0].id);
  }, [activeId, isCreating, notes]);

  useEffect(() => {
    if (activeId && !activeNote) setActiveId(notes[0]?.id ?? "");
  }, [activeId, activeNote, notes]);

  useEffect(() => {
    if (activeNote) setDraft({ ...activeNote, date: toDateInput(activeNote.date) });
  }, [activeNote?.id]);

  const saveNote = useCallback(async () => {
    if (readOnly) return;
    const title = draft.title.trim() || t("notes.untitled");
    if (activeNote && !isCreating) {
      await onUpdate(activeNote.id, { title, date: draft.date, content: draft.content, tags: draft.tags });
    } else {
      const created = await onCreate({ title, date: draft.date, content: draft.content, tags: draft.tags });
      setActiveId(created.id);
      setIsCreating(false);
    }
  }, [activeNote, draft, isCreating, onCreate, onUpdate, readOnly]);

  const newNote = useCallback(() => {
    setDraft(createBlankNote());
    setActiveId("");
    setIsCreating(true);
  }, []);

  useKeyboardShortcuts({ onSave: saveNote, onNew: newNote, enabled: !readOnly });

  const uploadNote = async (file: File | undefined) => {
    if (!file || readOnly) return;
    setUploadError("");
    if (!/\.(md|markdown|txt)$/i.test(file.name)) {
      setUploadError(t("notes.uploadError"));
      return;
    }
    try {
      const content = await file.text();
      const title = file.name.replace(/\.(md|markdown|txt)$/i, "");
      const created = await onCreate({ title, date: today(), content, tags: "" });
      setActiveId(created.id);
      setIsCreating(false);
    } catch {
      setUploadError(t("notes.readError"));
    }
  };

  return (
    <div className="grid notes-grid">
      <Card className="stack note-list">
        <div className="row-between">
          <h2>{readOnly ? t("notes.teamTitle") : t("notes.title")}</h2>
          {!readOnly && (
            <Button type="button" size="sm" onClick={newNote}>
              <Plus size={15} /> {t("notes.new")}
            </Button>
          )}
        </div>
        {!readOnly && (
          <label className="upload-button">
            <Upload size={15} />
            {t("notes.uploadMarkdown")}
            <Input type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" onChange={(event) => uploadNote(event.target.files?.[0])} />
          </label>
        )}
        {uploadError && <div className="form-error">{uploadError}</div>}
        <div className="item-list">
          {notes.map((note) => (
            <button
              className={`note-tab ${note.id === activeId ? "active" : ""}`}
              key={note.id}
              onClick={() => {
                setIsCreating(false);
                setActiveId(note.id);
              }}
            >
              <span>{note.title}</span>
              <small>{nodeLabel(nodes, note.ownerNodeId)} · {formatDate(note.date)}</small>
              {note.tags && <small>{note.tags}</small>}
            </button>
          ))}
          {!notes.length && <EmptyState title={t("notes.emptyTitle")} text={t("notes.emptyText")} actionLabel={readOnly ? undefined : t("notes.newNote")} onAction={newNote} />}
        </div>
      </Card>

      <Card className="stack markdown-editor">
        <div className="row-between">
          <h2>{t("notes.markdownEditor")}</h2>
          <Badge>{formatDate(draft.date)}</Badge>
        </div>
        <div className="editor-fields">
          <Input disabled={readOnly} value={draft.title} placeholder={t("notes.meetingTitle")} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
          <Input disabled={readOnly} type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} />
        </div>
        <Input disabled={readOnly} value={draft.tags} placeholder={t("notes.tagsPlaceholder")} onChange={(event) => setDraft({ ...draft, tags: event.target.value })} />
        <Textarea disabled={readOnly} className="markdown-source" value={draft.content} onChange={(event) => setDraft({ ...draft, content: event.target.value })} />
        {!readOnly && (
          <div className="row-between">
            <Button type="button" variant="secondary" disabled={!activeNote} onClick={() => activeNote && confirmAction(t("notes.deleteConfirm"), () => onDelete(activeNote.id))}>
              <Trash2 size={15} /> {t("common.delete")}
            </Button>
            <Button type="button" onClick={saveNote}>
              <Save size={15} /> {t("notes.saveNote")}
            </Button>
          </div>
        )}
      </Card>

      <Card className="stack markdown-preview-card">
        <h2>{t("notes.preview")}</h2>
        <div className="markdown-preview" dangerouslySetInnerHTML={{ __html: renderMarkdown(draft.content) }} />
      </Card>
    </div>
  );
}

function StatsView({ view, period, nodes, showOwners }: { view: WorkView | null; period: Period; nodes: TeamNode[]; showOwners: boolean }) {
  const { t } = useTranslation();
  const tasks = view?.tasks ?? [];
  const notes = view?.notes ?? [];
  const completedTasks = tasks.filter((task) => task.status === "complete");
  const openTasks = tasks.filter((task) => task.status === "open");
  const taskItems = (items: Task[]) => items.map((task) => ({
    id: task.id,
    date: task.completedAt ?? task.dueDate ?? task.createdAt,
    title: task.title,
    eyebrow: showOwners ? nodeLabel(nodes, task.ownerNodeId) : undefined,
    body: task.details,
  }));
  const noteItems = notes.map((note) => ({
    id: note.id,
    date: note.date,
    title: note.title,
    eyebrow: showOwners ? nodeLabel(nodes, note.ownerNodeId) : undefined,
    body: firstLines(note.content),
  }));
  return (
    <div className="stack">
      <StatsGrid stats={buildStats(tasks, notes)} />
      <Card className="stack summary-panel">
        <div className="row-between">
          <h2>{t("stats.summary", { period: periodLabel(period, t) })}</h2>
          <div className="row">
            <Badge>{tasks.length + notes.length} {t("common.records")}</Badge>
            <Button type="button" size="sm" variant="secondary" onClick={() => exportSummaryMarkdown(tasks, notes, period)}>
              <Download size={14} /> {t("common.export")}
            </Button>
          </div>
        </div>
        <div className="summary-section">
          <h3>{t("stats.completedTasks")}</h3>
          <SummaryList items={taskItems(completedTasks)} />
        </div>
        <div className="summary-section">
          <h3>{t("stats.openTasks")}</h3>
          <SummaryList items={taskItems(openTasks)} />
        </div>
        <div className="summary-section">
          <h3>{t("stats.meetingNotes")}</h3>
          <SummaryList items={noteItems} />
        </div>
      </Card>
      <AchievementsView tasks={tasks} notes={notes} />
    </div>
  );
}

function AchievementsView({ tasks, notes }: { tasks: Task[]; notes: MeetingNote[] }) {
  const { t } = useTranslation();
  const stats = buildStats(tasks, notes);
  const achievements = [
    { id: "completed", title: t("achievements.executionTitle"), value: stats.completedTasks, target: 5, text: t("achievements.executionText"), sources: tasks.filter((task) => task.status === "complete").map((task) => task.title) },
    { id: "notes", title: t("achievements.memoryTitle"), value: stats.notes, target: 3, text: t("achievements.memoryText"), sources: notes.map((note) => note.title) },
    { id: "archive", title: t("achievements.archiveTitle"), value: tasks.length + notes.length, target: 10, text: t("achievements.archiveText"), sources: [...tasks.map((task) => task.title), ...notes.map((note) => note.title)] },
  ];
  return (
    <div className="grid three-col">
      {achievements.map((achievement) => {
        const unlocked = achievement.value >= achievement.target;
        return (
          <div className={`badge-card ${unlocked ? "unlocked" : ""}`} key={achievement.id}>
            <div className="row-between">
              <CheckCircle2 className="achievement-icon" />
              <Badge>{achievement.value} / {achievement.target}</Badge>
            </div>
            <h2>{achievement.title}</h2>
            <p className="muted">{achievement.text}</p>
            <details className="achievement-detail">
              <summary>{t("achievements.sources")}</summary>
              <ul>
                {achievement.sources.slice(0, 6).map((source) => <li key={source}>{source}</li>)}
                {!achievement.sources.length && <li>{t("achievements.noSources")}</li>}
              </ul>
            </details>
            <div className="progress-track"><span style={{ width: `${Math.min(100, (achievement.value / achievement.target) * 100)}%` }} /></div>
          </div>
        );
      })}
    </div>
  );
}

function SettingsView({
  user,
  nodes,
  teamView,
  onUpdateProfile,
  onUpdatePassword,
  onCreate,
  onUpdate,
  onDelete,
  onExport,
  onImport,
  onReset,
}: {
  user: User;
  nodes: TeamNode[];
  teamView: WorkView | null;
  onUpdateProfile: (payload: { name: string; email: string; role: string }) => Promise<void>;
  onUpdatePassword: (payload: { currentPassword: string; newPassword: string }) => Promise<void>;
  onCreate: (payload: { name: string; title?: string; parentId?: string }) => Promise<void>;
  onUpdate: (id: string, payload: { name?: string; title?: string | null; parentId?: string | null }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onExport: () => Promise<void>;
  onImport: (file: File | undefined) => Promise<void>;
  onReset: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<SettingsTab>("account");
  const [draft, setDraft] = useState({ name: "", title: "", parentId: "root" });
  const [editingId, setEditingId] = useState("");
  const editingNode = nodes.find((node) => node.id === editingId);
  const tabs: Array<{ key: SettingsTab; label: string; icon: React.ComponentType<{ size?: number }> }> = [
    { key: "account", label: t("settings.account"), icon: UserRound },
    { key: "security", label: t("settings.password"), icon: KeyRound },
    ...(user.canManageSettings ? [{ key: "team" as SettingsTab, label: t("settings.teamTree"), icon: GitFork }] : []),
  ];

  useEffect(() => {
    if (activeTab === "team" && !user.canManageSettings) setActiveTab("account");
  }, [activeTab, user.canManageSettings]);

  const save = async () => {
    const name = draft.name.trim();
    if (!name) return;
    const payload = { name, title: draft.title.trim() || undefined, parentId: draft.parentId === "root" ? undefined : draft.parentId };
    if (editingNode) {
      await onUpdate(editingNode.id, { ...payload, parentId: payload.parentId ?? null });
      setEditingId("");
    } else {
      await onCreate(payload);
    }
    setDraft({ name: "", title: "", parentId: "root" });
  };

  return (
    <div className="settings-layout">
      <nav className="settings-tabs" aria-label={t("settings.sections")}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button className={`settings-tab ${activeTab === tab.key ? "active" : ""}`} type="button" key={tab.key} onClick={() => setActiveTab(tab.key)}>
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="settings-content">
        {activeTab === "account" && <AccountSettingsPanel user={user} onSubmit={onUpdateProfile} />}
        {activeTab === "security" && <PasswordSettingsPanel onSubmit={onUpdatePassword} />}
        {activeTab === "team" && user.canManageSettings && (
          <div className="grid team-grid">
            <Card className="stack">
              <div className="row-between">
                <h2>{t("settings.teamTree")}</h2>
                <Badge>{t("settings.nodes", { count: nodes.length })}</Badge>
              </div>
              <div className="team-tree">
                {buildTreeRows(nodes).map(({ node, depth }) => (
                  <button
                    className={`team-node ${node.id === editingId ? "active" : ""}`}
                    key={node.id}
                    style={{ paddingLeft: 10 + depth * 18 }}
                    onClick={() => {
                      setEditingId(node.id);
                      setDraft({ name: node.name, title: node.title ?? "", parentId: node.parentId ?? "root" });
                    }}
                  >
                    <span>{node.name}</span>
                    <small>{node.title || t("common.untitledRole")}</small>
                  </button>
                ))}
              </div>
            </Card>
            <Card className="stack">
              <div className="row-between">
                <h2>{editingNode ? t("settings.editNode") : t("settings.addNode")}</h2>
                {editingNode && <Badge>{editingNode.name}</Badge>}
              </div>
              <Input value={draft.name} placeholder={t("settings.name")} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
              <Input value={draft.title} placeholder={t("settings.rolePlaceholder")} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
              <Select value={draft.parentId} onValueChange={(value) => setDraft({ ...draft, parentId: value })}>
                <SelectTrigger><SelectValue placeholder={t("settings.parentNode")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="root">{t("settings.topLevel")}</SelectItem>
                  {nodes.filter((node) => node.id !== editingId).map((node) => (
                    <SelectItem value={node.id} key={node.id}>{nodePath(nodes, node)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="row-between">
                <Button type="button" variant="secondary" onClick={() => { setEditingId(""); setDraft({ name: "", title: "", parentId: "root" }); }}>{t("common.clear")}</Button>
                <Button type="button" disabled={!draft.name.trim()} onClick={save}>{editingNode ? <Save size={15} /> : <Plus size={15} />} {editingNode ? t("common.save") : t("common.add")}</Button>
              </div>
              {editingNode && (
                <Button type="button" variant="ghost" onClick={() => confirmAction(t("settings.deleteNodeConfirm"), () => onDelete(editingNode.id))}>
                  <Trash2 size={15} /> {t("settings.deleteNode")}
                </Button>
              )}
            </Card>
            <Card className="stack">
              <h2>{t("settings.workspaceData")}</h2>
              <p className="muted">{t("settings.workspaceDataHelp")}</p>
              <div className="row tool-row">
                <Button type="button" variant="secondary" onClick={onExport}><Download size={15} /> {t("common.export")}</Button>
                <label className="upload-button tool-upload">
                  <Upload size={15} /> {t("common.import")}
                  <Input type="file" accept="application/json,.json" onChange={(event) => onImport(event.target.files?.[0])} />
                </label>
                <Button type="button" variant="ghost" onClick={() => confirmAction(t("settings.resetConfirm"), onReset)}>
                  <Trash2 size={15} /> {t("common.reset")}
                </Button>
              </div>
              <InlineStats stats={teamView ? buildStats(teamView.tasks, teamView.notes) : buildStats([], [])} />
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

function AccountSettingsPanel({ user, onSubmit }: { user: User; onSubmit: (payload: { name: string; email: string; role: string }) => Promise<void> }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState({ name: user.teamNode?.name ?? "", email: user.email, role: user.role ?? "" });

  useEffect(() => {
    setDraft({ name: user.teamNode?.name ?? "", email: user.email, role: user.role ?? "" });
  }, [user.email, user.role, user.teamNode?.name]);

  return (
    <Card className="stack settings-panel">
      <div className="panel-heading">
        <div>
          <h2>{t("settings.account")}</h2>
          <p className="muted">{t("settings.accountHelp")}</p>
        </div>
        <Badge>{user.isSuperuser ? t("common.superuser") : t("common.user")}</Badge>
      </div>
      <div className="settings-form">
        <label className="field">
          <span>{t("settings.name")}</span>
          <Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
        </label>
        <label className="field">
          <span>{t("settings.email")}</span>
          <Input type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} />
        </label>
        <label className="field">
          <span>{t("settings.role")}</span>
          <Input value={draft.role} placeholder={t("settings.rolePlaceholder")} onChange={(event) => setDraft({ ...draft, role: event.target.value })} />
        </label>
        <div className="settings-meta">
          <span>{t("settings.treeNode")}</span>
          <strong>{user.teamNode?.title || t("common.noTitle")}</strong>
        </div>
        <div className="settings-meta">
          <span>{t("language.label")}</span>
          <LanguageSelect />
        </div>
      </div>
      <div className="row-between">
        <span className="muted">{t("settings.roleHelp")}</span>
        <Button type="button" disabled={!draft.name.trim() || !draft.email.trim()} onClick={() => onSubmit({ name: draft.name, email: draft.email, role: draft.role })}>
          <Save size={15} /> {t("settings.saveAccount")}
        </Button>
      </div>
    </Card>
  );
}

function PasswordSettingsPanel({ onSubmit }: { onSubmit: (payload: { currentPassword: string; newPassword: string }) => Promise<void> }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const mismatch = draft.newPassword && draft.confirmPassword && draft.newPassword !== draft.confirmPassword;
  const canSave = draft.currentPassword.length > 0 && draft.newPassword.length >= 8 && draft.newPassword === draft.confirmPassword;

  const save = async () => {
    if (!canSave) return;
    await onSubmit({ currentPassword: draft.currentPassword, newPassword: draft.newPassword });
    setDraft({ currentPassword: "", newPassword: "", confirmPassword: "" });
  };

  return (
    <Card className="stack settings-panel">
      <div className="panel-heading">
        <div>
          <h2>{t("settings.password")}</h2>
          <p className="muted">{t("settings.passwordHelp")}</p>
        </div>
        <Badge>{t("common.private")}</Badge>
      </div>
      <div className="settings-form">
        <label className="field">
          <span>{t("settings.currentPassword")}</span>
          <Input type="password" value={draft.currentPassword} onChange={(event) => setDraft({ ...draft, currentPassword: event.target.value })} />
        </label>
        <label className="field">
          <span>{t("settings.newPassword")}</span>
          <Input type="password" value={draft.newPassword} onChange={(event) => setDraft({ ...draft, newPassword: event.target.value })} />
        </label>
        <label className="field">
          <span>{t("settings.confirmPassword")}</span>
          <Input type="password" value={draft.confirmPassword} onChange={(event) => setDraft({ ...draft, confirmPassword: event.target.value })} />
        </label>
      </div>
      <div className="row-between">
        <span className={mismatch ? "form-inline-error" : "muted"}>{mismatch ? t("settings.passwordMismatch") : t("settings.passwordNextLogin")}</span>
        <Button type="button" disabled={!canSave} onClick={save}>
          <Save size={15} /> {t("settings.updatePassword")}
        </Button>
      </div>
    </Card>
  );
}

function InlineStats({ stats }: { stats: ReturnType<typeof buildStats> }) {
  const { t } = useTranslation();
  return (
    <div className="inline-stats">
      <div><span>{stats.tasks}</span><small>{t("settings.tasks")}</small></div>
      <div><span>{stats.notes}</span><small>{t("common.notes")}</small></div>
      <div><span>{stats.completionRate}%</span><small>{t("settings.completion")}</small></div>
    </div>
  );
}

function StatsGrid({ stats }: { stats: ReturnType<typeof buildStats> }) {
  const { t } = useTranslation();
  return (
    <div className="grid three-col">
      <Card className="metric-card"><h2>{t("stats.totalTasks")}</h2><div className="metric-value">{stats.tasks}</div><p className="muted">{t("stats.completedCount", { count: stats.completedTasks })}</p></Card>
      <Card className="metric-card"><h2>{t("stats.notesMetric")}</h2><div className="metric-value">{stats.notes}</div><p className="muted">{t("stats.noteWords", { count: stats.noteWords })}</p></Card>
      <Card className="metric-card"><h2>{t("stats.completion")}</h2><div className="metric-value">{stats.completionRate}%</div><p className="muted">{t("stats.selectedPeriod")}</p></Card>
    </div>
  );
}

function PrioritySelect({ value, onChange }: { value: TaskPriority; onChange: (value: TaskPriority) => void }) {
  const { t } = useTranslation();
  return (
    <Select value={value} onValueChange={(priority) => onChange(priority as TaskPriority)}>
      <SelectTrigger><SelectValue placeholder={t("tasks.priority")} /></SelectTrigger>
      <SelectContent>
        {(["low", "normal", "high", "urgent"] as TaskPriority[]).map((priority) => (
          <SelectItem value={priority} key={priority}>{priorityLabel(priority, t)}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function PeriodControl({ value, onChange }: { value: Period; onChange: (value: Period) => void }) {
  const { t } = useTranslation();
  return (
    <ToggleGroup type="single" value={value} onValueChange={(next) => next && onChange(next as Period)} aria-label={t("stats.summary", { period: "" })}>
      <ToggleGroupItem value="daily">{t("period.daily")}</ToggleGroupItem>
      <ToggleGroupItem value="weekly">{t("period.weekly")}</ToggleGroupItem>
      <ToggleGroupItem value="monthly">{t("period.monthly")}</ToggleGroupItem>
    </ToggleGroup>
  );
}

function SummaryList({ items }: { items: Array<{ id: string; date: string; title: string; eyebrow?: string; body?: string }> }) {
  const { t } = useTranslation();
  if (!items.length) return <EmptyState title={t("empty.noRecords")} text={t("empty.noRecordsText")} />;
  return (
    <div className="summary-list">
      {items.map((item) => (
        <div className="summary-item" key={item.id}>
          <time>{formatDate(item.date)}</time>
          <div>
            {item.eyebrow && <small>{item.eyebrow}</small>}
            <strong>{item.title}</strong>
            {item.body && <p className="muted">{item.body}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ title, text, actionLabel, onAction }: { title: string; text: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <div className="empty-state">
      <ListChecks size={18} />
      <strong>{title}</strong>
      <span>{text}</span>
      {actionLabel && onAction && <Button type="button" size="sm" variant="secondary" onClick={onAction}><Plus size={14} /> {actionLabel}</Button>}
    </div>
  );
}

function ViewModeSwitch({ value, onChange }: { value: ViewMode; onChange: (value: ViewMode) => void }) {
  const { t } = useTranslation();
  return (
    <div className="segmented-switch view-mode-switch" role="group" aria-label={t("mode.label")}>
      <button type="button" className={value === "personal" ? "active" : ""} aria-pressed={value === "personal"} onClick={() => onChange("personal")}>
        {t("mode.personal")}
      </button>
      <button type="button" className={value === "team" ? "active" : ""} aria-pressed={value === "team"} onClick={() => onChange("team")}>
        {t("mode.team")}
      </button>
    </div>
  );
}

function LanguageSelect({ compact = false }: { compact?: boolean }) {
  const { t, i18n: i18nInstance } = useTranslation();
  const language = i18nInstance.resolvedLanguage?.startsWith("zh") ? "zh" : "en";
  const nextLanguage = language === "zh" ? "en" : "zh";
  return (
    <button
      type="button"
      className={compact ? "language-switch compact" : "language-switch"}
      aria-label={t("language.label")}
      aria-pressed={language === "zh"}
      onClick={() => void i18nInstance.changeLanguage(nextLanguage)}
    >
      <span className={language === "en" ? "active" : ""}>EN</span>
      <span className={language === "zh" ? "active" : ""}>中</span>
    </button>
  );
}

function useMiraApi() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) ?? "");
  const [user, setUser] = useState<User | null>(null);
  const [teamNodes, setTeamNodes] = useState<TeamNode[]>([]);
  const [workView, setWorkView] = useState<WorkView | null>(null);
  const [teamView, setTeamView] = useState<WorkView | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);

  const request = useCallback(async <T,>(path: string, options: RequestInit = {}) => {
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

  const refreshUser = useCallback(async () => {
    const current = await request<User>("/auth/me");
    setUser(current);
    return current;
  }, [request]);

  const loadWorkspace = useCallback(async (period: Period) => {
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
  }, [refreshUser, request, user]);

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
        const created = await request<TeamNode>("/team/nodes", { method: "POST", body: JSON.stringify({ name: node.name, title: node.title || undefined, parentId: node.parentId ? idMap.get(node.parentId) : undefined }) });
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
      const updated = await request<User>("/me/profile", { method: "PATCH", body: JSON.stringify(payload) });
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
    updatePassword: (payload: { currentPassword: string; newPassword: string }) => mutate(() => request("/me/password", { method: "PATCH", body: JSON.stringify(payload) })),
    createTask: (payload: { title: string; details: string; priority: TaskPriority; dueDate?: string }) => mutate(() => request("/me/tasks", { method: "POST", body: JSON.stringify(payload) })),
    updateTask: (id: string, payload: { title?: string; details?: string; status?: TaskStatus; priority?: TaskPriority; dueDate?: string | null }) => mutate(() => request(`/me/tasks/${id}`, { method: "PATCH", body: JSON.stringify(payload) })),
    deleteTask: (id: string) => mutate(() => request(`/me/tasks/${id}`, { method: "DELETE" })),
    createNote: async (payload: { title: string; date: string; content: string; tags: string }) => {
      let created: MeetingNote | null = null;
      await mutate(async () => { created = await request<MeetingNote>("/me/notes", { method: "POST", body: JSON.stringify(payload) }); });
      return created!;
    },
    updateNote: (id: string, payload: { title?: string; date?: string; content?: string; tags?: string }) => mutate(() => request(`/me/notes/${id}`, { method: "PATCH", body: JSON.stringify(payload) })),
    deleteNote: (id: string) => mutate(() => request(`/me/notes/${id}`, { method: "DELETE" })),
    createTeamNode: (payload: { name: string; title?: string; parentId?: string }) => mutate(() => request("/team/nodes", { method: "POST", body: JSON.stringify(payload) })),
    updateTeamNode: (id: string, payload: { name?: string; title?: string | null; parentId?: string | null }) => mutate(() => request(`/team/nodes/${id}`, { method: "PATCH", body: JSON.stringify(payload) })),
    deleteTeamNode: (id: string) => mutate(() => request(`/team/nodes/${id}`, { method: "DELETE" })),
    exportWorkspace,
    importWorkspace,
    resetWorkspace,
  };
}

function resolveRouteFromHash(): Route {
  const hash = window.location.hash.replace(/^#\/?/, "") as Route;
  return nav.some((item) => item.key === hash) ? hash : "dashboard";
}

function createBlankNote(): MeetingNote {
  return { id: "", ownerNodeId: "", title: "", date: today(), tags: "", updatedAt: today(), content: i18n.t("notes.blank") };
}

function buildStats(tasks: Task[], notes: MeetingNote[]) {
  const completedTasks = tasks.filter((task) => task.status === "complete").length;
  const noteWords = notes.reduce((total, note) => total + wordCount(note.content), 0);
  return { tasks: tasks.length, completedTasks, notes: notes.length, noteWords, completionRate: tasks.length ? Math.round((completedTasks / tasks.length) * 100) : 0 };
}

function buildTreeRows(nodes: TeamNode[]) {
  const byParent = new Map<string, TeamNode[]>();
  for (const node of nodes) byParent.set(node.parentId ?? "root", [...(byParent.get(node.parentId ?? "root") ?? []), node]);
  for (const siblings of byParent.values()) siblings.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  const rows: Array<{ node: TeamNode; depth: number }> = [];
  const visit = (parentId: string, depth: number) => {
    for (const node of byParent.get(parentId) ?? []) {
      rows.push({ node, depth });
      visit(node.id, depth + 1);
    }
  };
  visit("root", 0);
  return rows;
}

function sortNodesForImport(nodes: TeamNode[]) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const depthOf = (node: TeamNode): number => node.parentId && byId.get(node.parentId) ? depthOf(byId.get(node.parentId)!) + 1 : 0;
  return [...nodes].sort((a, b) => depthOf(a) - depthOf(b) || a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

function sortNodesForDelete(nodes: TeamNode[]) {
  return sortNodesForImport(nodes).reverse();
}

function nodePath(nodes: TeamNode[], node: TeamNode) {
  const byId = new Map(nodes.map((item) => [item.id, item]));
  const parts = [node.name];
  let parentId = node.parentId;
  while (parentId) {
    const parent = byId.get(parentId);
    if (!parent) break;
    parts.unshift(parent.name);
    parentId = parent.parentId;
  }
  return parts.join(" / ");
}

function nodeLabel(nodes: TeamNode[], id: string) {
  return nodes.find((node) => node.id === id)?.name ?? i18n.t("common.unknown");
}

function formatDate(dateValue: string) {
  return new Intl.DateTimeFormat(i18n.language === "zh" ? "zh-CN" : undefined, { month: "short", day: "numeric" }).format(new Date(dateValue));
}

function toDateInput(dateValue: string) {
  return new Date(dateValue).toISOString().slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function periodLabel(period: Period, t: TFunction) {
  return t(`period.${period}`);
}

function priorityLabel(priority: TaskPriority, t: TFunction) {
  return t(`priority.${priority}`);
}

function wordCount(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function firstLines(content: string) {
  return content.split("\n").map((line) => line.replace(/^#+\s*/, "").replace(/^[-*]\s*/, "").trim()).filter(Boolean).slice(0, 3).join(" · ");
}

function renderMarkdown(markdown: string) {
  const escaped = markdown.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return escaped.split("\n").map((line) => {
    if (line.startsWith("### ")) return `<h3>${renderInlineMarkdown(line.slice(4))}</h3>`;
    if (line.startsWith("## ")) return `<h2>${renderInlineMarkdown(line.slice(3))}</h2>`;
    if (line.startsWith("# ")) return `<h1>${renderInlineMarkdown(line.slice(2))}</h1>`;
    if (line.startsWith("- ")) return `<li>${renderInlineMarkdown(line.slice(2))}</li>`;
    if (!line.trim()) return "";
    return `<p>${renderInlineMarkdown(line)}</p>`;
  }).join("");
}

function renderInlineMarkdown(value: string) {
  return value
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|mailto:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
}

function exportSummaryMarkdown(tasks: Task[], notes: MeetingNote[], period: Period) {
  const completed = tasks.filter((task) => task.status === "complete");
  const open = tasks.filter((task) => task.status === "open");
  const lines = [
    `# ${i18n.t("export.title", { period: periodLabel(period, i18n.t) })}`,
    "",
    `## ${i18n.t("export.completedTasks")}`,
    ...(completed.length ? completed.map((task) => `- ${task.title}${task.details ? `: ${task.details}` : ""}`) : [`- ${i18n.t("export.noCompletedTasks")}`]),
    "",
    `## ${i18n.t("export.openTasks")}`,
    ...(open.length ? open.map((task) => `- ${task.title}${task.dueDate ? ` (${i18n.t("tasks.due", { date: formatDate(task.dueDate) })})` : ""}`) : [`- ${i18n.t("export.noOpenTasks")}`]),
    "",
    `## ${i18n.t("export.meetingNotes")}`,
    ...(notes.length ? notes.map((note) => `- ${note.title}${note.tags ? ` [${note.tags}]` : ""}: ${firstLines(note.content)}`) : [`- ${i18n.t("export.noMeetingNotes")}`]),
    "",
  ];
  downloadBlob(lines.join("\n"), `mira-summary-${period}-${today()}.md`, "text/markdown");
}

function parseWorkspaceExport(text: string): WorkspaceExport {
  try {
    const parsed = JSON.parse(text);
    if (!parsed || !Array.isArray(parsed.teamNodes) || !Array.isArray(parsed.tasks) || !Array.isArray(parsed.notes)) throw new Error();
    return parsed as WorkspaceExport;
  } catch {
    throw new Error(i18n.t("errors.invalidWorkspace"));
  }
}

function downloadJson(payload: WorkspaceExport) {
  downloadBlob(JSON.stringify(payload, null, 2), `mira-workspace-${today()}.json`, "application/json");
}

function downloadBlob(value: string, filename: string, type: string) {
  const blob = new Blob([value], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function confirmAction(message: string, action: () => void | Promise<void>) {
  if (window.confirm(message)) void action();
}

function useKeyboardShortcuts({ onSave, onNew, enabled = true }: { onSave: () => void | Promise<void>; onNew: () => void; enabled?: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        void onSave();
      }
      if (key === "n") {
        event.preventDefault();
        onNew();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onSave, onNew, enabled]);
}

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : i18n.t("errors.generic");
}

createRoot(document.getElementById("root")!).render(<App />);
