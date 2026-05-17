import { CheckCircle2, Download, ListChecks } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buildStats, exportSummaryMarkdown, firstLines, formatDate, nodeLabel } from "../helpers";
import { StatsGrid } from "../shared";
import type { Period, Task, TeamNode, WorkView } from "../types";

type StatsViewProps = {
  view: WorkView | null;
  period: Period;
  nodes: TeamNode[];
  showOwners: boolean;
};

type SummaryItem = {
  id: string;
  date: string;
  title: string;
  eyebrow?: string;
  body?: string;
};

export function StatsView({ view, period, nodes, showOwners }: StatsViewProps) {
  const { t } = useTranslation();
  const tasks = view?.tasks ?? [];
  const notes = view?.notes ?? [];
  const completedTasks = tasks.filter((task) => task.status === "complete");
  const openTasks = tasks.filter((task) => task.status === "open");
  const taskItems = (items: Task[]) => items.map((task) => ({
    id: task.id,
    date: task.completedAt ?? task.dueDate ?? task.createdAt,
    title: task.title,
    eyebrow: showOwners ? nodeLabel(nodes, task.ownerNodeId) : undefined,
    body: task.details,
  }));
  const noteItems = notes.map((note) => ({
    id: note.id,
    date: note.date,
    title: note.title,
    eyebrow: showOwners ? nodeLabel(nodes, note.ownerNodeId) : undefined,
    body: firstLines(note.content),
  }));
  const stats = buildStats(tasks, notes);

  return (
    <div className="stack tab-page stats-page">
      <StatsGrid stats={stats} />
      <div className="stats-summary-panel">
        <div className="row-between">
          <h2>{t("stats.summary", { period: periodLabel(period, t) })}</h2>
          <div className="row">
            <Badge>{tasks.length + notes.length} {t("common.records")}</Badge>
            <Button type="button" size="sm" variant="secondary" onClick={() => exportSummaryMarkdown(tasks, notes, period)}>
              <Download size={14} /> {t("common.export")}
            </Button>
          </div>
        </div>
        <div className="stats-summary-sections">
          <WeeklySummarySection title={t("stats.completedTasks")} items={taskItems(completedTasks)} />
          <WeeklySummarySection title={t("stats.openTasks")} items={taskItems(openTasks)} />
          <WeeklySummarySection title={t("stats.meetingNotes")} items={noteItems} />
        </div>
      </div>
      <AchievementsView tasks={tasks} notes={notes} />
    </div>
  );
}

function WeeklySummarySection({ title, items }: { title: string; items: SummaryItem[] }) {
  const { t } = useTranslation();
  return (
    <Card className="stats-summary-section">
      <div className="row-between">
        <h3>{title}</h3>
        <Badge>{items.length}</Badge>
      </div>
      {items.length ? (
        <div className="stats-summary-list">
          {items.map((item) => (
            <article className="stats-summary-item" key={item.id}>
              <time>{formatDate(item.date)}</time>
              <div>
                {item.eyebrow && <small>{item.eyebrow}</small>}
                <strong>{item.title}</strong>
                {item.body && <p className="muted">{item.body}</p>}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="stats-summary-empty">
          <ListChecks size={16} />
          <strong>{t("empty.noRecords")}</strong>
          <span>{t("empty.noRecordsText")}</span>
        </div>
      )}
    </Card>
  );
}

export function AchievementsView({ tasks, notes }: { tasks: Task[]; notes: { title: string }[] }) {
  const { t } = useTranslation();
  const stats = buildStats(tasks as Task[], notes as any);
  const achievements = [
    { id: "completed", title: t("achievements.executionTitle"), value: stats.completedTasks, target: 5, text: t("achievements.executionText"), sources: tasks.filter((task) => task.status === "complete").map((task) => task.title) },
    { id: "notes", title: t("achievements.memoryTitle"), value: stats.notes, target: 3, text: t("achievements.memoryText"), sources: notes.map((note) => note.title) },
    { id: "archive", title: t("achievements.archiveTitle"), value: tasks.length + notes.length, target: 10, text: t("achievements.archiveText"), sources: [...tasks.map((task) => task.title), ...notes.map((note) => note.title)] },
  ];
  return (
    <div className="grid three-col">
      {achievements.map((achievement) => {
        const unlocked = achievement.value >= achievement.target;
        return (
          <div className={`badge-card ${unlocked ? "unlocked" : ""}`} key={achievement.id}>
            <div className="row-between">
              <CheckCircle2 className="achievement-icon" />
              <Badge>{achievement.value} / {achievement.target}</Badge>
            </div>
            <h2>{achievement.title}</h2>
            <p className="muted">{achievement.text}</p>
            <details className="achievement-detail">
              <summary>{t("achievements.sources")}</summary>
              <ul>
                {achievement.sources.slice(0, 6).map((source) => <li key={source}>{source}</li>)}
                {!achievement.sources.length && <li>{t("achievements.noSources")}</li>}
              </ul>
            </details>
            <div className="progress-track"><span style={{ width: `${Math.min(100, (achievement.value / achievement.target) * 100)}%` }} /></div>
          </div>
        );
      })}
    </div>
  );
}

function periodLabel(period: Period, t: (key: string) => string) {
  return t(`period.${period}`);
}
