import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ImportReportsPanel } from "./ImportReportsPanel";
import type { ReportColdStartResult, ReportProfile, WorkArchive, WorkArchiveProject, WorkArchiveWeek } from "../types";

type MyWorkViewProps = {
  onLoadArchive: () => Promise<WorkArchive>;
  onLoadReportProfile: () => Promise<ReportProfile>;
  onUploadReportHistory: (files: Array<{ filename: string; content: string }>) => Promise<{ count: number }>;
  onProcessReportColdStart: (language: "en" | "zh") => Promise<ReportColdStartResult>;
  onAfterColdStart?: () => Promise<void>;
};

export function MyWorkView({
  onLoadArchive,
  onLoadReportProfile,
  onUploadReportHistory,
  onProcessReportColdStart,
  onAfterColdStart,
}: MyWorkViewProps) {
  const { t } = useTranslation();
  const [archive, setArchive] = useState<WorkArchive | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<WorkArchiveWeek | null>(null);
  const [selectedProject, setSelectedProject] = useState<WorkArchiveProject | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void onLoadArchive()
      .then((data) => {
        if (!cancelled) setArchive(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [onLoadArchive]);

  const weeks = archive?.weeks.slice(0, 3) ?? [];
  const projects = archive?.projects.slice(0, 3) ?? [];

  return (
    <div className="my-work-archive">
      {loading && <p className="muted">{t("myWork.loading")}</p>}

      {!loading && (
        <>
          <section className="my-work-section">
            <div className="my-work-section-header">
              <h2>{t("myWork.weeksTitle")}</h2>
              {archive && archive.weeks.length > 3 && (
                <button type="button" className="my-work-see-all" onClick={() => setSelectedWeek(archive.weeks[3] ?? null)}>
                  {t("myWork.seeAll")}
                </button>
              )}
            </div>
            <div className="my-work-grid">
              {weeks.length === 0 ? (
                <p className="muted">{t("myWork.emptyWeeks")}</p>
              ) : (
                weeks.map((week) => (
                  <button key={week.weekStart} type="button" className="week-card" onClick={() => setSelectedWeek(week)}>
                    <span className="week-card-label">{week.label}</span>
                    <span className="week-card-count">{t("myWork.taskCount", { count: week.taskCount })}</span>
                    <span className="week-card-preview">{week.preview || t("myWork.noPreview")}</span>
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="my-work-section">
            <div className="my-work-section-header">
              <h2>{t("myWork.projectsTitle")}</h2>
              {archive && archive.projects.length > 3 && (
                <button type="button" className="my-work-see-all" onClick={() => setSelectedProject(archive.projects[3] ?? null)}>
                  {t("myWork.seeAll")}
                </button>
              )}
            </div>
            <div className="my-work-grid">
              {projects.length === 0 ? (
                <p className="muted">{t("myWork.emptyProjects")}</p>
              ) : (
                projects.map((project, index) => (
                  <button key={project.tag} type="button" className="project-card" onClick={() => setSelectedProject(project)}>
                    <span className="project-card-label">{project.tag || t("myWork.projectFallback", { n: index + 1 })}</span>
                    <span className="project-card-meta">
                      {t("myWork.projectMeta", { tasks: project.taskCount, notes: project.noteCount })}
                    </span>
                  </button>
                ))
              )}
              {projects.length < 3 &&
                Array.from({ length: 3 - projects.length }).map((_, i) => (
                  <div key={`placeholder-${i}`} className="project-card placeholder">
                    <span className="project-card-label">{t("myWork.projectFallback", { n: projects.length + i + 1 })}</span>
                    <span className="muted">{t("myWork.projectPlaceholder")}</span>
                  </div>
                ))}
            </div>
          </section>
        </>
      )}

      <Button type="button" className="upload-fab" onClick={() => setUploadOpen(true)} aria-label={t("myWork.uploadSection")}>
        <Plus size={22} />
      </Button>

      {uploadOpen && (
        <div className="my-work-upload-modal">
          <div className="my-work-upload-dialog">
            <div className="my-work-upload-header">
              <h3>{t("myWork.uploadSection")}</h3>
              <Button type="button" variant="ghost" size="sm" onClick={() => setUploadOpen(false)}>
                <X size={16} />
              </Button>
            </div>
            <ImportReportsPanel
              onLoadReportProfile={onLoadReportProfile}
              onUploadReportHistory={onUploadReportHistory}
              onProcessReportColdStart={onProcessReportColdStart}
              onAfterColdStart={async () => {
                await onAfterColdStart?.();
                setArchive(await onLoadArchive());
                setUploadOpen(false);
              }}
            />
          </div>
        </div>
      )}

      {(selectedWeek || selectedProject) && (
        <div className="my-work-upload-modal" onClick={() => { setSelectedWeek(null); setSelectedProject(null); }}>
          <div className="my-work-upload-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="my-work-upload-header">
              <h3>{selectedWeek ? selectedWeek.label : selectedProject?.tag}</h3>
              <Button type="button" variant="ghost" size="sm" onClick={() => { setSelectedWeek(null); setSelectedProject(null); }}>
                <X size={16} />
              </Button>
            </div>
            {selectedWeek && (
              <>
                <p className="muted">{selectedWeek.weekStart}</p>
                <p>{selectedWeek.preview || t("myWork.noPreview")}</p>
                <p>{t("myWork.taskCount", { count: selectedWeek.taskCount })}</p>
              </>
            )}
            {selectedProject && (
              <p>{t("myWork.projectMeta", { tasks: selectedProject.taskCount, notes: selectedProject.noteCount })}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
