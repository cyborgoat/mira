import {
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Edit3,
  FileText,
  ListChecks,
  Plus,
  Save,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
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

type Route = "tasks" | "notes" | "summary" | "achievements";
type TaskStatus = "open" | "complete";
type Period = "daily" | "weekly" | "monthly";

type Task = {
  id: string;
  title: string;
  details: string;
  status: TaskStatus;
  createdAt: string;
  completedAt?: string;
};

type MeetingNote = {
  id: string;
  title: string;
  date: string;
  content: string;
  updatedAt: string;
};

type AppState = {
  tasks: Task[];
  notes: MeetingNote[];
};

const STORAGE_KEY = "mira-local-workspace-v1";

const nav: Array<{ key: Route; label: string; icon: React.ComponentType<{ size?: number }> }> = [
  { key: "tasks", label: "Tasks", icon: ClipboardList },
  { key: "notes", label: "Meeting Notes", icon: FileText },
  { key: "summary", label: "Weekly Summary", icon: CalendarDays },
  { key: "achievements", label: "Achievements", icon: BadgeCheck },
];

const seedState: AppState = {
  tasks: [
    {
      id: "task-1",
      title: "Draft product scope",
      details: "Capture first-pass requirements and open questions.",
      status: "complete",
      createdAt: daysAgo(4),
      completedAt: daysAgo(3),
    },
    {
      id: "task-2",
      title: "Review meeting notes",
      details: "Turn decisions into action items before the next check-in.",
      status: "open",
      createdAt: daysAgo(1),
    },
  ],
  notes: [
    {
      id: "note-1",
      title: "Planning sync",
      date: daysAgo(2),
      updatedAt: daysAgo(2),
      content: "## Decisions\n- Keep the first version local-first\n- Prioritize tasks, notes, summaries\n\n## Follow-ups\n- Validate weekly rollup format",
    },
  ],
};

function App() {
  const [route, setRoute] = useState<Route>(resolveRouteFromHash());
  const [state, setState] = usePersistentState();
  const [period, setPeriod] = useState<Period>("weekly");
  const currentNav = nav.find((item) => item.key === route) ?? nav[0];
  const filtered = useMemo(() => filterByPeriod(state, period), [state, period]);
  const stats = useMemo(() => buildStats(filtered), [filtered]);

  useEffect(() => {
    const handleHashChange = () => setRoute(resolveRouteFromHash());
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const navigateTo = (nextRoute: Route) => {
    window.location.hash = nextRoute;
    setRoute(nextRoute);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">M</span>
          <div className="brand-stack">
            <span className="brand-name">Mira</span>
            <span className="brand-slogan">Local workspace</span>
          </div>
        </div>
        <div className="row">
          <Badge>{state.tasks.length} tasks</Badge>
          <Badge>{state.notes.length} notes</Badge>
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
        <div className="page-header">
          <div>
            <div className="eyebrow">Mira workspace</div>
            <h1>{currentNav.label}</h1>
            <p className="muted">Tasks, meeting notes, and generated work summaries in one local view.</p>
          </div>
          {(route === "summary" || route === "achievements") && <PeriodControl value={period} onChange={setPeriod} />}
        </div>

        {route === "tasks" && <TasksView tasks={state.tasks} setState={setState} />}
        {route === "notes" && <NotesView notes={state.notes} setState={setState} />}
        {route === "summary" && <SummaryView filtered={filtered} stats={stats} period={period} />}
        {route === "achievements" && <AchievementsView filtered={filtered} stats={stats} period={period} />}
      </main>
    </div>
  );
}

function TasksView({ tasks, setState }: { tasks: Task[]; setState: React.Dispatch<React.SetStateAction<AppState>> }) {
  const [draft, setDraft] = useState({ title: "", details: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const editingTask = tasks.find((task) => task.id === editingId);
  const visibleTasks = tasks.filter((task) => `${task.title} ${task.details}`.toLowerCase().includes(query.toLowerCase()));

  const saveTask = () => {
    const title = draft.title.trim();
    if (!title) return;
    if (editingId) {
      setState((current) => ({
        ...current,
        tasks: current.tasks.map((task) => (task.id === editingId ? { ...task, title, details: draft.details.trim() } : task)),
      }));
      setEditingId(null);
    } else {
      setState((current) => ({
        ...current,
        tasks: [{ id: createId("task"), title, details: draft.details.trim(), status: "open", createdAt: today() }, ...current.tasks],
      }));
    }
    setDraft({ title: "", details: "" });
  };

  const startEdit = (task: Task) => {
    setEditingId(task.id);
    setDraft({ title: task.title, details: task.details });
  };

  const toggleTask = (taskId: string, checked: boolean) => {
    setState((current) => ({
      ...current,
      tasks: current.tasks.map((task) =>
        task.id === taskId
          ? { ...task, status: checked ? "complete" : "open", completedAt: checked ? today() : undefined }
          : task,
      ),
    }));
  };

  const deleteTask = (taskId: string) => {
    setState((current) => ({ ...current, tasks: current.tasks.filter((task) => task.id !== taskId) }));
    if (editingId === taskId) {
      setEditingId(null);
      setDraft({ title: "", details: "" });
    }
  };

  return (
    <div className="grid two-col work-grid">
      <Card className="stack editor-panel">
        <div className="row-between">
          <h2>{editingTask ? "Edit task" : "New task"}</h2>
          {editingTask && <Badge>{formatDate(editingTask.createdAt)}</Badge>}
        </div>
        <Input value={draft.title} placeholder="Task title" onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
        <Textarea
          className="compact"
          value={draft.details}
          placeholder="Details, blockers, links, or acceptance notes"
          onChange={(event) => setDraft({ ...draft, details: event.target.value })}
        />
        <div className="row-between">
          <Button variant="secondary" type="button" onClick={() => {
            setEditingId(null);
            setDraft({ title: "", details: "" });
          }}>
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
        <div className="item-list">
          {visibleTasks.map((task) => (
            <div className={`todo task-row ${task.status === "complete" ? "done" : ""}`} key={task.id}>
              <div className="row-between">
                <label className="row task-check">
                  <Checkbox checked={task.status === "complete"} onCheckedChange={(checked) => toggleTask(task.id, checked === true)} />
                  <span className="todo-title">{task.title}</span>
                </label>
                <Badge>{task.status}</Badge>
              </div>
              {task.details && <p className="muted item-body">{task.details}</p>}
              <div className="item-actions">
                <span className="muted">{formatDate(task.completedAt ?? task.createdAt)}</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => startEdit(task)}>
                  <Edit3 size={14} /> Edit
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => deleteTask(task.id)}>
                  <Trash2 size={14} /> Delete
                </Button>
              </div>
            </div>
          ))}
          {!visibleTasks.length && <EmptyState title="No tasks found" text="Add a task or adjust the search." />}
        </div>
      </Card>
    </div>
  );
}

function NotesView({ notes, setState }: { notes: MeetingNote[]; setState: React.Dispatch<React.SetStateAction<AppState>> }) {
  const [activeId, setActiveId] = useState(notes[0]?.id ?? "");
  const activeNote = notes.find((note) => note.id === activeId) ?? notes[0];
  const [draft, setDraft] = useState(() => activeNote ?? createBlankNote());

  useEffect(() => {
    if (activeNote) setDraft(activeNote);
  }, [activeNote?.id]);

  const saveNote = () => {
    const title = draft.title.trim() || "Untitled meeting";
    const nextNote = { ...draft, title, content: draft.content, updatedAt: today() };
    setState((current) => {
      const exists = current.notes.some((note) => note.id === nextNote.id);
      return {
        ...current,
        notes: exists
          ? current.notes.map((note) => (note.id === nextNote.id ? nextNote : note))
          : [nextNote, ...current.notes],
      };
    });
    setActiveId(nextNote.id);
  };

  const newNote = () => {
    const note = createBlankNote();
    setDraft(note);
    setActiveId(note.id);
  };

  const deleteNote = (noteId: string) => {
    setState((current) => ({ ...current, notes: current.notes.filter((note) => note.id !== noteId) }));
    const next = notes.find((note) => note.id !== noteId);
    setActiveId(next?.id ?? "");
    setDraft(next ?? createBlankNote());
  };

  const uploadNote = async (file: File | undefined) => {
    if (!file) return;
    const content = await file.text();
    const title = file.name.replace(/\.(md|markdown|txt)$/i, "");
    const note = { id: createId("note"), title, date: today(), updatedAt: today(), content };
    setDraft(note);
    setActiveId(note.id);
    setState((current) => ({ ...current, notes: [note, ...current.notes] }));
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
        <div className="item-list">
          {notes.map((note) => (
            <button className={`note-tab ${note.id === activeId ? "active" : ""}`} key={note.id} onClick={() => setActiveId(note.id)}>
              <span>{note.title}</span>
              <small>{formatDate(note.date)}</small>
            </button>
          ))}
          {!notes.length && <EmptyState title="No notes yet" text="Create a note or upload a markdown file." />}
        </div>
      </Card>

      <Card className="stack markdown-editor">
        <div className="row-between">
          <h2>Markdown editor</h2>
          <Badge>{formatDate(draft.date)}</Badge>
        </div>
        <div className="editor-fields">
          <Input value={draft.title} placeholder="Meeting title" onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
          <Input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} />
        </div>
        <Textarea className="markdown-source" value={draft.content} onChange={(event) => setDraft({ ...draft, content: event.target.value })} />
        <div className="row-between">
          <Button type="button" variant="secondary" disabled={!activeNote} onClick={() => activeNote && deleteNote(activeNote.id)}>
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

function SummaryView({ filtered, stats, period }: { filtered: AppState; stats: ReturnType<typeof buildStats>; period: Period }) {
  const completedTasks = filtered.tasks.filter((task) => task.status === "complete");
  const openTasks = filtered.tasks.filter((task) => task.status === "open");

  return (
    <div className="stack">
      <StatsGrid stats={stats} />
      <Card className="stack summary-panel">
        <div className="row-between">
          <h2>{periodLabel(period)} summary</h2>
          <Badge>{filtered.tasks.length + filtered.notes.length} records</Badge>
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
          <SummaryList items={filtered.notes.map((note) => ({ id: note.id, date: note.date, title: note.title, body: firstLines(note.content) }))} />
        </div>
      </Card>
    </div>
  );
}

function AchievementsView({ filtered, stats, period }: { filtered: AppState; stats: ReturnType<typeof buildStats>; period: Period }) {
  const achievements = [
    {
      id: "completed",
      title: "Execution streak",
      value: stats.completedTasks,
      target: 5,
      text: "Completed tasks in the selected period.",
    },
    {
      id: "notes",
      title: "Meeting memory",
      value: stats.notes,
      target: 3,
      text: "Saved meeting notes with dates and content.",
    },
    {
      id: "archive",
      title: "Historical record",
      value: filtered.tasks.length + filtered.notes.length,
      target: 10,
      text: "Total historical task and note records.",
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
            ...filtered.tasks.map((task) => ({ id: task.id, date: task.completedAt ?? task.createdAt, title: task.title, body: task.status })),
            ...filtered.notes.map((note) => ({ id: note.id, date: note.date, title: note.title, body: "meeting note" })),
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

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty-state">
      <ListChecks size={18} />
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

function usePersistentState(): [AppState, React.Dispatch<React.SetStateAction<AppState>>] {
  const [state, setState] = useState<AppState>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return seedState;
    try {
      return JSON.parse(stored) as AppState;
    } catch {
      return seedState;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  return [state, setState];
}

function resolveRouteFromHash(): Route {
  const hash = window.location.hash.replace(/^#\/?/, "") as Route;
  return nav.some((item) => item.key === hash) ? hash : "tasks";
}

function createBlankNote(): MeetingNote {
  return { id: createId("note"), title: "", date: today(), updatedAt: today(), content: "## Meeting notes\n\n- " };
}

function filterByPeriod(state: AppState, period: Period): AppState {
  const inPeriod = (date: string) => isInPeriod(date, period);
  return {
    tasks: state.tasks.filter((task) => inPeriod(task.completedAt ?? task.createdAt)),
    notes: state.notes.filter((note) => inPeriod(note.date)),
  };
}

function buildStats(state: AppState) {
  const completedTasks = state.tasks.filter((task) => task.status === "complete").length;
  const noteWords = state.notes.reduce((total, note) => total + note.content.trim().split(/\s+/).filter(Boolean).length, 0);
  return {
    tasks: state.tasks.length,
    completedTasks,
    notes: state.notes.length,
    noteWords,
    completionRate: state.tasks.length ? Math.round((completedTasks / state.tasks.length) * 100) : 0,
  };
}

function isInPeriod(dateValue: string, period: Period) {
  const date = startOfDay(new Date(dateValue));
  const now = startOfDay(new Date());
  if (period === "daily") return date.getTime() === now.getTime();
  if (period === "weekly") {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    return date >= weekStart;
  }
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function periodLabel(period: Period) {
  return period.charAt(0).toUpperCase() + period.slice(1);
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
      if (line.startsWith("### ")) return `<h3>${line.slice(4)}</h3>`;
      if (line.startsWith("## ")) return `<h2>${line.slice(3)}</h2>`;
      if (line.startsWith("# ")) return `<h1>${line.slice(2)}</h1>`;
      if (line.startsWith("- ")) return `<li>${line.slice(2)}</li>`;
      if (!line.trim()) return "";
      return `<p>${line}</p>`;
    })
    .join("");
}

function formatDate(dateValue: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(dateValue));
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
