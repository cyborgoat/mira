import React, { useState } from "react";
import type { TFunction } from "i18next";
import { ListChecks, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Stats } from "./types";

type BaseProps = {
  title: string;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
};

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
