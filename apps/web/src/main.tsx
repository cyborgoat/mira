import {
  BarChart3,
  CheckCircle2,
  Download,
  Edit3,
  FileText,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Plus,
  Save,
  Search,
  Settings,
  Trash2,
  Upload,
} from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import "./styles.css";

type Route = "dashboard" | "tasks" | "notes" | "stats" | "settings";
type ViewMode = "personal" | "team";
type TaskStatus = "open" | "complete";
type TaskPriority = "low" | "normal" | "high" | "urgent";
type Period = "daily" | "weekly" | "monthly";

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

const nav: Array<{ key: Route; label: string; icon: React.ComponentType<{ size?: number }> }> = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "tasks", label: "Tasks", icon: ListChecks },
  { key: "notes", label: "Notes", icon: FileText },
  { key: "stats", label: "Stats", icon: BarChart3 },
  { key: "settings", label: "Settings", icon: Settings },
];

function App() {
  const [route, setRoute] = useState<Route>(resolveRouteFromHash());
  const [period, setPeriod] = useState<Period>("weekly");
  const [viewMode, setViewMode] = useState<ViewMode>("personal");
  const api = useMiraApi();
  const activeView = viewMode === "team" && api.teamView ? api.teamView : api.workView;
  const visibleTasks = activeView?.tasks ?? [];
  const visibleNotes = activeView?.notes ?? [];
  const currentNav = nav.find((item) => item.key === route) ?? nav[0];
  const visibleNav = nav.filter((item) => item.key !== "settings" || api.user?.canManageSettings);

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

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">M</span>
          <div className="brand-stack">
            <span className="brand-name">Mira</span>
            <span className="brand-slogan">Work workspace</span>
          </div>
        </div>
        <div className="row topbar-controls">
          {api.user.canViewTeam && (
            <ToggleGroup type="single" value={viewMode} onValueChange={(next) => next && setViewMode(next as ViewMode)} aria-label="View mode">
              <ToggleGroupItem value="personal">Personal</ToggleGroupItem>
              <ToggleGroupItem value="team">Team view</ToggleGroupItem>
            </ToggleGroup>
          )}
          <Badge>{api.user.teamNode?.name ?? api.user.email}</Badge>
          <Button type="button" variant="ghost" size="sm" onClick={api.logout}>
            <LogOut size={15} /> Sign out
          </Button>
        </div>
      </header>

      <aside className="sidebar">
        <div className="stack">
          {visibleNav.map((item) => {
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
                {item.label}
              </Button>
            );
          })}
        </div>
      </aside>

      <main className="main">
        {api.error && <div className="form-error page-error">{api.error}</div>}
        <div className="page-header">
          <div>
            <div className="eyebrow">{viewMode === "team" ? "Read-only subordinate view" : api.user.role || "Personal workspace"}</div>
            <h1>{currentNav.label}</h1>
            <p className="muted">{viewMode === "team" ? "Subordinate stats and details for your team tree." : "Your own work content and activity stats."}</p>
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
        {route === "stats" && <StatsView view={activeView} period={period} />}
        {route === "settings" && api.user.canManageSettings && (
          <SettingsView
            nodes={api.teamNodes}
            teamView={api.teamView}
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
          Mira
        </div>
        <div>
          <h1>Sign in</h1>
          <p className="muted">Mock users: manager@mira.local, alex@mira.local, sam@mira.local, admin@mira.local.</p>
        </div>
        {error && <div className="form-error">{error}</div>}
        <form className="stack" onSubmit={submit}>
          <label className="field">
            <span>Email</span>
            <Input value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label className="field">
            <span>Password</span>
            <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <Button type="submit" disabled={loading}>
            {loading ? "Signing in" : "Sign in"}
          </Button>
        </form>
      </Card>
    </div>
  );
}

