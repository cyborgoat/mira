import type { Task, TaskPriority } from "../types";

type TaskRowProps = {
  task: Task;
  onToggle: (task: Task) => void;
};

export function formatTaskDue(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  const days = Math.round(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days < 7) return `In ${days}d`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function TaskRow({ task, onToggle }: TaskRowProps) {
  const isDone = task.status === "complete";

  return (
    <div className={`reminder-item${isDone ? " is-done" : ""}`}>
      <div className="reminder-item-main">
        <button
          type="button"
          className={`reminder-circle priority-${task.priority}${isDone ? " is-checked" : ""}`}
          onClick={() => onToggle(task)}
          aria-label={isDone ? "Mark as incomplete" : "Mark as complete"}
        />
        <div className="reminder-content">
          <span className={`reminder-title${isDone ? " is-done-text" : ""}`}>{task.title}</span>
          {task.details && (
            <span className="reminder-detail">{task.details.slice(0, 120)}{task.details.length > 120 ? "…" : ""}</span>
          )}
          {task.dueDate && (
            <span className="reminder-due">{formatTaskDue(task.dueDate)}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export const PRIORITY_ORDER: Record<TaskPriority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

export function sortTasksByPriority(tasks: Task[]) {
  return [...tasks].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
}
