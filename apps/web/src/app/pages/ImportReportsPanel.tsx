import { ChangeEvent, useEffect, useRef, useState } from "react";
import { CheckCircle2, FileText, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ReportColdStartResult, ReportProfile } from "../types";

const ACCEPTED_REPORT_TYPES = [".md", ".markdown", ".txt"];

type ImportReportsPanelProps = {
  onLoadReportProfile: () => Promise<ReportProfile>;
  onUploadReportHistory: (files: Array<{ filename: string; content: string }>) => Promise<{ count: number }>;
  onProcessReportColdStart: (language: "en" | "zh") => Promise<ReportColdStartResult>;
  onAfterColdStart?: () => Promise<void>;
  onImportComplete?: () => void;
};

export function ImportReportsPanel({
  onLoadReportProfile,
  onUploadReportHistory,
  onProcessReportColdStart,
  onAfterColdStart,
  onImportComplete,
}: ImportReportsPanelProps) {
  const { t, i18n: i18nInstance } = useTranslation();
  const language = i18nInstance.resolvedLanguage?.startsWith("zh") ? "zh" : "en";
  const [profile, setProfile] = useState<ReportProfile | null>(null);
  const [pendingFiles, setPendingFiles] = useState<Array<{ filename: string; content: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ReportColdStartResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const refreshProfile = async () => {
    setLoadingProfile(true);
    try {
      setProfile(await onLoadReportProfile());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    void refreshProfile();
  }, [onLoadReportProfile]);

  const handleFilePick = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files?.length) return;
    const next: Array<{ filename: string; content: string }> = [];
    for (const file of Array.from(files)) {
      const lower = file.name.toLowerCase();
      if (!ACCEPTED_REPORT_TYPES.some((ext) => lower.endsWith(ext))) continue;
      next.push({ filename: file.name, content: await file.text() });
    }
    setPendingFiles(next);
    setResult(null);
    setError("");
    event.target.value = "";
  };

  const processColdStart = async () => {
    if (!pendingFiles.length || busy) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      await onUploadReportHistory(pendingFiles);
      const processed = await onProcessReportColdStart(language);
      setPendingFiles([]);
      setResult(processed);
      await refreshProfile();
      if (onAfterColdStart) await onAfterColdStart();
      onImportComplete?.();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tasks-import-panel stack">
      <div className="row-between tasks-import-status">
        <div>
          <strong>{t("tasks.importReports.statusTitle")}</strong>
          <p className="muted">{t("tasks.importReports.statusText")}</p>
        </div>
        {profile?.ready ? (
          <Badge className="cold-start-ready-badge">
            <CheckCircle2 size={14} /> {t("tasks.importReports.profileReady")}
          </Badge>
        ) : (
          <Badge variant="secondary">{t("tasks.importReports.profilePending")}</Badge>
        )}
      </div>

      {!loadingProfile && profile ? (
        <div className="cold-start-stats">
          <div className="cold-start-stat">
            <span className="muted">{t("tasks.importReports.samples")}</span>
            <strong>{profile.sampleCount}</strong>
          </div>
          <div className="cold-start-stat">
            <span className="muted">{t("tasks.importReports.importedTasks")}</span>
            <strong>{profile.importedTaskCount}</strong>
          </div>
          <div className="cold-start-stat">
            <span className="muted">{t("tasks.importReports.uploadedReports")}</span>
            <strong>{profile.rawReportCount}</strong>
          </div>
        </div>
      ) : null}

      {profile?.toneSummary ? <p className="cold-start-tone">{profile.toneSummary}</p> : null}

      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.markdown,.txt"
        multiple
        hidden
        onChange={(event) => void handleFilePick(event)}
      />
      <div className="row cold-start-actions">
        <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
          <Upload size={15} /> {t("tasks.importReports.chooseFiles")}
        </Button>
        <Button type="button" disabled={!pendingFiles.length || busy} onClick={() => void processColdStart()}>
          {busy ? t("tasks.importReports.processing") : t("tasks.importReports.analyze")}
        </Button>
      </div>

      {pendingFiles.length ? (
        <ul className="cold-start-file-list">
          {pendingFiles.map((file) => (
            <li key={file.filename}>
              <FileText size={15} />
              <span>{file.filename}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted cold-start-hint">{t("tasks.importReports.fileHint")}</p>
      )}

      {result ? (
        <div className="cold-start-result">
          {t("tasks.importReports.done", {
            imported: result.imported,
            skipped: result.skipped,
          })}
        </div>
      ) : null}
      {error ? <div className="form-error">{error}</div> : null}
    </div>
  );
}

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : "Failed to process reports";
}
