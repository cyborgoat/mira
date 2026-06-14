import {
  Briefcase,
  FileText,
  ListChecks,
  LogOut,
  Settings,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMiraApi } from "./useMiraApi";
import { resolveRouteFromHash } from "./helpers";
import { TasksView } from "./pages/TasksPage";
import { ReportView } from "./pages/ReportPage";
import { MyWorkView } from "./pages/MyWorkPage";
import { SettingsView } from "./pages/SettingsPage";
import { LanguageSelect, LoginScreen } from "./shared";
import type { Route } from "./types";

const sidebarNav: Array<{ key: Route; icon: React.ComponentType<{ size?: number }> }> = [
  { key: "tasks", icon: ListChecks },
  { key: "report", icon: FileText },
  { key: "my-work", icon: Briefcase },
];

const allRoutes: Route[] = ["tasks", "report", "my-work", "settings"];

export function App() {
  const { t } = useTranslation();
  const api = useMiraApi();
  const isManager = Boolean(api.user?.canViewTeam);

  const [route, setRoute] = useState<Route>(() => resolveRouteFromHash(allRoutes, "tasks"));

  useEffect(() => {
    const handleHashChange = () => setRoute(resolveRouteFromHash(allRoutes, "tasks"));
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    if (!api.user) return;
    if (route === "my-work" || route === "report") return;
    void api.loadWorkspace("monthly");
  }, [api.user, route, api.revision, api.loadWorkspace]);

  const navigateTo = (next: Route) => {
    window.location.hash = next;
    setRoute(next);
  };

  const handleCreateTask = useCallback(
    async (payload: Parameters<typeof api.createTask>[0]) => {
      await api.createTask(payload);
    },
    [api.createTask],
  );

  const handleUpdateTask = useCallback(
    async (id: string, payload: Parameters<typeof api.updateTask>[1]) => {
      await api.updateTask(id, payload);
    },
    [api.updateTask],
  );

  if (!api.user) {
    return <LoginScreen onLogin={api.login} error={api.error} loading={api.loading} />;
  }

  const headerEyebrow =
    route === "settings"
      ? t("header.accountSettings")
      : isManager
        ? t("header.readOnlyTeam")
        : t("header.personalWorkspace");

  const headerCopy =
    route === "settings"
      ? t("header.settingsCopy")
      : route === "my-work"
        ? t("header.myWorkCopy")
        : route === "report"
          ? t("header.reportCopy")
          : t("header.personalCopy");

  const showPageHeader = route === "settings" || route === "my-work";

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
          <LanguageSelect compact />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={route === "settings" ? "active" : ""}
            onClick={() => navigateTo("settings")}
            aria-label={t("nav.settings")}
          >
            <Settings size={16} />
          </Button>
          <Badge>{api.user.teamNode?.name ?? api.user.email}</Badge>
          <Button type="button" variant="ghost" size="sm" onClick={api.logout}>
            <LogOut size={15} /> {t("common.signOut")}
          </Button>
        </div>
      </header>

      <aside className="sidebar">
        <div className="stack">
          {sidebarNav.map((item) => {
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
                <span className="nav-icon-wrap">
                  <Icon size={17} />
                </span>
                {t(`nav.${item.key}`)}
              </Button>
            );
          })}
        </div>
      </aside>

      <main className="main">
        <div className="page-scroll">
          {api.error && <div className="form-error page-error">{api.error}</div>}

          {showPageHeader && (
            <div className="page-header">
              <div>
                <div className="eyebrow">{headerEyebrow}</div>
                <h1>{route === "settings" ? t("nav.settings") : t(`nav.${route}`)}</h1>
                <p className="muted">{headerCopy}</p>
              </div>
            </div>
          )}

          {route === "tasks" && (
            <TasksView
              tasks={api.workView?.tasks ?? []}
              isManager={isManager}
              onCreate={handleCreateTask}
              onUpdate={handleUpdateTask}
              onLoadLocalSuggestion={() => api.loadLocalTaskSuggestion("personal")}
              onRefineTasks={api.refineTasks}
            />
          )}

          {route === "report" && (
            <ReportView
              isManager={isManager}
              onLoadReportSources={api.loadReportSources}
              onAssembleReport={api.assembleReport}
              onGenerateReport={api.generateReport}
              onRefineReport={api.refineReport}
            />
          )}

          {route === "my-work" && (
            <MyWorkView
              onLoadArchive={api.loadWorkArchive}
              onLoadReportProfile={api.loadReportProfile}
              onUploadReportHistory={api.uploadReportHistory}
              onProcessReportColdStart={api.processReportColdStart}
              onAfterColdStart={async () => { await api.loadWorkArchive(); }}
            />
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
              onLoadLlmConfig={api.loadLlmConfig}
              onUpdateLlmConfig={api.updateLlmConfig}
              onExport={api.exportWorkspace}
              onImport={api.importWorkspace}
              onReset={api.resetWorkspace}
            />
          )}
        </div>
      </main>

      <nav className="mobile-nav" aria-label={t("common.mainNavigation")}>
        {sidebarNav.map((item) => {
          const Icon = item.icon;
          return (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={`mobile-nav-button ${route === item.key ? "active" : ""}`}
              key={item.key}
              onClick={() => navigateTo(item.key)}
            >
              <span className="nav-icon-wrap">
                <Icon size={16} />
              </span>
              <span>{t(`nav.${item.key}`)}</span>
            </Button>
          );
        })}
      </nav>
    </div>
  );
}
