import {
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Download,
  Edit3,
  FileText,
  GitFork,
  ListChecks,
  LogOut,
  Plus,
  Save,
  Search,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
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

type Route = "team" | "tasks" | "notes" | "summary" | "achievements";
type TaskStatus = "open" | "complete";
type TaskPriority = "low" | "normal" | "high" | "urgent";
type Period = "daily" | "weekly" | "monthly";
type Scope = "self" | "tree";

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
  role: "superuser";
};

type TeamView = {
  selectedNode: TeamNode | null;
  descendantIds: string[];
  tasks: Task[];
  notes: MeetingNote[];
  stats: {
    totalTasks: number;
    completedTasks: number;
    openTasks: number;
    notes: number;
    completionRate: number;
  };
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
  { key: "team", label: "Team", icon: GitFork },
  { key: "tasks", label: "Tasks", icon: ClipboardList },
  { key: "notes", label: "Meeting Notes", icon: FileText },
  { key: "summary", label: "Weekly Summary", icon: CalendarDays },
  { key: "achievements", label: "Achievements", icon: BadgeCheck },
];

function App() {
  const [route, setRoute] = useState<Route>(resolveRouteFromHash());
  const [period, setPeriod] = useState<Period>("weekly");
  const [scope, setScope] = useState<Scope>("tree");
  const api = useMiraApi();
  const selectedNode = api.teamNodes.find((node) => node.id === api.selectedNodeId) ?? null;
  const currentNav = nav.find((item) => item.key === route) ?? nav[0];

  useEffect(() => {
    const handleHashChange = () => setRoute(resolveRouteFromHash());
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    if (api.user) void api.refresh();
  }, [api.user, api.refresh]);

  useEffect(() => {
    if (api.user) void api.loadWork(scope, period);
  }, [api.user, api.selectedNodeId, scope, period, api.revision, api.loadWork]);

  const navigateTo = (nextRoute: Route) => {
    window.location.hash = nextRoute;
    setRoute(nextRoute);
  };

  if (!api.user) {
    return <LoginScreen onLogin={api.login} error={api.error} loading={api.loading} />;
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">M</span>
          <div className="brand-stack">
            <span className="brand-name">Mira</span>
            <span className="brand-slogan">Team workspace</span>
          </div>
        </div>
        <div className="row topbar-controls">
          <NodeSelect nodes={api.teamNodes} value={api.selectedNodeId} onChange={api.setSelectedNodeId} />
          <ScopeControl value={scope} onChange={setScope} />
          <Badge>{api.tasks.length} tasks</Badge>
          <Badge>{api.notes.length} notes</Badge>
          <Button type="button" variant="ghost" size="sm" onClick={api.logout}>
            <LogOut size={15} /> Sign out
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
            <div className="eyebrow">{selectedNode ? nodePath(api.teamNodes, selectedNode) : "Mira team"}</div>
            <h1>{currentNav.label}</h1>
            <p className="muted">API-backed tasks, meeting notes, and team rollups for the selected team node.</p>
          </div>
          {(route === "summary" || route === "achievements") && <PeriodControl value={period} onChange={setPeriod} />}
        </div>

        {!api.teamNodes.length ? (
          <FirstTeamNode onCreate={api.createTeamNode} loading={api.loading} />
        ) : (
          <>
            {route === "team" && (
              <TeamViewPanel
                nodes={api.teamNodes}
                selectedNodeId={api.selectedNodeId}
                teamView={api.teamView}
                onSelect={api.setSelectedNodeId}
                onCreate={api.createTeamNode}
                onUpdate={api.updateTeamNode}
                onDelete={api.deleteTeamNode}
                onExport={api.exportWorkspace}
                onImport={api.importWorkspace}
                onReset={api.resetWorkspace}
              />
            )}
            {route === "tasks" && (
              <TasksView
                tasks={api.tasks}
                nodes={api.teamNodes}
                selectedNodeId={api.selectedNodeId}
                onCreate={api.createTask}
                onUpdate={api.updateTask}
                onDelete={api.deleteTask}
              />
            )}
            {route === "notes" && (
              <NotesView
                notes={api.notes}
                nodes={api.teamNodes}
                selectedNodeId={api.selectedNodeId}
                onCreate={api.createNote}
                onUpdate={api.updateNote}
                onDelete={api.deleteNote}
              />
            )}
            {route === "summary" && <SummaryView tasks={api.teamView?.tasks ?? api.tasks} notes={api.teamView?.notes ?? api.notes} period={period} />}
            {route === "achievements" && (
              <AchievementsView tasks={api.teamView?.tasks ?? api.tasks} notes={api.teamView?.notes ?? api.notes} period={period} />
            )}
          </>
        )}
      </main>
    </div>
  );
}

