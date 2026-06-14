import type { Task, LocalTaskSuggestion } from "./types";

const PHRASE_KEY = "mira-task-phrases-v1";

type StoredPhrase = {
  title: string;
  count: number;
  lastUsedAt: string;
};

export type LocalSuggestion = {
  title: string;
  details?: string;
  source: "phrase" | "task" | "note" | "ai";
};

function readPhrases(): StoredPhrase[] {
  try {
    const raw = localStorage.getItem(PHRASE_KEY);
    return raw ? (JSON.parse(raw) as StoredPhrase[]) : [];
  } catch {
    return [];
  }
}

function writePhrases(phrases: StoredPhrase[]) {
  localStorage.setItem(PHRASE_KEY, JSON.stringify(phrases.slice(0, 100)));
}

export function recordTaskPhrase(title: string) {
  const normalized = title.trim();
  if (!normalized) return;
  const key = normalized.toLowerCase();
  const phrases = readPhrases();
  const existing = phrases.find((phrase) => phrase.title.toLowerCase() === key);
  if (existing) {
    existing.count += 1;
    existing.lastUsedAt = new Date().toISOString();
  } else {
    phrases.push({ title: normalized, count: 1, lastUsedAt: new Date().toISOString() });
  }
  phrases.sort((left, right) => right.count - left.count || right.lastUsedAt.localeCompare(left.lastUsedAt));
  writePhrases(phrases);
}

function pickPhraseSuggestion(openTitles: Set<string>): LocalSuggestion | null {
  const phrase = readPhrases().find((entry) => !openTitles.has(entry.title.toLowerCase()));
  if (!phrase) return null;
  return { title: phrase.title, source: "phrase" };
}

function pickTaskSuggestion(tasks: Task[]): LocalSuggestion | null {
  const now = new Date();
  const openTasks = tasks.filter((task) => task.status !== "complete");
  const ranked = [...openTasks].sort((left, right) => {
    const leftOverdue = left.dueDate && new Date(left.dueDate) < now ? 1 : 0;
    const rightOverdue = right.dueDate && new Date(right.dueDate) < now ? 1 : 0;
    if (leftOverdue !== rightOverdue) return rightOverdue - leftOverdue;
    const priorityRank = (priority: Task["priority"]) => (priority === "high" ? 2 : priority === "normal" ? 1 : 0);
    return priorityRank(right.priority) - priorityRank(left.priority);
  });
  const task = ranked[0];
  if (!task) return null;
  return { title: task.title, details: task.details || undefined, source: "task" };
}

export async function resolveLocalSuggestion(
  tasks: Task[],
  loadRemote: () => Promise<LocalTaskSuggestion>,
): Promise<LocalSuggestion | null> {
  const openTitles = new Set(
    tasks.filter((task) => task.status !== "complete").map((task) => task.title.trim().toLowerCase()).filter(Boolean),
  );

  const phraseSuggestion = pickPhraseSuggestion(openTitles);
  if (phraseSuggestion) return phraseSuggestion;

  try {
    const remote = await loadRemote();
    if (remote.title.trim()) {
      return {
        title: remote.title,
        details: remote.details,
        source: remote.source,
      };
    }
  } catch {
    // fall through to client-side task heuristic
  }

  return pickTaskSuggestion(tasks);
}
