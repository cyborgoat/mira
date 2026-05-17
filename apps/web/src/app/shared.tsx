import React, { useEffect, useState } from "react";
import type { TFunction } from "i18next";
import { ListChecks, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { Period, TaskPriority, ViewMode, Stats } from "./types";
import { formatDate, priorityLabel } from "./helpers";

type TaskShortcutHandlers = {
  onSave: () => void | Promise<void>;
  onNew: () => void;
  enabled?: boolean;
};

type BaseProps = {
  title: string;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function useKeyboardShortcuts({ onSave, onNew, enabled = true }: TaskShortcutHandlers) {
  useEffect(() => {
    if (!enabled) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        void onSave();
      }
      if (key === "n") {
        event.preventDefault();
        onNew();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onSave, onNew, enabled]);
}

export function EmptyState({ title, text, actionLabel, onAction }: BaseProps) {
  return (
    <div className="empty-state">
      <ListChecks size={18} />
      <strong>{title}</strong>
      <span>{text}</span>
      {actionLabel && onAction && <Button type="button" size="sm" variant="secondary" onClick={onAction}><Plus size={14} /> {actionLabel}</Button>}
    </div>
  );
}

export function SummaryList({ items, className }: { items: Array<{ id: string; date: string; title: string; eyebrow?: string; body?: string }>; className?: string }) {
  const { t } = useTranslation();
  if (!items.length) return <EmptyState title={t("empty.noRecords")} text={t("empty.noRecordsText")} />;
  return (
    <div className={`summary-list ${className ?? ""}`}>
      {items.map((item) => (
        <div className="summary-item" key={item.id}>
          <time>{formatDate(item.date)}</time>
          <div>
            {item.eyebrow && <small>{item.eyebrow}</small>}
            <strong>{item.title}</strong>
            {item.body && <p className="muted">{item.body}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

export function PrioritySelect({ value, onChange }: { value: TaskPriority; onChange: (value: TaskPriority) => void }) {
  const { t } = useTranslation();
  return (
    <Select value={value} onValueChange={(priority) => onChange(priority as TaskPriority)}>
      <SelectTrigger><SelectValue placeholder={t("tasks.priority")} /></SelectTrigger>
      <SelectContent>
        {(["low", "normal", "high", "urgent"] as TaskPriority[]).map((priority) => (
          <SelectItem value={priority} key={priority}>{priorityLabel(priority, (key) => t(key))}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function PeriodControl({ value, onChange }: { value: Period; onChange: (value: Period) => void }) {
  const { t } = useTranslation();
  return (
    <ToggleGroup type="single" value={value} onValueChange={(next) => next && onChange(next as Period)} aria-label={t("stats.summary", { period: "" })}>
      <ToggleGroupItem value="daily">{t("period.daily")}</ToggleGroupItem>
      <ToggleGroupItem value="weekly">{t("period.weekly")}</ToggleGroupItem>
      <ToggleGroupItem value="monthly">{t("period.monthly")}</ToggleGroupItem>
    </ToggleGroup>
  );
}

export function ViewModeSwitch({ value, onChange }: { value: ViewMode; onChange: (value: ViewMode) => void }) {
  const { t } = useTranslation();
  return (
    <div className="segmented-switch view-mode-switch" role="group" aria-label={t("mode.label")}>
      <button type="button" className={value === "personal" ? "active" : ""} aria-pressed={value === "personal"} onClick={() => onChange("personal")}>
        {t("mode.personal")}
      </button>
      <button type="button" className={value === "team" ? "active" : ""} aria-pressed={value === "team"} onClick={() => onChange("team")}>
        {t("mode.team")}
      </button>
    </div>
  );
}

export function LanguageSelect({ compact = false }: { compact?: boolean }) {
  const { t, i18n: i18nInstance } = useTranslation();
  const language = i18nInstance.resolvedLanguage?.startsWith("zh") ? "zh" : "en";
  const nextLanguage = language === "zh" ? "en" : "zh";
  return (
    <button
      type="button"
      className={compact ? "language-switch compact" : "language-switch"}
      aria-label={t("language.label")}
      aria-pressed={language === "zh"}
      onClick={() => void i18nInstance.changeLanguage(nextLanguage)}
    >
      <span className={language === "en" ? "active" : ""}>EN</span>
      <span className={language === "zh" ? "active" : ""}>中</span>
    </button>
  );
}

export function InlineStats({ stats, t }: { stats: Stats; t: TFunction }) {
  return (
    <div className="inline-stats">
      <div><span>{stats.tasks}</span><small>{t("settings.tasks")}</small></div>
      <div><span>{stats.notes}</span><small>{t("common.notes")}</small></div>
      <div><span>{stats.completionRate}%</span><small>{t("settings.completion")}</small></div>
    </div>
  );
}

export function StatsGrid({ stats }: { stats: Stats }) {
  const { t } = useTranslation();
  return (
    <div className="grid three-col">
      <Card className="metric-card"><h2>{t("stats.totalTasks")}</h2><div className="metric-value">{stats.tasks}</div><p className="muted">{t("stats.completedCount", { count: stats.completedTasks })}</p></Card>
      <Card className="metric-card"><h2>{t("stats.notesMetric")}</h2><div className="metric-value">{stats.notes}</div><p className="muted">{t("stats.noteWords", { count: stats.noteWords })}</p></Card>
      <Card className="metric-card"><h2>{t("stats.completion")}</h2><div className="metric-value">{stats.completionRate}%</div><p className="muted">{t("stats.selectedPeriod")}</p></Card>
    </div>
  );
}

export function LoginScreen({ onLogin, error, loading }: { onLogin: (email: string, password: string) => Promise<void>; error: string; loading: boolean }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState("manager@mira.local");
  const [password, setPassword] = useState("local-password");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    await onLogin(email, password);
  };

  return (
    <div className="login-shell">
      <Card className="stack login-card">
        <div className="login-brand">
          <span className="brand-mark">M</span>
          {t("common.appName")}
          <LanguageSelect compact />
        </div>
        <div>
          <h1>{t("login.title")}</h1>
          <p className="muted">{t("login.demoAccounts")}</p>
        </div>
        {error && <div className="form-error">{error}</div>}
        <form className="stack" onSubmit={submit}>
          <label className="field">
            <span>{t("login.email")}</span>
            <Input value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label className="field">
            <span>{t("login.password")}</span>
            <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <Button type="submit" disabled={loading}>
            {loading ? t("login.signingIn") : t("login.submit")}
          </Button>
        </form>
      </Card>
    </div>
  );
}

export function confirmAction(message: string, action: () => void | Promise<void>) {
  if (window.confirm(message)) void action();
}
