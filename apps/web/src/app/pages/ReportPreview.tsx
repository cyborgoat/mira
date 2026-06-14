import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { renderMarkdown } from "../helpers";
import type { ReportStylePreset } from "../types";

type ReportPreviewProps = {
  draft: string;
  assembling: boolean;
  aiGenerating: boolean;
  canGenerateAi: boolean;
  onDraftChange: (value: string) => void;
  onStyle: (preset: ReportStylePreset) => void;
  onOpenRefine: () => void;
  onGenerateAi: () => void;
  styleLoading: ReportStylePreset | null;
};

export function ReportPreview({
  draft,
  assembling,
  aiGenerating,
  canGenerateAi,
  onDraftChange,
  onStyle,
  onOpenRefine,
  onGenerateAi,
  styleLoading,
}: ReportPreviewProps) {
  const { t } = useTranslation();
  const loading = assembling || aiGenerating;

  return (
    <div className="report-preview-pane">
      <div className="report-preview-header">
        <span className="report-preview-label">{t("report.previewLabel")}</span>
        <div className="report-preview-actions">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canGenerateAi || loading}
            onClick={onGenerateAi}
            title={t("report.generateWithAi")}
          >
            <Sparkles size={15} /> {aiGenerating ? t("report.generatingWithAi") : t("report.generateWithAi")}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onOpenRefine} title={t("report.aiRefineTitle")}>
            <Sparkles size={16} />
          </Button>
        </div>
      </div>

      <div className="report-preview-body">
        {loading && !draft && (
          <div className="clarify-loading">
            <span /><span /><span />
          </div>
        )}
        {draft ? (
          <div
            className="report-preview-markdown"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(draft) }}
          />
        ) : (
          !loading && <p className="muted">{t("report.previewEmpty")}</p>
        )}
      </div>

      <textarea
        className="report-preview-edit"
        value={draft}
        placeholder={t("report.editorPlaceholder")}
        onChange={(e) => onDraftChange(e.target.value)}
      />

      <div className="report-style-bar">
        <Button type="button" size="sm" variant="outline" disabled={!draft || styleLoading !== null} onClick={() => onStyle("concise")}>
          {styleLoading === "concise" ? "…" : t("report.styleConcise")}
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={!draft || styleLoading !== null} onClick={() => onStyle("value")}>
          {styleLoading === "value" ? "…" : t("report.styleValue")}
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={!draft || styleLoading !== null} onClick={() => onStyle("effort")}>
          {styleLoading === "effort" ? "…" : t("report.styleEffort")}
        </Button>
      </div>
    </div>
  );
}
