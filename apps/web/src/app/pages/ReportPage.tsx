import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ReportAiRefinePanel } from "./ReportAiRefinePanel";
import { ReportPreview } from "./ReportPreview";
import { ReportSourcePicker } from "./ReportSourcePicker";
import type {
  Period,
  ReportGenerateResult,
  ReportRefineMessage,
  ReportRefineResult,
  ReportSources,
  ReportStylePreset,
} from "../types";

type ReportViewProps = {
  isManager: boolean;
  onLoadReportSources: (payload: { period: Period; scope?: "personal" | "team" }) => Promise<ReportSources>;
  onAssembleReport: (payload: {
    period: Period;
    scope?: "personal" | "team";
    language: "en" | "zh";
    includedTaskIds?: string[];
    includedNoteIds?: string[];
  }) => Promise<ReportGenerateResult>;
  onGenerateReport: (payload: {
    period: Period;
    scope?: "personal" | "team";
    language: "en" | "zh";
    includedTaskIds?: string[];
    includedNoteIds?: string[];
    stylePreset?: ReportStylePreset;
  }) => Promise<ReportGenerateResult>;
  onRefineReport: (payload: {
    language: "en" | "zh";
    period: Period;
    scope?: "personal" | "team";
    draft: string;
    message: string;
    messages?: ReportRefineMessage[];
    stylePreset?: ReportStylePreset;
  }) => Promise<ReportRefineResult>;
};

function draftKey(period: Period) {
  return `mira-report-draft-${period}`;
}

function loadDraft(period: Period) {
  return localStorage.getItem(draftKey(period)) ?? "";
}

function saveDraft(period: Period, value: string) {
  localStorage.setItem(draftKey(period), value);
}

function defaultSelection(sources: ReportSources) {
  const taskIds = new Set(
    sources.tasks.filter((t) => t.status === "complete" && t.confidence === "high").map((t) => t.id),
  );
  return { taskIds, noteIds: new Set<string>() };
}

const STYLE_PROMPTS: Record<ReportStylePreset, string> = {
  concise: "Make this report shorter and more concise while keeping key facts.",
  value: "Emphasize business value, outcomes, and client impact.",
  effort: "Highlight depth of effort, challenges overcome, and work invested.",
};