function LoginScreen({ onLogin, error, loading }: { onLogin: (email: string, password: string) => Promise<void>; error: string; loading: boolean }) {
  const [email, setEmail] = useState("admin@mira.local");
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
          Mira API
        </div>
        <div>
          <h1>Sign in</h1>
          <p className="muted">Use the seeded superuser to manage the team workspace.</p>
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

function TeamViewPanel({
  nodes,
  selectedNodeId,
  teamView,
  onSelect,
  onCreate,
  onUpdate,
  onDelete,
  onExport,
  onImport,
  onReset,
}: {
  nodes: TeamNode[];
  selectedNodeId: string;
  teamView: TeamView | null;
  onSelect: (id: string) => void;
  onCreate: (payload: { name: string; title?: string; parentId?: string }) => Promise<void>;
  onUpdate: (id: string, payload: { name?: string; title?: string | null; parentId?: string | null }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onExport: () => Promise<void>;
  onImport: (file: File | undefined) => Promise<void>;
  onReset: () => Promise<void>;
}) {
  const [draft, setDraft] = useState({ name: "", title: "", parentId: selectedNodeId || "root" });
  const [editingId, setEditingId] = useState("");
  const editingNode = nodes.find((node) => node.id === editingId);

  useEffect(() => {
    setDraft((current) => ({ ...current, parentId: selectedNodeId || "root" }));
  }, [selectedNodeId]);

  const save = async () => {
    const name = draft.name.trim();
    if (!name) return;
    const payload = {
      name,
      title: draft.title.trim() || undefined,
      parentId: draft.parentId === "root" ? undefined : draft.parentId,
    };
    if (editingNode) {
      await onUpdate(editingNode.id, { ...payload, parentId: payload.parentId ?? null });
      setEditingId("");
    } else {
      await onCreate(payload);
    }
    setDraft({ name: "", title: "", parentId: selectedNodeId || "root" });
  };

  const startEdit = (node: TeamNode) => {
    setEditingId(node.id);
    setDraft({ name: node.name, title: node.title ?? "", parentId: node.parentId ?? "root" });
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
              className={`team-node ${node.id === selectedNodeId ? "active" : ""}`}
              key={node.id}
              style={{ paddingLeft: 10 + depth * 18 }}
              onClick={() => onSelect(node.id)}
            >
              <span>{node.name}</span>
              <small>{node.title || "Team member"}</small>
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
        <Input value={draft.title} placeholder="Role or title" onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
        <Select value={draft.parentId} onValueChange={(value) => setDraft({ ...draft, parentId: value })}>
          <SelectTrigger>
            <SelectValue placeholder="Parent node" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="root">Top level</SelectItem>
            {nodes
              .filter((node) => node.id !== editingId)
              .map((node) => (
                <SelectItem value={node.id} key={node.id}>
                  {nodePath(nodes, node)}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <div className="row-between">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setEditingId("");
              setDraft({ name: "", title: "", parentId: selectedNodeId || "root" });
            }}
          >
            Clear
          </Button>
          <Button type="button" disabled={!draft.name.trim()} onClick={save}>
            {editingNode ? <Save size={15} /> : <Plus size={15} />} {editingNode ? "Save" : "Add"}
          </Button>
        </div>
      </Card>

      <Card className="stack">
        <div className="row-between">
          <h2>Selected node</h2>
          <Badge>{teamView?.descendantIds.length ?? 0} in tree</Badge>
        </div>
        {teamView?.selectedNode ? (
          <>
            <div className="node-detail">
              <Users size={18} />
              <div>
                <strong>{teamView.selectedNode.name}</strong>
                <p className="muted">{teamView.selectedNode.title || "No title set"}</p>
              </div>
            </div>
            <StatsGrid
              stats={{
                tasks: teamView.stats.totalTasks,
                completedTasks: teamView.stats.completedTasks,
                notes: teamView.stats.notes,
                noteWords: teamView.notes.reduce((total, note) => total + wordCount(note.content), 0),
                completionRate: teamView.stats.completionRate,
              }}
            />
            <div className="item-actions">
              <Button type="button" variant="ghost" size="sm" onClick={() => startEdit(teamView.selectedNode!)}>
                <Edit3 size={14} /> Edit
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => confirmAction("Delete this team node?", () => onDelete(teamView.selectedNode!.id))}>
                <Trash2 size={14} /> Delete
              </Button>
            </div>
          </>
        ) : (
          <EmptyState title="No node selected" text="Select a team node or create one." />
        )}
      </Card>

      <Card className="stack workspace-tools">
        <div className="row-between">
          <h2>Workspace data</h2>
          <Badge>JSON</Badge>
        </div>
        <p className="muted">Export, import, or reset the API-backed workspace.</p>
        <div className="row tool-row">
          <Button type="button" variant="secondary" onClick={onExport}>
            <Download size={15} /> Export
          </Button>
          <label className="upload-button tool-upload">
            <Upload size={15} />
            Import
            <Input type="file" accept="application/json,.json" onChange={(event) => onImport(event.target.files?.[0])} />
          </label>
          <Button type="button" variant="ghost" onClick={() => confirmAction("Reset the workspace? This deletes all tasks, notes, and team nodes.", onReset)}>
            <Trash2 size={15} /> Reset
          </Button>
        </div>
      </Card>
    </div>
  );
}

function FirstTeamNode({ onCreate, loading }: { onCreate: (payload: { name: string; title?: string }) => Promise<void>; loading: boolean }) {
  const [name, setName] = useState("Team");
  const [title, setTitle] = useState("Management root");
  return (
    <Card className="stack first-node">
      <h2>Create the first team node</h2>
      <p className="muted">Tasks and notes need an owner node before team mode can start.</p>
      <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Node name" />
      <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Role or title" />
      <Button type="button" disabled={!name.trim() || loading} onClick={() => onCreate({ name, title })}>
        <Plus size={15} /> Create node
      </Button>
    </Card>
  );
}

function TasksView({
  tasks,
  nodes,
  selectedNodeId,
  onCreate,
  onUpdate,
  onDelete,
}: {
  tasks: Task[];
  nodes: TeamNode[];
  selectedNodeId: string;
  onCreate: (payload: { ownerNodeId: string; title: string; details: string; priority: TaskPriority; dueDate?: string }) => Promise<void>;
  onUpdate: (id: string, payload: { title?: string; details?: string; status?: TaskStatus; priority?: TaskPriority; dueDate?: string | null }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState({ title: "", details: "", ownerNodeId: selectedNodeId, priority: "normal" as TaskPriority, dueDate: "" });
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

  useEffect(() => {
    setDraft((current) => ({ ...current, ownerNodeId: selectedNodeId }));
  }, [selectedNodeId]);

  const saveTask = useCallback(async () => {
    const title = draft.title.trim();
    if (!title) return;
    if (editingTask) {
      await onUpdate(editingTask.id, { title, details: draft.details.trim(), priority: draft.priority, dueDate: draft.dueDate || null });
      setEditingId(null);
    } else {
      await onCreate({ ownerNodeId: draft.ownerNodeId, title, details: draft.details.trim(), priority: draft.priority, dueDate: draft.dueDate || undefined });
    }
    setDraft({ title: "", details: "", ownerNodeId: selectedNodeId, priority: "normal", dueDate: "" });
  }, [draft, editingTask, onCreate, onUpdate, selectedNodeId]);

  const startEdit = (task: Task) => {
    setEditingId(task.id);
    setDraft({ title: task.title, details: task.details, ownerNodeId: task.ownerNodeId, priority: task.priority, dueDate: task.dueDate ? toDateInput(task.dueDate) : "" });
  };

  const newTask = useCallback(() => {
    setEditingId(null);
    setDraft({ title: "", details: "", ownerNodeId: selectedNodeId, priority: "normal", dueDate: "" });
  }, [selectedNodeId]);

  useKeyboardShortcuts({ onSave: saveTask, onNew: newTask });

  return (
    <div className="grid two-col work-grid">
      <Card className="stack editor-panel">
        <div className="row-between">
          <h2>{editingTask ? "Edit task" : "New task"}</h2>
          {editingTask && <Badge>{formatDate(editingTask.createdAt)}</Badge>}
        </div>
        <OwnerSelect nodes={nodes} value={draft.ownerNodeId} onChange={(ownerNodeId) => setDraft({ ...draft, ownerNodeId })} disabled={!!editingTask} />
        <Input value={draft.title} placeholder="Task title" onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
        <div className="editor-fields">
          <Select value={draft.priority} onValueChange={(priority) => setDraft({ ...draft, priority: priority as TaskPriority })}>
            <SelectTrigger>
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              {(["low", "normal", "high", "urgent"] as TaskPriority[]).map((priority) => (
                <SelectItem value={priority} key={priority}>
                  {priorityLabel(priority)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="date" value={draft.dueDate} onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })} />
        </div>
        <Textarea
          className="compact"
          value={draft.details}
          placeholder="Details, blockers, links, or acceptance notes"
          onChange={(event) => setDraft({ ...draft, details: event.target.value })}
        />
        <div className="row-between">
          <Button
            variant="secondary"
            type="button"
            onClick={newTask}
          >
            Clear
          </Button>
          <Button type="button" disabled={!draft.title.trim()} onClick={saveTask}>
            {editingTask ? <Save size={16} /> : <Plus size={16} />} {editingTask ? "Save task" : "Add task"}
          </Button>
        </div>
      </Card>

      <Card className="stack">
        <div className="row-between">
          <h2>Task list</h2>
          <Badge>{tasks.filter((task) => task.status === "complete").length} complete</Badge>
        </div>
        <div className="search-field">
          <Search size={16} />
          <Input value={query} placeholder="Search tasks" onChange={(event) => setQuery(event.target.value)} />
        </div>
        <div className="filter-row">
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as "all" | TaskStatus)}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="complete">Complete</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={(value) => setPriorityFilter(value as "all" | TaskPriority)}>
            <SelectTrigger>
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priority</SelectItem>
              {(["low", "normal", "high", "urgent"] as TaskPriority[]).map((priority) => (
                <SelectItem value={priority} key={priority}>
                  {priorityLabel(priority)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="item-list">
          {visibleTasks.map((task) => (
            <div className={`todo task-row ${task.status === "complete" ? "done" : ""}`} key={task.id}>
              <div className="row-between">
                <label className="row task-check">
                  <Checkbox checked={task.status === "complete"} onCheckedChange={(checked) => onUpdate(task.id, { status: checked ? "complete" : "open" })} />
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
                <Button type="button" variant="ghost" size="sm" onClick={() => startEdit(task)}>
                  <Edit3 size={14} /> Edit
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => confirmAction("Delete this task?", () => onDelete(task.id))}>
                  <Trash2 size={14} /> Delete
                </Button>
              </div>
            </div>
          ))}
          {!visibleTasks.length && <EmptyState title="No tasks found" text="Add a task or adjust the search." actionLabel="New task" onAction={newTask} />}
        </div>
      </Card>
    </div>
  );
}

function NotesView({
  notes,
  nodes,
  selectedNodeId,
  onCreate,
  onUpdate,
  onDelete,
}: {
  notes: MeetingNote[];
  nodes: TeamNode[];
  selectedNodeId: string;
  onCreate: (payload: { ownerNodeId: string; title: string; date: string; content: string; tags: string }) => Promise<MeetingNote>;
  onUpdate: (id: string, payload: { title?: string; date?: string; content?: string; tags?: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [activeId, setActiveId] = useState(notes[0]?.id ?? "");
  const activeNote = notes.find((note) => note.id === activeId) ?? notes[0];
  const [draft, setDraft] = useState(() => activeNote ?? createBlankNote(selectedNodeId));
  const [uploadError, setUploadError] = useState("");

  useEffect(() => {
    if (activeNote) setDraft({ ...activeNote, date: toDateInput(activeNote.date) });
  }, [activeNote?.id]);

  useEffect(() => {
    if (!activeNote) setDraft(createBlankNote(selectedNodeId));
  }, [selectedNodeId, activeNote]);

  const saveNote = useCallback(async () => {
    const title = draft.title.trim() || "Untitled meeting";
    if (activeNote) {
      await onUpdate(activeNote.id, { title, date: draft.date, content: draft.content, tags: draft.tags });
    } else {
      const created = await onCreate({ ownerNodeId: draft.ownerNodeId, title, date: draft.date, content: draft.content, tags: draft.tags });
      setActiveId(created.id);
    }
  }, [activeNote, draft, onCreate, onUpdate]);

  const newNote = useCallback(() => {
    const note = createBlankNote(selectedNodeId);
    setDraft(note);
    setActiveId("");
  }, [selectedNodeId]);

  useKeyboardShortcuts({ onSave: saveNote, onNew: newNote });

  const deleteNote = async (noteId: string) => {
    await onDelete(noteId);
    const next = notes.find((note) => note.id !== noteId);
    setActiveId(next?.id ?? "");
    setDraft(next ? { ...next, date: toDateInput(next.date) } : createBlankNote(selectedNodeId));
  };

  const uploadNote = async (file: File | undefined) => {
    if (!file) return;
    setUploadError("");
    if (!/\.(md|markdown|txt)$/i.test(file.name)) {
      setUploadError("Only .md, .markdown, and .txt files are supported.");
      return;
    }
    try {
      const content = await file.text();
      const title = file.name.replace(/\.(md|markdown|txt)$/i, "");
      const created = await onCreate({ ownerNodeId: selectedNodeId, title, date: today(), content, tags: "" });
      setActiveId(created.id);
    } catch {
      setUploadError("This file could not be read.");
    }
  };

  return (
    <div className="grid notes-grid">
      <Card className="stack note-list">
        <div className="row-between">
          <h2>Notes</h2>
          <Button type="button" size="sm" onClick={newNote}>
            <Plus size={15} /> New
          </Button>
        </div>
        <label className="upload-button">
          <Upload size={15} />
          Upload markdown
          <Input type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" onChange={(event) => uploadNote(event.target.files?.[0])} />
        </label>
        {uploadError && <div className="form-error">{uploadError}</div>}
        <div className="item-list">
          {notes.map((note) => (
            <button className={`note-tab ${note.id === activeId ? "active" : ""}`} key={note.id} onClick={() => setActiveId(note.id)}>
              <span>{note.title}</span>
              <small>{nodeLabel(nodes, note.ownerNodeId)} · {formatDate(note.date)}</small>
              {note.tags && <small>{note.tags}</small>}
            </button>
          ))}
          {!notes.length && <EmptyState title="No notes yet" text="Create a note or upload a markdown file." actionLabel="New note" onAction={newNote} />}
        </div>
      </Card>

      <Card className="stack markdown-editor">
        <div className="row-between">
          <h2>Markdown editor</h2>
          <Badge>{formatDate(draft.date)}</Badge>
        </div>
        <OwnerSelect nodes={nodes} value={draft.ownerNodeId} onChange={(ownerNodeId) => setDraft({ ...draft, ownerNodeId })} disabled={!!activeNote} />
        <div className="editor-fields">
          <Input value={draft.title} placeholder="Meeting title" onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
          <Input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} />
        </div>
        <Input value={draft.tags} placeholder="Tags, comma separated" onChange={(event) => setDraft({ ...draft, tags: event.target.value })} />
        <Textarea className="markdown-source" value={draft.content} onChange={(event) => setDraft({ ...draft, content: event.target.value })} />
        <div className="row-between">
          <Button type="button" variant="secondary" disabled={!activeNote} onClick={() => activeNote && confirmAction("Delete this note?", () => deleteNote(activeNote.id))}>
            <Trash2 size={15} /> Delete
          </Button>
          <Button type="button" onClick={saveNote}>
            <Save size={15} /> Save note
          </Button>
        </div>
      </Card>

      <Card className="stack markdown-preview-card">
        <h2>Preview</h2>
        <div className="markdown-preview" dangerouslySetInnerHTML={{ __html: renderMarkdown(draft.content) }} />
      </Card>
    </div>
  );
}

function SummaryView({ tasks, notes, period }: { tasks: Task[]; notes: MeetingNote[]; period: Period }) {
  const stats = buildStats(tasks, notes);
  const completedTasks = tasks.filter((task) => task.status === "complete");
  const openTasks = tasks.filter((task) => task.status === "open");

  return (
    <div className="stack">
      <StatsGrid stats={stats} />
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
          <SummaryList items={openTasks.map((task) => ({ id: task.id, date: task.createdAt, title: task.title, body: task.details }))} />
        </div>
        <div className="summary-section">
          <h3>Meeting notes</h3>
          <SummaryList items={notes.map((note) => ({ id: note.id, date: note.date, title: note.title, body: firstLines(note.content) }))} />
        </div>
      </Card>
    </div>
  );
}

function AchievementsView({ tasks, notes, period }: { tasks: Task[]; notes: MeetingNote[]; period: Period }) {
  const stats = buildStats(tasks, notes);
  const achievements = [
    {
      id: "completed",
      title: "Execution streak",
      value: stats.completedTasks,
      target: 5,
      text: "Completed tasks in the selected period.",
      sources: tasks.filter((task) => task.status === "complete").map((task) => task.title),
    },
    {
      id: "notes",
      title: "Meeting memory",
      value: stats.notes,
      target: 3,
      text: "Saved meeting notes with dates and content.",
      sources: notes.map((note) => note.title),
    },
    {
      id: "archive",
      title: "Historical record",
      value: tasks.length + notes.length,
      target: 10,
      text: "Total historical task and note records.",
      sources: [...tasks.map((task) => task.title), ...notes.map((note) => note.title)],
    },
  ];

  return (
    <div className="stack">
      <StatsGrid stats={stats} />
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
                  {achievement.sources.slice(0, 6).map((source) => (
                    <li key={source}>{source}</li>
                  ))}
                  {!achievement.sources.length && <li>No source records yet</li>}
                </ul>
              </details>
              <div className="progress-track">
                <span style={{ width: `${Math.min(100, (achievement.value / achievement.target) * 100)}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <Card className="stack">
        <h2>{periodLabel(period)} history</h2>
        <SummaryList
          items={[
            ...tasks.map((task) => ({ id: task.id, date: task.completedAt ?? task.createdAt, title: task.title, body: task.status })),
            ...notes.map((note) => ({ id: note.id, date: note.date, title: note.title, body: "meeting note" })),
          ].sort((a, b) => b.date.localeCompare(a.date))}
        />
      </Card>
    </div>
  );
}

function StatsGrid({ stats }: { stats: ReturnType<typeof buildStats> }) {
  return (
    <div className="grid three-col">
      <Card className="metric-card">
        <h2>Total tasks</h2>
        <div className="metric-value">{stats.tasks}</div>
        <p className="muted">{stats.completedTasks} completed</p>
      </Card>
      <Card className="metric-card">
        <h2>Meeting notes</h2>
        <div className="metric-value">{stats.notes}</div>
        <p className="muted">{stats.noteWords} note words</p>
      </Card>
      <Card className="metric-card">
        <h2>Completion</h2>
        <div className="metric-value">{stats.completionRate}%</div>
        <p className="muted">Selected period</p>
      </Card>
    </div>
  );
}

function NodeSelect({ nodes, value, onChange }: { nodes: TeamNode[]; value: string; onChange: (value: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="member-select">
        <SelectValue placeholder="Select node" />
      </SelectTrigger>
      <SelectContent>
        {nodes.map((node) => (
          <SelectItem value={node.id} key={node.id}>
            {nodePath(nodes, node)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function OwnerSelect({ nodes, value, onChange, disabled }: { nodes: TeamNode[]; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger>
        <SelectValue placeholder="Owner" />
      </SelectTrigger>
      <SelectContent>
        {nodes.map((node) => (
          <SelectItem value={node.id} key={node.id}>
            {nodePath(nodes, node)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ScopeControl({ value, onChange }: { value: Scope; onChange: (value: Scope) => void }) {
  return (
    <ToggleGroup type="single" value={value} onValueChange={(next) => next && onChange(next as Scope)} aria-label="Team scope">
      <ToggleGroupItem value="self">Self</ToggleGroupItem>
      <ToggleGroupItem value="tree">Tree</ToggleGroupItem>
    </ToggleGroup>
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
          <div>
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
      {actionLabel && onAction && (
        <Button type="button" size="sm" variant="secondary" onClick={onAction}>
          <Plus size={14} /> {actionLabel}
        </Button>
      )}
    </div>
  );
}

function useMiraApi() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) ?? "");
  const [user, setUser] = useState<User | null>(null);
  const [teamNodes, setTeamNodes] = useState<TeamNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<MeetingNote[]>([]);
  const [teamView, setTeamView] = useState<TeamView | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);

  const request = useCallback(
    async <T,>(path: string, options: RequestInit = {}) => {
      const headers = new Headers(options.headers);
      headers.set("Content-Type", "application/json");
      if (token) headers.set("Authorization", `Bearer ${token}`);
      const response = await fetch(`${API_URL}${path}`, { ...options, headers });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || body.detail || `Request failed: ${response.status}`);
      }
      return (await response.json()) as T;
    },
    [token],
  );

  const refresh = useCallback(async () => {
    try {
      setError("");
      const nodes = await request<TeamNode[]>("/team/tree");
      setTeamNodes(nodes);
      setSelectedNodeId((current) => current || nodes[0]?.id || "");
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [request]);

  const loadWork = useCallback(
    async (scope: Scope, period: Period) => {
      if (!selectedNodeId) {
        setTasks([]);
        setNotes([]);
        setTeamView(null);
        return;
      }
      try {
        setError("");
        const query = `nodeId=${encodeURIComponent(selectedNodeId)}&scope=${scope}`;
        const [taskData, noteData, viewData] = await Promise.all([
          request<Task[]>(`/tasks?${query}`),
          request<MeetingNote[]>(`/notes?${query}`),
          request<TeamView>(`/team/view?nodeId=${encodeURIComponent(selectedNodeId)}&period=${period}`),
        ]);
        setTasks(taskData);
        setNotes(noteData);
        setTeamView(viewData);
      } catch (err) {
        setError(errorMessage(err));
      }
    },
    [request, selectedNodeId],
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
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || "Unable to sign in");
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
    setSelectedNodeId("");
    setTasks([]);
    setNotes([]);
    setTeamView(null);
  };

  useEffect(() => {
    if (!token) return;
    void request<User>("/auth/me")
      .then(setUser)
      .catch(() => logout());
  }, [token, request]);

  const mutate = async (operation: () => Promise<unknown>) => {
    setLoading(true);
    try {
      setError("");
      await operation();
      await refresh();
      setRevision((current) => current + 1);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const exportWorkspace = async () => {
    setLoading(true);
    try {
      setError("");
      const [allTasks, allNotes] = await Promise.all([request<Task[]>("/tasks"), request<MeetingNote[]>("/notes")]);
      downloadJson({
        exportedAt: new Date().toISOString(),
        teamNodes,
        tasks: allTasks,
        notes: allNotes,
      } satisfies WorkspaceExport);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const importWorkspace = async (file: File | undefined) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".json")) {
      setError("Only .json workspace files are supported.");
      return;
    }

    setLoading(true);
    try {
      setError("");
      const payload = parseWorkspaceExport(await file.text());
      const idMap = new Map<string, string>();
      for (const node of sortNodesForImport(payload.teamNodes)) {
        const created = await request<TeamNode>("/team/nodes", {
          method: "POST",
          body: JSON.stringify({
            name: node.name,
            title: node.title || undefined,
            parentId: node.parentId ? idMap.get(node.parentId) : undefined,
          }),
        });
        idMap.set(node.id, created.id);
      }

      for (const task of payload.tasks) {
        const ownerNodeId = idMap.get(task.ownerNodeId);
        if (!ownerNodeId) continue;
        const created = await request<Task>("/tasks", {
          method: "POST",
          body: JSON.stringify({ ownerNodeId, title: task.title, details: task.details, priority: task.priority, dueDate: task.dueDate }),
        });
        if (task.status === "complete") {
          await request(`/tasks/${created.id}`, {
            method: "PATCH",
            body: JSON.stringify({ status: "complete" }),
          });
        }
      }

      for (const note of payload.notes) {
        const ownerNodeId = idMap.get(note.ownerNodeId);
        if (!ownerNodeId) continue;
        await request("/notes", {
          method: "POST",
          body: JSON.stringify({ ownerNodeId, title: note.title, date: note.date, content: note.content, tags: note.tags || "" }),
        });
      }

      await refresh();
      setSelectedNodeId((current) => current || Array.from(idMap.values())[0] || "");
      setRevision((current) => current + 1);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const resetWorkspace = async () => {
    setLoading(true);
    try {
      setError("");
      const [allTasks, allNotes, nodes] = await Promise.all([request<Task[]>("/tasks"), request<MeetingNote[]>("/notes"), request<TeamNode[]>("/team/tree")]);
      for (const task of allTasks) await request(`/tasks/${task.id}`, { method: "DELETE" });
      for (const note of allNotes) await request(`/notes/${note.id}`, { method: "DELETE" });
      for (const node of sortNodesForDelete(nodes)) await request(`/team/nodes/${node.id}`, { method: "DELETE" });
      setTeamNodes([]);
      setSelectedNodeId("");
      setTasks([]);
      setNotes([]);
      setTeamView(null);
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
    selectedNodeId,
    setSelectedNodeId,
    tasks,
    notes,
    teamView,
    error,
    loading,
    revision,
    login,
    logout,
    refresh,
    loadWork,
    exportWorkspace,
    importWorkspace,
    resetWorkspace,
    createTeamNode: (payload: { name: string; title?: string; parentId?: string }) =>
      mutate(() => request("/team/nodes", { method: "POST", body: JSON.stringify(payload) })),
    updateTeamNode: (id: string, payload: { name?: string; title?: string | null; parentId?: string | null }) =>
      mutate(() => request(`/team/nodes/${id}`, { method: "PATCH", body: JSON.stringify(payload) })),
    deleteTeamNode: (id: string) => mutate(() => request(`/team/nodes/${id}`, { method: "DELETE" })),
    createTask: (payload: { ownerNodeId: string; title: string; details: string; priority: TaskPriority; dueDate?: string }) =>
      mutate(() => request("/tasks", { method: "POST", body: JSON.stringify(payload) })),
    updateTask: (id: string, payload: { title?: string; details?: string; status?: TaskStatus; priority?: TaskPriority; dueDate?: string | null }) =>
      mutate(() => request(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(payload) })),
    deleteTask: (id: string) => mutate(() => request(`/tasks/${id}`, { method: "DELETE" })),
    createNote: async (payload: { ownerNodeId: string; title: string; date: string; content: string; tags: string }) => {
      let created: MeetingNote | null = null;
      await mutate(async () => {
        created = await request<MeetingNote>("/notes", { method: "POST", body: JSON.stringify(payload) });
      });
      return created!;
    },
    updateNote: (id: string, payload: { title?: string; date?: string; content?: string; tags?: string }) =>
      mutate(() => request(`/notes/${id}`, { method: "PATCH", body: JSON.stringify(payload) })),
    deleteNote: (id: string) => mutate(() => request(`/notes/${id}`, { method: "DELETE" })),
  };
}

function resolveRouteFromHash(): Route {
  const hash = window.location.hash.replace(/^#\/?/, "") as Route;
  return nav.some((item) => item.key === hash) ? hash : "team";
}

function createBlankNote(ownerNodeId: string): MeetingNote {
  return { id: "", ownerNodeId, title: "", date: today(), tags: "", updatedAt: today(), content: "## Meeting notes\n\n- " };
}

function buildStats(tasks: Task[], notes: MeetingNote[]) {
  const completedTasks = tasks.filter((task) => task.status === "complete").length;
  const noteWords = notes.reduce((total, note) => total + wordCount(note.content), 0);
  return {
    tasks: tasks.length,
    completedTasks,
    notes: notes.length,
    noteWords,
    completionRate: tasks.length ? Math.round((completedTasks / tasks.length) * 100) : 0,
  };
}

function buildTreeRows(nodes: TeamNode[]) {
  const byParent = new Map<string, TeamNode[]>();
  for (const node of nodes) {
    byParent.set(node.parentId ?? "root", [...(byParent.get(node.parentId ?? "root") ?? []), node]);
  }
  for (const siblings of byParent.values()) {
    siblings.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }

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
  const depthOf = (node: TeamNode): number => {
    if (!node.parentId) return 0;
    const parent = byId.get(node.parentId);
    return parent ? depthOf(parent) + 1 : 0;
  };
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
  return content
    .split("\n")
    .map((line) => line.replace(/^#+\s*/, "").replace(/^[-*]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(" · ");
}

function renderMarkdown(markdown: string) {
  const escaped = markdown
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return escaped
    .split("\n")
    .map((line) => {
      if (line.startsWith("### ")) return `<h3>${renderInlineMarkdown(line.slice(4))}</h3>`;
      if (line.startsWith("## ")) return `<h2>${renderInlineMarkdown(line.slice(3))}</h2>`;
      if (line.startsWith("# ")) return `<h1>${renderInlineMarkdown(line.slice(2))}</h1>`;
      if (line.startsWith("- ")) return `<li>${renderInlineMarkdown(line.slice(2))}</li>`;
      if (!line.trim()) return "";
      return `<p>${renderInlineMarkdown(line)}</p>`;
    })
    .join("");
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
  const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `mira-summary-${period}-${today()}.md`;
  link.click();
  URL.revokeObjectURL(url);
}

function parseWorkspaceExport(text: string): WorkspaceExport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("The selected JSON file could not be parsed.");
  }

  if (!isRecord(parsed) || !Array.isArray(parsed.teamNodes) || !Array.isArray(parsed.tasks) || !Array.isArray(parsed.notes)) {
    throw new Error("This JSON file is not a Mira workspace export.");
  }

  return parsed as WorkspaceExport;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function downloadJson(payload: WorkspaceExport) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `mira-workspace-${today()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function confirmAction(message: string, action: () => void | Promise<void>) {
  if (window.confirm(message)) void action();
}

function useKeyboardShortcuts({ onSave, onNew }: { onSave: () => void | Promise<void>; onNew: () => void }) {
  useEffect(() => {
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
  }, [onSave, onNew]);
}

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : "Something went wrong";
}

createRoot(document.getElementById("root")!).render(<App />);
