import { Edit3, ListChecks, Plus, Save, Trash2, Upload, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { LlmWikiOverview, LlmWikiOwner, LlmWikiReferenceStats, LlmWikiScope, LlmWikiTarget, LlmWikiPeriod, ViewMode, User } from "../types";
import { EmptyState } from "../shared";
import { renderMarkdown, errorMessage } from "../helpers";

type LlmWikiViewProps = {
  user: User | null;
  viewMode: ViewMode;
  canViewTeam: boolean;
  onLoad: (payload?: { ownerId?: string; view?: ViewMode; scope?: LlmWikiScope }) => Promise<LlmWikiOverview>;
  onLoadOwners: () => Promise<LlmWikiOwner[]>;
  onLoadReferenceStats: (payload: { period: LlmWikiPeriod; scope: LlmWikiScope; ownerId?: string }) => Promise<LlmWikiReferenceStats>;
  onGenerate: (payload: { period: LlmWikiPeriod; scope: LlmWikiScope; language: "en" | "zh" }) => Promise<any>;
  onUpload: (payload: { filename: string; content: string; view?: ViewMode }) => Promise<any>;
  onIngest: (payload: { sourcePath: string; language: "en" | "zh"; view?: ViewMode }) => Promise<any>;
  onLint: (payload: { language: "en" | "zh"; view?: ViewMode }) => Promise<any>;
  onReadPage: (path: string, payload?: { ownerId?: string; view?: ViewMode; scope?: LlmWikiScope }) => Promise<{ path: string; content: string }>;
  onUpdatePage: (payload: { path: string; content: string; view?: ViewMode }) => Promise<{ content: string }>;
  onDeletePage: (path: string, view?: ViewMode) => Promise<{ path: string; deleted: boolean }>;
};

export function LlmWikiView({
  user,
  viewMode,
  canViewTeam,
  onLoad,
  onLoadOwners,
  onLoadReferenceStats,
  onGenerate,
  onUpload,
  onIngest,
  onLint,
  onReadPage,
  onUpdatePage,
  onDeletePage,
}: LlmWikiViewProps) {
  const { t, i18n: i18nInstance } = useTranslation();
  const [overview, setOverview] = useState<LlmWikiOverview | null>(null);
  const [owners, setOwners] = useState<LlmWikiOwner[]>([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState(user?.id ?? "");
  const [teamTarget, setTeamTarget] = useState<LlmWikiTarget>("team");
  const [wikiPeriod, setWikiPeriod] = useState<LlmWikiPeriod>("weekly");
  const [selectedSource, setSelectedSource] = useState("");
  const [selectedPage, setSelectedPage] = useState("index.md");
  const [pageContent, setPageContent] = useState("");
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [activeTool, setActiveTool] = useState<"generate" | "source" | "lint" | null>(null);
  const [lintResult, setLintResult] = useState<{ findings: string[]; notes: string } | null>(null);
  const [generationStats, setGenerationStats] = useState<LlmWikiReferenceStats | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const language = i18nInstance.resolvedLanguage?.startsWith("zh") ? "zh" : "en";
  const isTeamView = viewMode === "team" && canViewTeam;
  const wikiScope: LlmWikiScope = isTeamView && teamTarget === "team" ? "team" : "personal";
  const activeOwner = overview?.owner ?? owners.find((owner) => owner.id === selectedOwnerId);
  const canEditWiki = Boolean(activeOwner?.canEdit);
  const referenceStats = (canEditWiki ? generationStats : null) ?? overview?.referenceStats ?? {
    wikiPages: overview?.pages.length ?? 0,
    tasks: 0,
    meetingNotes: 0,
    resources: overview?.sources.length ?? 0,
  };
  const pageCount = referenceStats.wikiPages;

  const wikiRequest = (ownerId?: string) => ({
    view: (isTeamView ? "team" : "personal") as ViewMode,
    scope: wikiScope,
    ownerId,
  });

  const refresh = async (ownerId?: string) => {
    const next = await onLoad(wikiRequest(ownerId));
    setOverview(next);
    setSelectedOwnerId(next.owner.id);
    if (selectedPage === "log.md") setPageContent(next.log);
    else if (selectedPage === "index.md") setPageContent(next.index);
    else if (next.pages.some((page) => page.path === selectedPage)) setPageContent((await onReadPage(selectedPage, wikiRequest(ownerId))).content);
    else {
      setSelectedPage("index.md");
      setPageContent(next.index);
    }
    setEditContent("");
    setEditing(false);
    if (!next.sources.some((source) => source.path === selectedSource)) setSelectedSource(next.sources[0]?.path ?? "");
    return next;
  };

  useEffect(() => {
    void (async () => {
      const nextOwners = await onLoadOwners();
      setOwners(nextOwners);
    })().catch((err) => setError(errorMessage(err)));
  }, []);

  useEffect(() => {
    if (!user) return;
    const ownerId = isTeamView && teamTarget !== "team" ? teamTarget : undefined;
    setSelectedSource("");
    setSelectedPage("index.md");
    setLintResult(null);
    void refresh(ownerId).catch((err) => setError(errorMessage(err)));
  }, [viewMode, teamTarget, user?.id]);

  useEffect(() => {
    if (!canEditWiki) {
      setGenerationStats(null);
      return;
    }
    let cancelled = false;
    void onLoadReferenceStats({ period: wikiPeriod, scope: wikiScope })
      .then((stats) => {
        if (!cancelled) setGenerationStats(stats);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [canEditWiki, wikiPeriod, wikiScope]);

  const uploadSource = async (file: File | undefined) => {
    if (!file) return;
    if (!canEditWiki) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith(".md") && !name.endsWith(".markdown") && !name.endsWith(".txt")) {
      setError(t("llmWiki.uploadError"));
      return;
    }
    setLoading(true);
    setError("");
    try {
      const uploaded = await onUpload({ filename: file.name, content: await file.text(), view: isTeamView ? "team" : "personal" });
      setSelectedSource(uploaded.path);
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const generateWorkspaceWiki = async () => {
    if (!canEditWiki) return;
    setLoading(true);
    setError("");
    try {
      const result = await onGenerate({ period: wikiPeriod, scope: wikiScope, language });
      await refresh();
      setGenerationStats(result.referenceStats ?? null);
      const writtenPage = result.writtenPages.find((path: string) => path.startsWith("pages/"));
      if (writtenPage) await openPage(writtenPage);
      else await openPage("index.md");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const ingestSource = async () => {
    if (!selectedSource || !canEditWiki) return;
    setLoading(true);
    setError("");
    try {
      const result = await onIngest({ sourcePath: selectedSource, language, view: isTeamView ? "team" : "personal" });
      const next = await refresh();
      const writtenPage = result.writtenPages.find((path: string) => path.startsWith("pages/"));
      if (writtenPage) {
        setSelectedPage(writtenPage);
        setPageContent((await onReadPage(writtenPage, wikiRequest())).content);
      } else {
        setSelectedPage("index.md");
        setPageContent(next.index);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const runLint = async () => {
    if (!canEditWiki) return;
    setLoading(true);
    setError("");
    try {
      const result = await onLint({ language, view: isTeamView ? "team" : "personal" });
      setLintResult(result);
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const openPage = async (path: string) => {
    setSelectedPage(path);
    setEditing(false);
    setEditContent("");
    if (path === "index.md") {
      setPageContent(overview?.index ?? "");
      return;
    }
    if (path === "log.md") {
      setPageContent(overview?.log ?? "");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const ownerId = isTeamView && teamTarget !== "team" ? teamTarget : undefined;
      const page = await onReadPage(path, wikiRequest(ownerId));
      setPageContent(page.content);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const startEditing = () => {
    if (!canEditWiki || selectedPage === "log.md") return;
    setEditContent(pageContent);
    setEditing(true);
  };

  const savePage = async () => {
    if (!canEditWiki || selectedPage === "log.md") return;
    setLoading(true);
    setError("");
    try {
      const updated = await onUpdatePage({ path: selectedPage, content: editContent, view: isTeamView ? "team" : "personal" });
      setPageContent(updated.content);
      setEditing(false);
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const deletePage = async () => {
    if (!canEditWiki || !selectedPage.startsWith("pages/")) return;
    if (!window.confirm(t("llmWiki.deletePageConfirm"))) return;
    setLoading(true);
    setError("");
    try {
      await onDeletePage(selectedPage, isTeamView ? "team" : "personal");
      setSelectedPage("index.md");
      const next = await refresh();
      setPageContent(next.index);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const switchTeamTarget = (target: LlmWikiTarget) => {
    setError("");
    setTeamTarget(target);
    setSelectedOwnerId(target === "team" ? "" : target);
    setSelectedSource("");
    setSelectedPage("index.md");
    setLintResult(null);
    setActiveTool(null);
  };

  return (
    <div className="stack llm-wiki-shell">
      <Card className="stack llm-wiki-command">
        <div className="llm-wiki-command-main">
          <div>
            <h2>{t("llmWiki.title")}</h2>
            <p className="muted">
              {activeOwner ? t("llmWiki.ownerLine", { owner: activeOwner.name }) : t("llmWiki.help")}
            </p>
          </div>
          <div className="llm-wiki-metrics" aria-label={t("llmWiki.library")}>
            <span><strong>{referenceStats.wikiPages}</strong>{t("llmWiki.wikiPagesMetric")}</span>
            <span><strong>{referenceStats.tasks}</strong>{t("llmWiki.tasksMetric")}</span>
            <span><strong>{referenceStats.meetingNotes}</strong>{t("llmWiki.notesMetric")}</span>
            <span><strong>{referenceStats.resources}</strong>{t("llmWiki.resourcesMetric")}</span>
          </div>
        </div>

        <div className="llm-wiki-compact-bar">
          <div className="llm-wiki-owner-row">
            {isTeamView ? (
              <div className="field-group">
                <label>{t("llmWiki.teamTarget")}</label>
                <Select value={teamTarget} onValueChange={(target) => switchTeamTarget(target)}>
                  <SelectTrigger><SelectValue placeholder={t("llmWiki.teamTarget")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="team">{t("llmWiki.teamScope")}</SelectItem>
                    {owners.map((owner) => (
                      <SelectItem value={owner.id} key={owner.id}>{owner.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <Badge>{t("llmWiki.personalPane")}</Badge>
            )}
            <Badge>{t(`llmWiki.scopes.${wikiScope}`)}</Badge>
          </div>
          {activeOwner && (
            <div className="wiki-owner-card">
              <strong>{activeOwner.name}</strong>
              <span>{activeOwner.title || activeOwner.email}</span>
              <Badge>{activeOwner.canEdit ? t("llmWiki.ownerEditable") : t("llmWiki.readOnly")}</Badge>
            </div>
          )}
        </div>

        <div className="llm-wiki-action-row">
          {canEditWiki && (
            <>
              <Button type="button" size="sm" onClick={() => setActiveTool(activeTool === "generate" ? null : "generate")}>
                <Plus size={15} /> {t("llmWiki.generate")}
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => setActiveTool(activeTool === "source" ? null : "source")}>
                <Upload size={15} /> {t("llmWiki.addSource")}
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => setActiveTool(activeTool === "lint" ? null : "lint")}>
                <ListChecks size={15} /> {t("llmWiki.lint")}
              </Button>
            </>
          )}
        </div>

        {canEditWiki && activeTool === "generate" && (
          <div className="stack composer-panel llm-tool-panel">
            <div className="row-between">
              <h3>{t("llmWiki.generate")}</h3>
              <Button type="button" variant="ghost" size="sm" onClick={() => setActiveTool(null)}>
                <X size={14} /> {t("llmWiki.cancelEdit")}
              </Button>
            </div>
            <div className="llm-wiki-generate-row">
              <div className="segmented-switch llm-period-switch" role="group" aria-label={t("llmWiki.period")}>
                {(["daily", "weekly", "monthly", "historical"] as const).map((period) => (
                  <button type="button" key={period} className={wikiPeriod === period ? "active" : ""} aria-pressed={wikiPeriod === period} onClick={() => setWikiPeriod(period)}>
                    {t(`llmWiki.periods.${period}`)}
                  </button>
                ))}
              </div>
              <Button type="button" disabled={loading} onClick={generateWorkspaceWiki}>
                <Plus size={15} /> {loading ? t("llmWiki.working") : t("llmWiki.generate")}
              </Button>
            </div>
          </div>
        )}

        {canEditWiki && activeTool === "source" && (
          <div className="stack composer-panel llm-tool-panel">
            <div className="row-between">
              <h3>{t("llmWiki.addSource")}</h3>
              <Button type="button" variant="ghost" size="sm" onClick={() => setActiveTool(null)}>
                <X size={14} /> {t("llmWiki.cancelEdit")}
              </Button>
            </div>
            <div className="llm-source-row">
              <Input
                type="file"
                accept=".md,.markdown,.txt,text/markdown,text/plain"
                disabled={loading}
                onChange={(event) => {
                  const input = event.currentTarget;
                  void uploadSource(input.files?.[0]).finally(() => { input.value = ""; });
                }}
              />
              <Select value={selectedSource} onValueChange={setSelectedSource}>
                <SelectTrigger><SelectValue placeholder={t("llmWiki.noSource")} /></SelectTrigger>
                <SelectContent>
                  {(overview?.sources ?? []).map((source) => (
                    <SelectItem value={source.path} key={source.path}>{source.filename}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="secondary" disabled={loading || !selectedSource} onClick={ingestSource}>
                <Upload size={15} /> {t("llmWiki.ingest")}
              </Button>
            </div>
          </div>
        )}

        {canEditWiki && activeTool === "lint" && (
          <div className="stack composer-panel llm-tool-panel">
            <div className="row-between">
              <h3>{t("llmWiki.health")}</h3>
              <div className="cluster">
                <Button type="button" variant="secondary" disabled={loading} onClick={runLint}>
                  <ListChecks size={15} /> {loading ? t("llmWiki.working") : t("llmWiki.lint")}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setActiveTool(null)}>
                  <X size={14} /> {t("llmWiki.cancelEdit")}
                </Button>
              </div>
            </div>
            {lintResult ? (
              <>
                <ul className="plain-list">
                  {lintResult.findings.map((finding) => <li key={finding}>{finding}</li>)}
                  {!lintResult.findings.length && <li>{t("llmWiki.noFindings")}</li>}
                </ul>
                {lintResult.notes && <div className="markdown compact-markdown" dangerouslySetInnerHTML={{ __html: renderMarkdown(lintResult.notes) }} />}
              </>
            ) : (
              <p className="muted">{t("llmWiki.tools")}</p>
            )}
          </div>
        )}

        {error && <div className="form-error">{error}</div>}
      </Card>

      <div className="llm-wiki-browser">
        <Card className="stack llm-wiki-sidebar">
          <div className="panel-heading">
            <h2>{t("llmWiki.pages")}</h2>
            <Badge>{pageCount}</Badge>
          </div>
          <div className="wiki-list">
            <button type="button" className={selectedPage === "index.md" ? "active" : ""} onClick={() => void openPage("index.md")}>
              <strong>index.md</strong>
              <span>{t("llmWiki.index")}</span>
            </button>
            <button type="button" className={selectedPage === "log.md" ? "active" : ""} onClick={() => void openPage("log.md")}>
              <strong>log.md</strong>
              <span>{t("llmWiki.log")}</span>
            </button>
            {(overview?.pages ?? []).map((page) => (
              <button type="button" key={page.path} className={page.path === selectedPage ? "active" : ""} onClick={() => void openPage(page.path)}>
                <strong>{page.title}</strong>
                <span>{page.path}</span>
              </button>
            ))}
            {overview && !overview.pages.length && <span className="muted">{t("llmWiki.noPages")}</span>}
          </div>
        </Card>

        <Card className="stack llm-wiki-reader">
          <div className="panel-heading">
            <div>
              <h2>{selectedPage}</h2>
              <p className="muted">{activeOwner ? t("llmWiki.pageOwner", { owner: activeOwner.name }) : t("llmWiki.markdownPreview")}</p>
            </div>
            <div className="cluster">
              <Badge>{t("llmWiki.markdown")}</Badge>
              {canEditWiki && selectedPage !== "log.md" && !editing && (
                <Button type="button" size="sm" variant="secondary" onClick={startEditing}>
                  <Edit3 size={14} /> {t("common.edit")}
                </Button>
              )}
              {canEditWiki && selectedPage.startsWith("pages/") && !editing && (
                <Button type="button" size="sm" variant="secondary" disabled={loading} onClick={deletePage}>
                  <Trash2 size={14} /> {t("common.delete")}
                </Button>
              )}
            </div>
          </div>
          {editing ? (
            <div className="stack">
              <Textarea className="wiki-editor" value={editContent} onChange={(event) => setEditContent(event.target.value)} />
              <div className="cluster">
                <Button type="button" variant="secondary" onClick={() => setEditing(false)}>{t("llmWiki.cancelEdit")}</Button>
                <Button type="button" disabled={loading || !editContent.trim()} onClick={savePage}>
                  <Save size={15} /> {t("common.save")}
                </Button>
              </div>
            </div>
          ) : pageContent ? (
            <div className="markdown" dangerouslySetInnerHTML={{ __html: renderMarkdown(pageContent) }} />
          ) : (
            <EmptyState title={t("llmWiki.emptyTitle")} text={t("llmWiki.emptyText")} />
          )}
        </Card>

      </div>
    </div>
  );
}
