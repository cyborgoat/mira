import { useCallback, useEffect, useState } from "react";
import { Edit3, Plus, Save, Search, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Task, TaskPriority, TaskStatus, TeamNode } from "../types";
import { EmptyState, PrioritySelect, useKeyboardShortcuts } from "../shared";
import { formatDate, nodeLabel } from "../helpers";

type TasksViewProps = {
  tasks: Task[];
  nodes: TeamNode[];
  readOnly: boolean;
  onCreate: (payload: { title: string; details: string; priority: TaskPriority; dueDate?: string }) => Promise<void>;
  onUpdate: (id: string, payload: { title?: string; details?: string; status?: TaskStatus; priority?: TaskPriority; dueDate?: string | null }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

export function TasksView({ tasks, nodes, readOnly, onCreate, onUpdate, onDelete }: TasksViewProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState({ title: "", details: "", priority: "normal" as TaskPriority, dueDate: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showComposer, setShowComposer] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | TaskStatus>("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | TaskPriority>("all");
  const editingTask = tasks.find((task) => task.id === editingId);
  const selectedTask = selectedId ? tasks.find((task) => task.id === selectedId) ?? null : null;
  const visibleTasks = tasks.filter((task) => {
    const matchesQuery = `${task.title} ${task.details}`.toLowerCase().includes(query.toLowerCase());
    const matchesStatus = statusFilter === "all" || task.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || task.priority === priorityFilter;
    return matchesQuery && matchesStatus && matchesPriority;
  });

  useEffect(() => {
    if (!selectedId && visibleTasks[0]) setSelectedId(visibleTasks[0].id);
    if (selectedId && !tasks.some((task) => task.id === selectedId)) setSelectedId(visibleTasks[0]?.id ?? "");
  }, [selectedId, tasks, visibleTasks]);

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
    setShowComposer(false);
  }, [draft, editingTask, onCreate, onUpdate, readOnly]);

  const newTask = useCallback(() => {
    setEditingId(null);
    setDraft({ title: "", details: "", priority: "normal", dueDate: "" });
    setShowComposer(true);
  }, []);

  const startEdit = (task: Task) => {
    if (readOnly) return;
    setEditingId(task.id);
    setSelectedId(task.id);
    setDraft({ title: task.title, details: task.details, priority: task.priority, dueDate: task.dueDate ? toDateInput(task.dueDate) : "" });
    setShowComposer(true);
  };

  const closeComposer = () => {
    setEditingId(null);
    setDraft({ title: "", details: "", priority: "normal", dueDate: "" });
    setShowComposer(false);
  };

  useKeyboardShortcuts({ onSave: saveTask, onNew: newTask, enabled: !readOnly });

  return (
    <div className="grid two-col work-grid task-workspace">
      <Card className="stack task-list-panel">
        <div className="row-between">
          <h2>{readOnly ? t("tasks.teamDetails") : t("tasks.taskList")}</h2>
          <div className="cluster">
            <Badge>{tasks.filter((task) => task.status === "complete").length} {t("common.complete")}</Badge>
            {!readOnly && (
              <Button type="button" size="sm" onClick={newTask}>
                <Plus size={15} /> {t("tasks.newTask")}
              </Button>
            )}
          </div>
        </div>
        {!readOnly && showComposer && (
          <div className="stack composer-panel">
            <div className="row-between">
              <h3>{editingTask ? t("tasks.editTask") : t("tasks.newTask")}</h3>
              <Button type="button" variant="ghost" size="sm" onClick={closeComposer}>
                <X size={14} /> {t("llmWiki.cancelEdit")}
              </Button>
            </div>
            <Input value={draft.title} placeholder={t("tasks.titlePlaceholder")} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
            <div className="editor-fields">
              <PrioritySelect value={draft.priority} onChange={(priority) => setDraft({ ...draft, priority })} />
              <Input type="date" value={draft.dueDate} onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })} />
            </div>
            <Textarea className="compact" value={draft.details} placeholder={t("tasks.detailsPlaceholder")} onChange={(event) => setDraft({ ...draft, details: event.target.value })} />
            <div className="row-between">
              <Button variant="secondary" type="button" onClick={closeComposer}>
                {t("common.clear")}
              </Button>
              <Button type="button" disabled={!draft.title.trim()} onClick={saveTask}>
                {editingTask ? <Save size={16} /> : <Plus size={16} />} {editingTask ? t("tasks.saveTask") : t("tasks.addTask")}
              </Button>
            </div>
          </div>
        )}
        <div className="search-field">
          <span data-role="icon"><Search size={15} /></span>
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
                <SelectItem value={priority} key={priority}>{taskPriorityLabel(priority, t)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="item-list task-list-scroll">
          {visibleTasks.map((task) => (
            <div
              role="button"
              tabIndex={0}
              className={`todo task-row selectable-row ${task.status === "complete" ? "done" : ""} ${task.id === selectedId ? "active" : ""}`}
              key={task.id}
              onClick={() => setSelectedId(task.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelectedId(task.id);
                }
              }}
            >
              <div className="row-between">
                <label className="row task-check">
                  {!readOnly && (
                    <span onClick={(event) => event.stopPropagation()}>
                      <Checkbox checked={task.status === "complete"} onCheckedChange={(checked) => onUpdate(task.id, { status: checked ? "complete" : "open" })} />
                    </span>
                  )}
                  <span className="todo-title">{task.title}</span>
                </label>
                <div className="row badge-row">
                  <Badge>{taskPriorityLabel(task.priority, t)}</Badge>
                  <Badge>{nodeLabel(nodes, task.ownerNodeId)}</Badge>
                </div>
              </div>
              {task.details && <p className="muted item-body">{task.details}</p>}
              <span className="muted task-date">{task.dueDate ? t("tasks.due", { date: formatDate(task.dueDate) }) : formatDate(task.completedAt ?? task.createdAt)}</span>
            </div>
          ))}
          {!visibleTasks.length && <EmptyState title={t("tasks.emptyTitle")} text={t("tasks.emptyText")} actionLabel={readOnly ? undefined : t("tasks.newTask")} onAction={newTask} />}
        </div>
      </Card>
      <Card className="stack inspector-panel">
        <div className="row-between">
          <h2>{selectedTask?.title ?? t("tasks.taskList")}</h2>
          {selectedTask && <Badge>{taskPriorityLabel(selectedTask.priority, t)}</Badge>}
        </div>
        {selectedTask ? (
          <>
            <div className="inspector-meta">
              <span>{nodeLabel(nodes, selectedTask.ownerNodeId)}</span>
              <span>{selectedTask.dueDate ? t("tasks.due", { date: formatDate(selectedTask.dueDate) }) : formatDate(selectedTask.completedAt ?? selectedTask.createdAt)}</span>
              <span>{selectedTask.status === "complete" ? t("status.complete") : t("status.open")}</span>
            </div>
            <div className="inspector-body">
              {selectedTask.details ? <p>{selectedTask.details}</p> : <p className="muted">{t("tasks.detailsPlaceholder")}</p>}
            </div>
            {!readOnly && (
              <div className="item-actions">
                <Button type="button" variant="secondary" size="sm" onClick={() => startEdit(selectedTask)}>
                  <Edit3 size={14} /> {t("common.edit")}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => onDelete(selectedTask.id)}>
                  <Trash2 size={14} /> {t("common.delete")}
                </Button>
              </div>
            )}
          </>
        ) : (
          <EmptyState title={t("tasks.emptyTitle")} text={t("tasks.emptyText")} />
        )}
      </Card>
    </div>
  );
}

function taskPriorityLabel(priority: "low" | "normal" | "high" | "urgent", t: (key: string) => string) {
  return t(`priority.${priority}`);
}

function toDateInput(dateValue: string) {
  return new Date(dateValue).toISOString().slice(0, 10);
}
