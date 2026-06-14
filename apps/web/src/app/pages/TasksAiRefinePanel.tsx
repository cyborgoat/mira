import { useCallback, useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { TaskRefineMessage, TaskRefineResult } from "../types";

const STORAGE_KEY = "mira-tasks-ai-refine-v1";

type TasksAiRefinePanelProps = {
  open: boolean;
  onClose: () => void;
  isManager: boolean;
  onRefine: (payload: { language: "en" | "zh"; scope: "personal" | "team"; messages: TaskRefineMessage[] }) => Promise<TaskRefineResult>;
  onAddSuggestion: (payload: { title: string; details?: string }) => Promise<void>;
};

function loadChat(): TaskRefineMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as TaskRefineMessage[]) : [];
  } catch {
    return [];
  }
}

function saveChat(messages: TaskRefineMessage[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-40)));
}

export function TasksAiRefinePanel({ open, onClose, isManager, onRefine, onAddSuggestion }: TasksAiRefinePanelProps) {
  const { t, i18n } = useTranslation();
  const language: "en" | "zh" = i18n.resolvedLanguage?.startsWith("zh") ? "zh" : "en";
  const [messages, setMessages] = useState<TaskRefineMessage[]>(loadChat);
  const [input, setInput] = useState("");
  const [scope, setScope] = useState<"personal" | "team">("personal");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{ title: string; details?: string }>>([]);
  const [adding, setAdding] = useState<string | null>(null);

  useEffect(() => {
    if (open) setMessages(loadChat());
  }, [open]);

  const runRefine = useCallback(
    async (nextMessages: TaskRefineMessage[]) => {
      setLoading(true);
      try {
        const result = await onRefine({ language, scope, messages: nextMessages });
        const assistant: TaskRefineMessage = { role: "assistant", content: result.assistantMessage };
        const updated = [...nextMessages, assistant];
        setMessages(updated);
        saveChat(updated);
        setSuggestions(result.suggestions);
      } finally {
        setLoading(false);
      }
    },
    [language, onRefine, scope],
  );

  const handleGenerate = () => {
    const userMsg: TaskRefineMessage = {
      role: "user",
      content: t("tasks.aiRefineGeneratePrompt"),
    };
    const next = [...messages, userMsg];
    setMessages(next);
    saveChat(next);
    void runRefine(next);
  };

  const handleSend = () => {
    const text = input.trim();
    if (!text || loading) return;
    const userMsg: TaskRefineMessage = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    saveChat(next);
    setInput("");
    void runRefine(next);
  };

  const handleAdd = async (item: { title: string; details?: string }) => {
    setAdding(item.title);
    try {
      await onAddSuggestion(item);
    } finally {
      setAdding(null);
    }
  };

  const handleClear = () => {
    setMessages([]);
    setSuggestions([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  if (!open) return null;

  return (
    <div className="ai-refine-panel">
      <div className="ai-refine-header">
        <div className="ai-refine-title">
          <Sparkles size={16} />
          {t("tasks.aiRefineTitle")}
        </div>
        <div className="row">
          <Button type="button" variant="ghost" size="sm" onClick={handleClear}>
            {t("tasks.aiRefineClear")}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            <X size={16} />
          </Button>
        </div>
      </div>

      {isManager && (
        <div className="ai-refine-scope">
          <button type="button" className={scope === "personal" ? "active" : ""} onClick={() => setScope("personal")}>
            {t("mode.personal")}
          </button>
          <button type="button" className={scope === "team" ? "active" : ""} onClick={() => setScope("team")}>
            {t("mode.team")}
          </button>
        </div>
      )}

      <div className="ai-refine-actions-top">
        <Button type="button" size="sm" disabled={loading} onClick={handleGenerate}>
          {t("tasks.aiRefineGenerate")}
        </Button>
      </div>

      <div className="ai-refine-thread">
        {messages.length === 0 && <p className="muted">{t("tasks.aiRefineEmpty")}</p>}
        {messages.map((msg, index) => (
          <div key={index} className={`ai-refine-msg ${msg.role}`}>
            {msg.content}
          </div>
        ))}
        {loading && (
          <div className="clarify-loading">
            <span /><span /><span />
          </div>
        )}
      </div>

      {suggestions.length > 0 && (
        <div className="ai-refine-suggestions">
          <div className="ai-refine-suggestions-label">{t("tasks.aiRefineSuggestions")}</div>
          {suggestions.map((item) => (
            <div key={item.title} className="ai-refine-suggestion">
              <div>
                <strong>{item.title}</strong>
                {item.details && <p className="muted">{item.details}</p>}
              </div>
              <Button type="button" size="sm" disabled={adding === item.title} onClick={() => void handleAdd(item)}>
                {t("tasks.aiRefineAdd")}
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="ai-refine-compose">
        <Textarea
          value={input}
          placeholder={t("tasks.aiRefineInputPlaceholder")}
          className="compact"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <Button type="button" size="sm" disabled={loading || !input.trim()} onClick={handleSend}>
          {t("tasks.aiRefineSend")}
        </Button>
      </div>
    </div>
  );
}
