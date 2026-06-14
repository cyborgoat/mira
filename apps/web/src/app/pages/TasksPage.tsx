import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { recordTaskPhrase, resolveLocalSuggestion, type LocalSuggestion } from "../localSuggestions";
import { TasksAiRefinePanel } from "./TasksAiRefinePanel";
import { sortTasksByPriority, TaskRow } from "./TaskRow";
import type { LocalTaskSuggestion, Task, TaskPriority, TaskRefineMessage, TaskRefineResult } from "../types";

type TasksViewProps = {
  tasks: Task[];
  isManager: boolean;
  onCreate: (payload: { title: string; details: string; priority: TaskPriority; dueDate?: string }) => Promise<void>;
  onUpdate: (id: string, payload: { status?: Task["status"] }) => Promise<void>;
  onLoadLocalSuggestion: () => Promise<LocalTaskSuggestion>;
  onRefineTasks: (payload: { language: "en" | "zh"; scope?: "personal" | "team"; messages: TaskRefineMessage[] }) => Promise<TaskRefineResult>;
};

export function TasksView({ tasks, isManager, onCreate, onUpdate, onLoadLocalSuggestion, onRefineTasks }: TasksViewProps) {
  const { t, i18n } = useTranslation();
  const language: "en" | "zh" = i18n.resolvedLanguage?.startsWith("zh") ? "zh" : "en";

  const [quickTitle, setQuickTitle] = useState("");
  const [suggestion, setSuggestion] = useState<LocalSuggestion | null>(null);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [aiSuggestLoading, setAiSuggestLoading] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const addInputRef = useRef<HTMLInputElement>(null);
  const suggestionRef = useRef<HTMLButtonElement>(null);

  const openTasks = sortTasksByPriority(tasks.filter((task) => task.status !== "complete"));

  const loadLocalSuggestion = useCallback(async () => {
    setSuggestionLoading(true);
    try {
      const next = await resolveLocalSuggestion(tasks, onLoadLocalSuggestion);
      setSuggestion(next);
    } catch {
      setSuggestion(null);
    } finally {
      setSuggestionLoading(false);
    }
  }, [onLoadLocalSuggestion, tasks]);

  const loadAiSuggestion = useCallback(async () => {
    setAiSuggestLoading(true);
    try {
      const result = await onRefineTasks({
        language,
        scope: "personal",
        messages: [{ role: "user", content: t("tasks.suggestionPrompt") }],
      });
      const next = result.suggestions[0];
      if (next) setSuggestion({ ...next, source: "ai" });
    } finally {
      setAiSuggestLoading(false);
    }
  }, [language, onRefineTasks, t]);

  useEffect(() => {
    addInputRef.current?.focus();
    void loadLocalSuggestion();
  }, [loadLocalSuggestion]);

  const handleQuickAdd = useCallback(
    async (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== "Enter") return;
      const title = quickTitle.trim();
      if (!title) return;
      recordTaskPhrase(title);
      await onCreate({ title, details: "", priority: "normal" });
      setQuickTitle("");
      void loadLocalSuggestion();
    },
    [quickTitle, onCreate, loadLocalSuggestion],
  );

  const acceptSuggestion = useCallback(async () => {
    if (!suggestion) return;
    recordTaskPhrase(suggestion.title);
    await onCreate({ title: suggestion.title, details: suggestion.details ?? "", priority: "normal" });
    setSuggestion(null);
    void loadLocalSuggestion();
    addInputRef.current?.focus();
  }, [suggestion, onCreate, loadLocalSuggestion]);

  const handleToggle = useCallback(
    (task: Task) => void onUpdate(task.id, { status: task.status === "complete" ? "open" : "complete" }),
    [onUpdate],
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Tab" && suggestion && document.activeElement === suggestionRef.current) {
        e.preventDefault();
        void acceptSuggestion();
      }
      if (e.key === "Escape" && suggestion) {
        setSuggestion(null);
        void loadLocalSuggestion();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [acceptSuggestion, loadLocalSuggestion, suggestion]);

  return (
    <div className={`tasks-input-shell${aiOpen ? " with-ai-refine" : ""}`}>
      <div className="tasks-input-main">
        <div className="tasks-input-header">
          <div>
            <h1>{t("nav.tasks")}</h1>
            <p className="muted">{t("tasks.listHint")}</p>
          </div>
          <Button type="button" variant="outline" size="sm" className={aiOpen ? "active" : ""} onClick={() => setAiOpen((v) => !v)}>
            <Sparkles size={15} /> {t("tasks.aiRefineTitle")}
          </Button>
        </div>

        <div className="reminders-card tasks-list-card">
          <div className="reminders-list">
            {openTasks.map((task) => (
              <TaskRow key={task.id} task={task} onToggle={handleToggle} />
            ))}

            <div className="reminder-add-row" onClick={() => addInputRef.current?.focus()}>
              <div className="reminder-circle-ghost" />
              <input
                ref={addInputRef}
                className="reminder-add-input"
                value={quickTitle}
                placeholder={t("tasks.addTask")}
                onChange={(e) => setQuickTitle(e.target.value)}
                onKeyDown={handleQuickAdd}
              />
            </div>

            <div className="task-suggestion-row-wrap">
              {(suggestion || suggestionLoading) && (
                <button
                  ref={suggestionRef}
                  type="button"
                  className="task-suggestion-row"
                  disabled={suggestionLoading || !suggestion}
                  onClick={() => void acceptSuggestion()}
                >
                  <div className="reminder-circle-ghost suggestion" />
                  <span className="task-suggestion-text">
                    {suggestionLoading
                      ? t("tasks.suggestionLoading")
                      : suggestion?.title ?? t("tasks.suggestionEmpty")}
                  </span>
                  {suggestion && <span className="task-suggestion-hint">{t("tasks.suggestionTabHint")}</span>}
                </button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="task-ai-suggest-btn"
                disabled={aiSuggestLoading || suggestionLoading}
                onClick={() => void loadAiSuggestion()}
                title={t("tasks.aiSuggestTitle")}
              >
                <Sparkles size={14} /> {aiSuggestLoading ? t("tasks.aiSuggestLoading") : t("tasks.aiSuggest")}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <TasksAiRefinePanel
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        isManager={isManager}
        onRefine={onRefineTasks}
        onAddSuggestion={async (item) => {
          recordTaskPhrase(item.title);
          await onCreate({ title: item.title, details: item.details ?? "", priority: "normal" });
          void loadLocalSuggestion();
        }}
      />
    </div>
  );
}