export function ReportView({
  isManager,
  onLoadReportSources,
  onAssembleReport,
  onGenerateReport,
  onRefineReport,
}: ReportViewProps) {
  const { t, i18n } = useTranslation();
  const language: "en" | "zh" = i18n.resolvedLanguage?.startsWith("zh") ? "zh" : "en";

  const [period, setPeriod] = useState<Period>("weekly");
  const [scope, setScope] = useState<"personal" | "team">("personal");
  const [sources, setSources] = useState<ReportSources | null>(null);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState(() => loadDraft("weekly"));
  const [assembling, setAssembling] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [styleLoading, setStyleLoading] = useState<ReportStylePreset | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const assembleTimer = useRef<number | null>(null);

  const selectionKey = useMemo(
    () => `${period}:${scope}:${[...selectedTaskIds].sort().join(",")}:${[...selectedNoteIds].sort().join(",")}`,
    [period, scope, selectedTaskIds, selectedNoteIds],
  );

  const hasSelection = selectedTaskIds.size + selectedNoteIds.size > 0;

  useEffect(() => {
    let cancelled = false;
    setSourcesLoading(true);
    void onLoadReportSources({ period, scope })
      .then((data) => {
        if (cancelled) return;
        setSources(data);
        const defaults = defaultSelection(data);
        setSelectedTaskIds(defaults.taskIds);
        setSelectedNoteIds(defaults.noteIds);
      })
      .finally(() => {
        if (!cancelled) setSourcesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [onLoadReportSources, period, scope]);

  useEffect(() => {
    setDraft(loadDraft(period));
  }, [period]);

  const handleDraftChange = useCallback(
    (value: string) => {
      setDraft(value);
      saveDraft(period, value);
    },
    [period],
  );

  const runAssemble = useCallback(async () => {
    if (!hasSelection) return;
    setAssembling(true);
    try {
      const result = await onAssembleReport({
        period,
        scope,
        language,
        includedTaskIds: [...selectedTaskIds],
        includedNoteIds: [...selectedNoteIds],
      });
      handleDraftChange(result.answer);
    } finally {
      setAssembling(false);
    }
  }, [handleDraftChange, hasSelection, language, onAssembleReport, period, scope, selectedNoteIds, selectedTaskIds]);

  const runAiGenerate = useCallback(async () => {
    if (!hasSelection) return;
    setAiGenerating(true);
    try {
      const result = await onGenerateReport({
        period,
        scope,
        language,
        includedTaskIds: [...selectedTaskIds],
        includedNoteIds: [...selectedNoteIds],
      });
      handleDraftChange(result.answer);
    } finally {
      setAiGenerating(false);
    }
  }, [handleDraftChange, hasSelection, language, onGenerateReport, period, scope, selectedNoteIds, selectedTaskIds]);

  useEffect(() => {
    if (sourcesLoading || !hasSelection) return;
    if (assembleTimer.current) window.clearTimeout(assembleTimer.current);
    assembleTimer.current = window.setTimeout(() => {
      void runAssemble();
    }, 450);
    return () => {
      if (assembleTimer.current) window.clearTimeout(assembleTimer.current);
    };
  }, [hasSelection, runAssemble, selectionKey, sourcesLoading]);

  const handlePeriodChange = (next: Period) => {
    saveDraft(period, draft);
    setPeriod(next);
  };

  const handleStyle = async (preset: ReportStylePreset) => {
    if (!draft.trim()) return;
    setStyleLoading(preset);
    try {
      const result = await onRefineReport({
        language,
        period,
        scope,
        draft,
        message: STYLE_PROMPTS[preset],
        stylePreset: preset,
      });
      handleDraftChange(result.revisedDraft);
    } finally {
      setStyleLoading(null);
    }
  };

  const handleCopy = async () => {
    if (!draft.trim()) return;
    await navigator.clipboard.writeText(draft);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const handleRefine = useCallback(
    (payload: {
      language: "en" | "zh";
      period: Period;
      scope: "personal" | "team";
      draft: string;
      message: string;
      messages: ReportRefineMessage[];
    }) => onRefineReport(payload),
    [onRefineReport],
  );

  const handleSelectAll = () => {
    if (!sources) return;
    setSelectedTaskIds(new Set(sources.tasks.map((t) => t.id)));
    setSelectedNoteIds(new Set(sources.notes.map((n) => n.id)));
  };

  const handleSelectNone = () => {
    setSelectedTaskIds(new Set());
    setSelectedNoteIds(new Set());
  };

  return (
    <div className={`report-split-layout${aiOpen ? " with-refine-overlay" : ""}`}>
      <div className="report-editor-header">
        <div>
          <h1>{t("nav.report")}</h1>
          <p className="muted">{t("report.splitHint")}</p>
        </div>
        <div className="row">
          <div className="report-period-tabs">
            {(["daily", "weekly", "monthly"] as Period[]).map((p) => (
              <button key={p} type="button" className={period === p ? "active" : ""} onClick={() => handlePeriodChange(p)}>
                {t(`period.${p}`)}
              </button>
            ))}
          </div>
          {isManager && (
            <div className="report-period-tabs">
              <button type="button" className={scope === "personal" ? "active" : ""} onClick={() => setScope("personal")}>
                {t("mode.personal")}
              </button>
              <button type="button" className={scope === "team" ? "active" : ""} onClick={() => setScope("team")}>
                {t("mode.team")}
              </button>
            </div>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={() => void handleCopy()} disabled={!draft.trim()}>
            <Copy size={15} /> {copied ? t("report.copied") : t("report.copy")}
          </Button>
        </div>
      </div>

      <div className="report-split-body">
        <div className="report-picker-pane">
          <ReportSourcePicker
            sources={sources}
            loading={sourcesLoading}
            selectedTaskIds={selectedTaskIds}
            selectedNoteIds={selectedNoteIds}
            onToggleTask={(id) =>
              setSelectedTaskIds((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              })
            }
            onToggleNote={(id) =>
              setSelectedNoteIds((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              })
            }
            onSelectAll={handleSelectAll}
            onSelectNone={handleSelectNone}
          />
        </div>

        <ReportPreview
          draft={draft}
          assembling={assembling}
          aiGenerating={aiGenerating}
          canGenerateAi={hasSelection}
          onDraftChange={handleDraftChange}
          onStyle={(preset) => void handleStyle(preset)}
          onOpenRefine={() => setAiOpen(true)}
          onGenerateAi={() => void runAiGenerate()}
          styleLoading={styleLoading}
        />
      </div>

      {aiOpen && (
        <div className="report-refine-overlay">
          <ReportAiRefinePanel
            open={aiOpen}
            onClose={() => setAiOpen(false)}
            isManager={isManager}
            period={period}
            scope={scope}
            draft={draft}
            onPeriodChange={handlePeriodChange}
            onScopeChange={setScope}
            onDraftChange={handleDraftChange}
            onGenerate={(payload) =>
              onGenerateReport({
                ...payload,
                includedTaskIds: [...selectedTaskIds],
                includedNoteIds: [...selectedNoteIds],
              })
            }
            onRefine={handleRefine}
          />
        </div>
      )}
    </div>
  );
}
