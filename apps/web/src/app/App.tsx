import {
  BarChart3,
  FileText,
  ListChecks,
  LogOut,
  MessageSquareText,
  Settings,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMiraApi } from "./useMiraApi";
import { resolveRouteFromHash } from "./helpers";
import { TasksView } from "./pages/TasksPage";
import { NotesView } from "./pages/NotesPage";
import { StatsView } from "./pages/StatsPage";
import { LlmWikiView } from "./pages/LlmWikiPage";
import { AskMiraView } from "./pages/AskMiraPage";
import { SettingsView } from "./pages/SettingsPage";
import { LanguageSelect, LoginScreen, PeriodControl, ViewModeSwitch } from "./shared";
import type { Route, ViewMode } from "./types";

const nav: Array<{ key: Route; icon: React.ComponentType<{ size?: number }> }> = [
  { key: "stats", icon: BarChart3 },
  { key: "tasks", icon: ListChecks },
  { key: "notes", icon: FileText },
  { key: "llm-wiki", icon: Sparkles },
  { key: "ask-mira", icon: MessageSquareText },
  { key: "settings", icon: Settings },
];

export function App() {
  const { t } = useTranslation();
  const [route, setRoute] = useState<Route>(() => resolveRouteFromHash(navKeys, "stats"));
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("monthly");
  const [viewMode, setViewMode] = useState<ViewMode>("personal");
  const api = useMiraApi();
  const activeView = viewMode === "team" && api.teamView ? api.teamView : api.workView;
  const visibleTasks = activeView?.tasks ?? [];
  const visibleNotes = activeView?.notes ?? [];
  const currentNav = nav.find((item) => item.key === route) ?? nav[0];

  useEffect(() => {
    const handleHashChange = () => setRoute(resolveRouteFromHash(navKeys, "stats"));
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    if (!api.user) return;
    void api.loadWorkspace(period);
  }, [api.user, period, api.revision, api.loadWorkspace]);

  useEffect(() => {
    if (viewMode === "team" && !api.user?.canViewTeam) setViewMode("personal");
  }, [api.user?.canViewTeam, viewMode]);

  const navigateTo = (nextRoute: Route) => {
    window.location.hash = nextRoute;
    setRoute(nextRoute);
  };

  if (!api.user) return <LoginScreen onLogin={api.login} error={api.error} loading={api.loading} />;

  const headerEyebrow = route === "settings"
    ? t("header.accountSettings")
    : viewMode === "team"
      ? t("header.readOnlyTeam")
      : api.user.role || t("header.personalWorkspace");
  const headerCopy = route === "settings"
    ? t("header.settingsCopy")
    : route === "ask-mira"
      ? t("header.askCopy")
      : viewMode === "team"
        ? t("header.teamCopy")
        : t("header.personalCopy");

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">M</span>
          <div className="brand-stack">
            <span className="brand-name">{t("common.appName")}</span>
            <span className="brand-slogan">{t("common.appSubtitle")}</span>
          </div>
        </div>
        <div className="row topbar-controls">
          {api.user.canViewTeam && (
            <ViewModeSwitch value={viewMode} onChange={setViewMode} />
          )}
          <LanguageSelect compact />
          <Badge>{api.user.teamNode?.name ?? api.user.email}</Badge>
          <Button type="button" variant="ghost" size="sm" onClick={api.logout}>
            <LogOut size={15} /> {t("common.signOut")}
          </Button>
        </div>
      </header>

      <aside className="sidebar">
        <div className="stack">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={`nav-button ${route === item.key ? "active" : ""}`}
                key={item.key}
                onClick={() => navigateTo(item.key)}
              >
                <Icon size={17} />
                {t(`nav.${item.key}`)}
              </Button>
            );
          })}
        </div>
      </aside>

      <main className="main">
        <div className="page-scroll">
          {api.error && <div className="form-error page-error">{api.error}</div>}
          {route !== "ask-mira" && (
            <div className="page-header">
              <div>
                <div className="eyebrow">{headerEyebrow}</div>
                <h1>{t(`nav.${currentNav.key}`)}</h1>
                <p className="muted">{headerCopy}</p>
              </div>
              {route === "stats" && <PeriodControl value={period} onChange={setPeriod} />}
            </div>
          )}

          {route === "tasks" && (
            <TasksView
              tasks={visibleTasks}
              nodes={api.teamNodes}
              readOnly={viewMode === "team"}
              onCreate={api.createTask}
              onUpdate={api.updateTask}
              onDelete={api.deleteTask}
            />
          )}
          {route === "notes" && (
            <NotesView
              notes={visibleNotes}
              nodes={api.teamNodes}
              readOnly={viewMode === "team"}
              onCreate={api.createNote}
              onUpdate={api.updateNote}
              onDelete={api.deleteNote}
            />
          )}
          {route === "stats" && <StatsView view={activeView} period={period} nodes={api.teamNodes} showOwners={viewMode === "team"} />}
          {route === "llm-wiki" && (
            <LlmWikiView
              user={api.user}
              viewMode={viewMode}
              canViewTeam={Boolean(api.user?.canViewTeam)}
              onLoad={api.loadLlmWiki}
              onLoadOwners={api.loadLlmWikiOwners}
              onLoadReferenceStats={api.loadLlmWikiReferenceStats}
              onGenerate={api.generateLlmWiki}
              onUpload={api.uploadLlmWikiSource}
              onIngest={api.ingestLlmWikiSource}
              onLint={api.lintLlmWiki}
              onReadPage={api.readLlmWikiPage}
              onUpdatePage={api.updateLlmWikiPage}
              onDeletePage={api.deleteLlmWikiPage}
            />
          )}
          {route === "ask-mira" && (
            <AskMiraView canViewTeam={Boolean(api.user?.canViewTeam)} viewMode={viewMode} onLoadOwners={api.loadLlmWikiOwners} onAsk={api.askMira} />
          )}
          {route === "settings" && (
            <SettingsView
              user={api.user}
              nodes={api.teamNodes}
              teamView={api.teamView}
              onUpdateProfile={api.updateProfile}
              onUpdatePassword={api.updatePassword}
              onCreate={api.createTeamNode}
              onUpdate={api.updateTeamNode}
              onDelete={api.deleteTeamNode}
              onExport={api.exportWorkspace}
              onImport={api.importWorkspace}
              onReset={api.resetWorkspace}
            />
          )}
        </div>
      </main>
    </div>
  );
}

const navKeys = nav.map((item) => item.key);
