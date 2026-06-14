import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { renderMarkdown } from "../helpers";
import type { ReportStylePreset } from "../types";

type ReportPreviewProps = {
  draft: string;
  generating: boolean;
  onDraftChange: (value: string) => void;
  onStyle: (preset: ReportStylePreset) => void;
  onOpenRefine: () => void;
  styleLoading: ReportStylePreset | null;
};

export function ReportPreview({ draft, generating, onDraftChange, onStyle, onOpenRefine, styleLoading }: ReportPreviewProps) {
  const { t } = useTranslation();

  return (
    <div className="report-preview-pane">
      <div className="report-preview-header">
        <span className="report-preview-label">{t("report.previewLabel")}</span>
        <Button type="button" variant="ghost" size="sm" onClick={onOpenRefine} title={t("report.aiRefineTitle")}>
          <Sparkles size={16} />
        </Button>
      </div>

      <div className="report-preview-body">
        {generating && !draft && (
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
          !generating && <p className="muted">{t("report.previewEmpty")}</p>
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