function DashboardView({ view, mode, nodes }: { view: WorkView | null; mode: ViewMode; nodes: TeamNode[] }) {
  const tasks = view?.tasks ?? [];
  const notes = view?.notes ?? [];
  const dueTasks = tasks.filter((task) => task.status === "open" && task.dueDate).slice(0, 5);
  return (
    <div className="stack">
      <StatsGrid stats={buildStats(tasks, notes)} />
      <div className="grid two-col work-grid">
        <Card className="stack">
          <div className="row-between">
            <h2>{mode === "team" ? "Team tasks" : "My tasks"}</h2>
            <Badge>{tasks.length} records</Badge>
          </div>
          <SummaryList
            items={tasks.slice(0, 8).map((task) => ({
              id: task.id,
              date: task.completedAt ?? task.dueDate ?? task.createdAt,
              title: task.title,
              body: `${nodeLabel(nodes, task.ownerNodeId)} · ${priorityLabel(task.priority)} · ${task.status}`,
            }))}
          />
        </Card>
        <Card className="stack">
          <div className="row-between">
            <h2>{mode === "team" ? "Team notes" : "My notes"}</h2>
            <Badge>{notes.length} notes</Badge>
          </div>
          <SummaryList items={notes.slice(0, 8).map((note) => ({ id: note.id, date: note.date, title: note.title, body: note.tags || firstLines(note.content) }))} />
        </Card>
      </div>
      <Card className="stack">
        <h2>Due soon</h2>
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
            <h2>{editingTask ? "Edit task" : "New task"}</h2>
            {editingTask && <Badge>{formatDate(editingTask.createdAt)}</Badge>}
          </div>
          <Input value={draft.title} placeholder="Task title" onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
          <div className="editor-fields">
            <PrioritySelect value={draft.priority} onChange={(priority) => setDraft({ ...draft, priority })} />
            <Input type="date" value={draft.dueDate} onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })} />
          </div>
          <Textarea className="compact" value={draft.details} placeholder="Details, blockers, links, or acceptance notes" onChange={(event) => setDraft({ ...draft, details: event.target.value })} />
          <div className="row-between">
            <Button variant="secondary" type="button" onClick={newTask}>
              Clear
            </Button>
            <Button type="button" disabled={!draft.title.trim()} onClick={saveTask}>
              {editingTask ? <Save size={16} /> : <Plus size={16} />} {editingTask ? "Save task" : "Add task"}
            </Button>
          </div>
        </Card>
      )}

      <Card className="stack">
        <div className="row-between">
          <h2>{readOnly ? "Team task details" : "Task list"}</h2>
          <Badge>{tasks.filter((task) => task.status === "complete").length} complete</Badge>
        </div>
        <div className="search-field">
          <Search size={16} />
          <Input value={query} placeholder="Search tasks" onChange={(event) => setQuery(event.target.value)} />
        </div>
        <div className="filter-row">
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as "all" | TaskStatus)}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="complete">Complete</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={(value) => setPriorityFilter(value as "all" | TaskPriority)}>
            <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priority</SelectItem>
              {(["low", "normal", "high", "urgent"] as TaskPriority[]).map((priority) => (
                <SelectItem value={priority} key={priority}>{priorityLabel(priority)}</SelectItem>
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
                  <Badge>{priorityLabel(task.priority)}</Badge>
                  <Badge>{nodeLabel(nodes, task.ownerNodeId)}</Badge>
                </div>
              </div>
              {task.details && <p className="muted item-body">{task.details}</p>}
              <div className="item-actions">
                <span className="muted">{task.dueDate ? `Due ${formatDate(task.dueDate)}` : formatDate(task.completedAt ?? task.createdAt)}</span>
                {!readOnly && (
                  <>
                    <Button type="button" variant="ghost" size="sm" onClick={() => startEdit(task)}>
                      <Edit3 size={14} /> Edit
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => confirmAction("Delete this task?", () => onDelete(task.id))}>
                      <Trash2 size={14} /> Delete
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
          {!visibleTasks.length && <EmptyState title="No tasks found" text="Add a task or adjust the search." actionLabel={readOnly ? undefined : "New task"} onAction={newTask} />}
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
    const title = draft.title.trim() || "Untitled meeting";
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
      setUploadError("Only .md, .markdown, and .txt files are supported.");
      return;
    }
    try {
      const content = await file.text();
      const title = file.name.replace(/\.(md|markdown|txt)$/i, "");
      const created = await onCreate({ title, date: today(), content, tags: "" });
      setActiveId(created.id);
      setIsCreating(false);
    } catch {
      setUploadError("This file could not be read.");
    }
  };

  return (
    <div className="grid notes-grid">
      <Card className="stack note-list">
        <div className="row-between">
          <h2>{readOnly ? "Team notes" : "Notes"}</h2>
          {!readOnly && (
            <Button type="button" size="sm" onClick={newNote}>
              <Plus size={15} /> New
            </Button>
          )}
        </div>
        {!readOnly && (
          <label className="upload-button">
            <Upload size={15} />
            Upload markdown
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
          {!notes.length && <EmptyState title="No notes yet" text="Create a note or upload a markdown file." actionLabel={readOnly ? undefined : "New note"} onAction={newNote} />}
        </div>
      </Card>

      <Card className="stack markdown-editor">
        <div className="row-between">
          <h2>Markdown editor</h2>
          <Badge>{formatDate(draft.date)}</Badge>
        </div>
        <div className="editor-fields">
          <Input disabled={readOnly} value={draft.title} placeholder="Meeting title" onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
          <Input disabled={readOnly} type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} />
        </div>
        <Input disabled={readOnly} value={draft.tags} placeholder="Tags, comma separated" onChange={(event) => setDraft({ ...draft, tags: event.target.value })} />
        <Textarea disabled={readOnly} className="markdown-source" value={draft.content} onChange={(event) => setDraft({ ...draft, content: event.target.value })} />
        {!readOnly && (
          <div className="row-between">
            <Button type="button" variant="secondary" disabled={!activeNote} onClick={() => activeNote && confirmAction("Delete this note?", () => onDelete(activeNote.id))}>
              <Trash2 size={15} /> Delete
            </Button>
            <Button type="button" onClick={saveNote}>
              <Save size={15} /> Save note
            </Button>
          </div>
        )}
      </Card>

      <Card className="stack markdown-preview-card">
        <h2>Preview</h2>
        <div className="markdown-preview" dangerouslySetInnerHTML={{ __html: renderMarkdown(draft.content) }} />
      </Card>
    </div>
  );
}

function StatsView({ view, period }: { view: WorkView | null; period: Period }) {
  const tasks = view?.tasks ?? [];
  const notes = view?.notes ?? [];
  const completedTasks = tasks.filter((task) => task.status === "complete");
  const openTasks = tasks.filter((task) => task.status === "open");
  return (
    <div className="stack">
      <StatsGrid stats={buildStats(tasks, notes)} />
      <Card className="stack summary-panel">
        <div className="row-between">
          <h2>{periodLabel(period)} summary</h2>
          <div className="row">
            <Badge>{tasks.length + notes.length} records</Badge>
            <Button type="button" size="sm" variant="secondary" onClick={() => exportSummaryMarkdown(tasks, notes, period)}>
              <Download size={14} /> Export
            </Button>
          </div>
        </div>
        <div className="summary-section">
          <h3>Completed tasks</h3>
          <SummaryList items={completedTasks.map((task) => ({ id: task.id, date: task.completedAt ?? task.createdAt, title: task.title, body: task.details }))} />
        </div>
        <div className="summary-section">
          <h3>Open tasks</h3>
          <SummaryList items={openTasks.map((task) => ({ id: task.id, date: task.dueDate ?? task.createdAt, title: task.title, body: task.details }))} />
        </div>
        <div className="summary-section">
          <h3>Meeting notes</h3>
          <SummaryList items={notes.map((note) => ({ id: note.id, date: note.date, title: note.title, body: firstLines(note.content) }))} />
        </div>
      </Card>
      <AchievementsView tasks={tasks} notes={notes} />
    </div>
  );
}

function AchievementsView({ tasks, notes }: { tasks: Task[]; notes: MeetingNote[] }) {
  const stats = buildStats(tasks, notes);
  const achievements = [
    { id: "completed", title: "Execution streak", value: stats.completedTasks, target: 5, text: "Completed tasks.", sources: tasks.filter((task) => task.status === "complete").map((task) => task.title) },
    { id: "notes", title: "Meeting memory", value: stats.notes, target: 3, text: "Saved meeting notes.", sources: notes.map((note) => note.title) },
    { id: "archive", title: "Historical record", value: tasks.length + notes.length, target: 10, text: "Total task and note records.", sources: [...tasks.map((task) => task.title), ...notes.map((note) => note.title)] },
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
              <summary>Source records</summary>
              <ul>
                {achievement.sources.slice(0, 6).map((source) => <li key={source}>{source}</li>)}
                {!achievement.sources.length && <li>No source records yet</li>}
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
  nodes,
  teamView,
  onCreate,
  onUpdate,
  onDelete,
  onExport,
  onImport,
  onReset,
}: {
  nodes: TeamNode[];
  teamView: WorkView | null;
  onCreate: (payload: { name: string; title?: string; parentId?: string }) => Promise<void>;
  onUpdate: (id: string, payload: { name?: string; title?: string | null; parentId?: string | null }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onExport: () => Promise<void>;
  onImport: (file: File | undefined) => Promise<void>;
  onReset: () => Promise<void>;
}) {
  const [draft, setDraft] = useState({ name: "", title: "", parentId: "root" });
  const [editingId, setEditingId] = useState("");
  const editingNode = nodes.find((node) => node.id === editingId);

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
    <div className="grid team-grid">
      <Card className="stack">
        <div className="row-between">
          <h2>Team tree</h2>
          <Badge>{nodes.length} nodes</Badge>
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
              <small>{node.title || "Untitled role"}</small>
            </button>
          ))}
        </div>
      </Card>
      <Card className="stack">
        <div className="row-between">
          <h2>{editingNode ? "Edit node" : "Add node"}</h2>
          {editingNode && <Badge>{editingNode.name}</Badge>}
        </div>
        <Input value={draft.name} placeholder="Name" onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
        <Input value={draft.title} placeholder="Role or title, any text" onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
        <Select value={draft.parentId} onValueChange={(value) => setDraft({ ...draft, parentId: value })}>
          <SelectTrigger><SelectValue placeholder="Parent node" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="root">Top level</SelectItem>
            {nodes.filter((node) => node.id !== editingId).map((node) => (
              <SelectItem value={node.id} key={node.id}>{nodePath(nodes, node)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="row-between">
          <Button type="button" variant="secondary" onClick={() => { setEditingId(""); setDraft({ name: "", title: "", parentId: "root" }); }}>Clear</Button>
          <Button type="button" disabled={!draft.name.trim()} onClick={save}>{editingNode ? <Save size={15} /> : <Plus size={15} />} {editingNode ? "Save" : "Add"}</Button>
        </div>
        {editingNode && (
          <Button type="button" variant="ghost" onClick={() => confirmAction("Delete this team node?", () => onDelete(editingNode.id))}>
            <Trash2 size={15} /> Delete selected node
          </Button>
        )}
      </Card>
      <Card className="stack">
        <h2>Workspace data</h2>
        <p className="muted">Superuser-only JSON tools for testing and local reset.</p>
        <div className="row tool-row">
          <Button type="button" variant="secondary" onClick={onExport}><Download size={15} /> Export</Button>
          <label className="upload-button tool-upload">
            <Upload size={15} /> Import
            <Input type="file" accept="application/json,.json" onChange={(event) => onImport(event.target.files?.[0])} />
          </label>
          <Button type="button" variant="ghost" onClick={() => confirmAction("Reset the workspace? This deletes all tasks, notes, and team nodes.", onReset)}>
            <Trash2 size={15} /> Reset
          </Button>
        </div>
        <InlineStats stats={teamView ? buildStats(teamView.tasks, teamView.notes) : buildStats([], [])} />
      </Card>
    </div>
  );
}

function InlineStats({ stats }: { stats: ReturnType<typeof buildStats> }) {
  return (
    <div className="inline-stats">
      <div><span>{stats.tasks}</span><small>Tasks</small></div>
      <div><span>{stats.notes}</span><small>Notes</small></div>
      <div><span>{stats.completionRate}%</span><small>Completion</small></div>
    </div>
  );
}

function StatsGrid({ stats }: { stats: ReturnType<typeof buildStats> }) {
  return (
    <div className="grid three-col">
      <Card className="metric-card"><h2>Total tasks</h2><div className="metric-value">{stats.tasks}</div><p className="muted">{stats.completedTasks} completed</p></Card>
      <Card className="metric-card"><h2>Meeting notes</h2><div className="metric-value">{stats.notes}</div><p className="muted">{stats.noteWords} note words</p></Card>
      <Card className="metric-card"><h2>Completion</h2><div className="metric-value">{stats.completionRate}%</div><p className="muted">Selected period</p></Card>
    </div>
  );
}

function PrioritySelect({ value, onChange }: { value: TaskPriority; onChange: (value: TaskPriority) => void }) {
  return (
    <Select value={value} onValueChange={(priority) => onChange(priority as TaskPriority)}>
      <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
      <SelectContent>
        {(["low", "normal", "high", "urgent"] as TaskPriority[]).map((priority) => (
          <SelectItem value={priority} key={priority}>{priorityLabel(priority)}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function PeriodControl({ value, onChange }: { value: Period; onChange: (value: Period) => void }) {
  return (
    <ToggleGroup type="single" value={value} onValueChange={(next) => next && onChange(next as Period)} aria-label="Summary period">
      <ToggleGroupItem value="daily">Daily</ToggleGroupItem>
      <ToggleGroupItem value="weekly">Weekly</ToggleGroupItem>
      <ToggleGroupItem value="monthly">Monthly</ToggleGroupItem>
    </ToggleGroup>
  );
}

function SummaryList({ items }: { items: Array<{ id: string; date: string; title: string; body?: string }> }) {
  if (!items.length) return <EmptyState title="No records" text="Nothing matches this period yet." />;
  return (
    <div className="summary-list">
      {items.map((item) => (
        <div className="summary-item" key={item.id}>
          <time>{formatDate(item.date)}</time>
          <div><strong>{item.title}</strong>{item.body && <p className="muted">{item.body}</p>}</div>
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
      throw new Error(body.message || body.detail || `Request failed: ${response.status}`);
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
      if (!response.ok) throw new Error("Unable to sign in");
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
      setError("Only .json workspace files are supported.");
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
  return { id: "", ownerNodeId: "", title: "", date: today(), tags: "", updatedAt: today(), content: "## Meeting notes\n\n- " };
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
  return nodes.find((node) => node.id === id)?.name ?? "Unknown";
}

function formatDate(dateValue: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(dateValue));
}

function toDateInput(dateValue: string) {
  return new Date(dateValue).toISOString().slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function periodLabel(period: Period) {
  return period.charAt(0).toUpperCase() + period.slice(1);
}

function priorityLabel(priority: TaskPriority) {
  return priority.charAt(0).toUpperCase() + priority.slice(1);
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
    `# ${periodLabel(period)} Mira Summary`,
    "",
    "## Completed tasks",
    ...(completed.length ? completed.map((task) => `- ${task.title}${task.details ? `: ${task.details}` : ""}`) : ["- No completed tasks"]),
    "",
    "## Open tasks",
    ...(open.length ? open.map((task) => `- ${task.title}${task.dueDate ? ` (due ${formatDate(task.dueDate)})` : ""}`) : ["- No open tasks"]),
    "",
    "## Meeting notes",
    ...(notes.length ? notes.map((note) => `- ${note.title}${note.tags ? ` [${note.tags}]` : ""}: ${firstLines(note.content)}`) : ["- No meeting notes"]),
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
    throw new Error("This JSON file is not a Mira workspace export.");
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
  return err instanceof Error ? err.message : "Something went wrong";
}

createRoot(document.getElementById("root")!).render(<App />);
