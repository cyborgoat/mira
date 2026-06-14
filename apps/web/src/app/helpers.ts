import i18n from "@/i18n";
import type { Task, MeetingNote, TeamNode, TaskPriority, WorkspaceExport, TaskStatus } from "./types";

const LEGACY_ROUTE_ALIASES: Record<string, string> = {
  "ask-mira": "report",
  "report-import": "my-work",
  "cold-start": "my-work",
  "tasks/import": "my-work",
  "mira-ask": "my-work",
  "task-graph": "my-work",
};

export function resolveRouteFromHash<T extends string>(nav: readonly T[], fallback: T): T {
  const raw = window.location.hash.replace(/^#\/?/, "");
  const base = raw.split("/")[0];
  const hash = LEGACY_ROUTE_ALIASES[raw] ?? LEGACY_ROUTE_ALIASES[base] ?? base;
  return (nav as readonly string[]).includes(hash) ? (hash as T) : fallback;
}

export function buildStats(tasks: Task[], notes: MeetingNote[]) {
  const completedTasks = tasks.filter((task) => task.status === "complete").length;
  const noteWords = notes.reduce((total, note) => total + wordCount(note.content), 0);
  return { tasks: tasks.length, completedTasks, notes: notes.length, noteWords, completionRate: tasks.length ? Math.round((completedTasks / tasks.length) * 100) : 0 };
}

export function buildTreeRows(nodes: TeamNode[]) {
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

export function sortNodesForImport(nodes: TeamNode[]) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const depthOf = (node: TeamNode): number => (node.parentId && byId.get(node.parentId) ? depthOf(byId.get(node.parentId)!) + 1 : 0);
  return [...nodes].sort((a, b) => depthOf(a) - depthOf(b) || a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export function sortNodesForDelete(nodes: TeamNode[]) {
  return sortNodesForImport(nodes).reverse();
}

export function nodePath(nodes: TeamNode[], node: TeamNode) {
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

export function formatDate(dateValue: string) {
  return new Intl.DateTimeFormat(i18n.language === "zh" ? "zh-CN" : undefined, { month: "short", day: "numeric" }).format(new Date(dateValue));
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function priorityLabel(priority: TaskPriority, t: (key: string) => string) {
  return t(`priority.${priority}`);
}

function wordCount(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

export function renderMarkdown(markdown: string) {
  const escaped = markdown.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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

export function renderInlineMarkdown(value: string) {
  return value
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|mailto:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
}

export function parseWorkspaceExport(text: string): WorkspaceExport {
  try {
    const parsed = JSON.parse(text);
    if (!parsed || !Array.isArray(parsed.teamNodes) || !Array.isArray(parsed.tasks) || !Array.isArray(parsed.notes)) throw new Error();
    return parsed as WorkspaceExport;
  } catch {
    throw new Error(i18n.t("errors.invalidWorkspace"));
  }
}

export function downloadJson(payload: WorkspaceExport) {
  downloadBlob(JSON.stringify(payload, null, 2), `mira-workspace-${today()}.json`, "application/json");
}

export function downloadBlob(value: string, filename: string, type: string) {
  const blob = new Blob([value], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : i18n.t("errors.generic");
}
