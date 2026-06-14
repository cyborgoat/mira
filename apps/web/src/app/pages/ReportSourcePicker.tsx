import { HelpCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { ReportSourceTask, ReportSources } from "../types";

type ReportSourcePickerProps = {
  sources: ReportSources | null;
  loading: boolean;
  selectedTaskIds: Set<string>;
  selectedNoteIds: Set<string>;
  onToggleTask: (id: string) => void;
  onToggleNote: (id: string) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
};

export function ReportSourcePicker({
  sources,
  loading,
  selectedTaskIds,
  selectedNoteIds,
  onToggleTask,
  onToggleNote,
  onSelectAll,
  onSelectNone,
}: ReportSourcePickerProps) {
  const { t } = useTranslation();

  if (loading && !sources) {
    return <p className="muted">{t("report.pickerLoading")}</p>;
  }

  if (!sources || (sources.tasks.length === 0 && sources.notes.length === 0)) {
    return <p className="muted">{t("report.pickerEmpty")}</p>;
  }

  return (
    <div className="report-source-picker">
      <div className="report-source-toolbar">
        <span className="report-source-label">{t("report.pickerLabel")}</span>
        <div className="row">
          <Button type="button" variant="ghost" size="sm" onClick={onSelectAll}>
            {t("report.pickerSelectAll")}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onSelectNone}>
            {t("report.pickerSelectNone")}
          </Button>
        </div>
      </div>

      <ul className="report-source-list">
        {sources.tasks.map((task) => (
          <ReportSourceItem
            key={task.id}
            item={task}
            checked={selectedTaskIds.has(task.id)}
            onToggle={() => onToggleTask(task.id)}
          />
        ))}
        {sources.notes.map((note) => (
          <li key={note.id} className="report-source-item">
            <label className="report-source-row">
              <input type="checkbox" checked={selectedNoteIds.has(note.id)} onChange={() => onToggleNote(note.id)} />
              <span className="report-source-title">{note.title}</span>
              <span className="report-source-meta">{t("report.pickerNote")}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReportSourceItem({
  item,
  checked,
  onToggle,
}: {
  item: ReportSourceTask;
  checked: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const uncertain = item.confidence === "uncertain";

  return (
    <li className={`report-source-item${uncertain ? " uncertain" : ""}`}>
      <label className="report-source-row">
        <input type="checkbox" checked={checked} onChange={onToggle} />
        <span className="report-source-title">{item.title}</span>
        {uncertain && (
          <span className="report-source-uncertain" title={t("report.pickerUncertainHint")}>
            <HelpCircle size={14} />
          </span>
        )}
        <span className="report-source-meta">
          {item.status === "complete" ? t("report.pickerCompleted") : t("report.pickerOpen")}
        </span>
      </label>
    </li>
  );
}
