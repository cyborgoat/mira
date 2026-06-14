import { useCallback, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Period, ReportGenerateResult, ReportRefineMessage, ReportRefineResult } from "../types";

type ReportAiRefinePanelProps = {
  open: boolean;
  onClose: () => void;
  isManager: boolean;
  period: Period;
  scope: "personal" | "team";
  draft: string;
  onPeriodChange: (period: Period) => void;
  onScopeChange: (scope: "personal" | "team") => void;
  onDraftChange: (draft: string) => void;
  onGenerate: (payload: { period: Period; scope: "personal" | "team"; language: "en" | "zh" }) => Promise<ReportGenerateResult>;
  onRefine: (payload: {
    language: "en" | "zh";
    period: Period;
    scope: "personal" | "team";
    draft: string;
    message: string;
    messages: ReportRefineMessage[];
  }) => Promise<ReportRefineResult>;
};

export function ReportAiRefinePanel({
  open,
  onClose,
  isManager,
  period,
  scope,
  draft,
  onPeriodChange,
  onScopeChange,
  onDraftChange,
  onGenerate,
  onRefine,
}: ReportAiRefinePanelProps) {
  const { t, i18n } = useTranslation();
  const language: "en" | "zh" = i18n.resolvedLanguage?.startsWith("zh") ? "zh" : "en";
  const [messages, setMessages] = useState<ReportRefineMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastReply, setLastReply] = useState("");

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    try {
      const result = await onGenerate({ period, scope, language });
      onDraftChange(result.answer);
      setLastReply(t("report.aiRefineGenerated"));
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [language, onDraftChange, onGenerate, period, scope, t]);

  const handleRevise = useCallback(async () => {
    const text = input.trim();
    if (!text || !draft.trim()) return;
    setLoading(true);
    try {
      const result = await onRefine({
        language,
        period,
        scope,
        draft,
        message: text,
        messages,
      });
      onDraftChange(result.revisedDraft);
      const userMsg: ReportRefineMessage = { role: "user", content: text };
      const assistantMsg: ReportRefineMessage = { role: "assistant", content: result.assistantMessage };
      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setLastReply(result.assistantMessage);
      setInput("");
    } finally {
      setLoading(false);
    }
  }, [draft, input, language, messages, onDraftChange, onRefine, period, scope]);

  if (!open) return null;

  return (
    <div className="ai-refine-panel">
      <div className="ai-refine-header">
        <div className="ai-refine-title">
          <Sparkles size={16} />
          {t("report.aiRefineTitle")}
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          <X size={16} />
        </Button>
      </div>

      <div className="ai-refine-scope">
        {(["daily", "weekly", "monthly"] as Period[]).map((p) => (
          <button key={p} type="button" className={period === p ? "active" : ""} onClick={() => onPeriodChange(p)}>
            {t(`period.${p}`)}
          </button>
        ))}
      </div>

      {isManager && (
        <div className="ai-refine-scope">
          <button type="button" className={scope === "personal" ? "active" : ""} onClick={() => onScopeChange("personal")}>
            {t("mode.personal")}
          </button>
          <button type="button" className={scope === "team" ? "active" : ""} onClick={() => onScopeChange("team")}>
            {t("mode.team")}
          </button>
        </div>
      )}

      <div className="ai-refine-actions-top">
        <Button type="button" size="sm" disabled={loading} onClick={() => void handleGenerate()}>
          {t("report.aiRefineGenerate")}
        </Button>
      </div>

      {lastReply && <p className="ai-refine-status muted">{lastReply}</p>}

      <div className="ai-refine-thread">
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

      <div className="ai-refine-compose">
        <Textarea
          value={input}
          placeholder={t("report.aiRefineInputPlaceholder")}
          className="compact"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleRevise();
            }
          }}
        />
        <Button type="button" size="sm" disabled={loading || !input.trim() || !draft.trim()} onClick={() => void handleRevise()}>
          {t("report.aiRefineRevise")}
        </Button>
      </div>
    </div>
  );
}
