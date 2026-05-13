import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Archive,
  BadgeCheck,
  BookOpen,
  Brain,
  ClipboardList,
  FileText,
  Flame,
  Layers,
  LineChart,
  Loader2,
  Search,
  Send,
  Sparkles,
  Users,
} from "lucide-react";
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { useTranslation } from "react-i18next";
import { Badge, Button, Card, Checkbox, Input, NativeSelect, Textarea, ToggleGroup } from "./components/ui";
import {
  Achievement,
  KnowledgeEntry,
  Member,
  Report,
  Tag,
  Todo,
  api,
} from "./lib/api";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { LoginPage } from "./components/LoginPage";
import "./i18n";
import "./styles.css";

type Route = "workspace" | "weekly" | "wiki" | "achievements" | "performance" | "portrait" | "summary" | "import";

const nav = [
  { key: "workspace", labelKey: "nav.workspace", icon: ClipboardList },
  { key: "weekly", labelKey: "nav.weekly", icon: Sparkles },
  { key: "wiki", labelKey: "nav.wiki", icon: BookOpen },
  { key: "achievements", labelKey: "nav.achievements", icon: BadgeCheck },
  { key: "performance", labelKey: "nav.performance", icon: LineChart },
  { key: "portrait", labelKey: "nav.portrait", icon: Layers },
  { key: "summary", labelKey: "nav.summary", icon: Users },
  { key: "import", labelKey: "nav.import", icon: FileText },
] as const;

const queryClient = new QueryClient();

function App() {
  const { t, i18n } = useTranslation();
  const [route, setRoute] = useState<Route>("workspace");
  const [selectedMemberId, setSelectedMemberId] = useState("m1");
  const { data, isLoading, error } = useQuery({ queryKey: ["state"], queryFn: api.state });

  const selectedMember = data?.members.find((member) => member.id === selectedMemberId) ?? data?.members[0];
  const pageTitle = t(nav.find((item) => item.key === route)?.labelKey ?? "nav.workspace");
  const language = i18n.language.startsWith("zh") ? "zh" : "en";
  const changeLanguage = (nextLanguage: "en" | "zh") => {
    localStorage.setItem("mira_language", nextLanguage);
    i18n.changeLanguage(nextLanguage);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">Mira</span>
          <span className="brand-name">Mira | See</span>
          <span className="brand-slogan">{t("app.slogan")}</span>
        </div>
        <div className="row">
          <ToggleGroup
            ariaLabel={t("app.language")}
            value={language}
            options={[
              { value: "en", label: "EN" },
              { value: "zh", label: "ZH" },
            ]}
            onValueChange={(value) => changeLanguage(value as "en" | "zh")}
          />
          <Badge>{selectedMember ? t(`roles.${selectedMember.role}`) : t("app.loading")}</Badge>
          <NativeSelect style={{ width: 190 }} value={selectedMemberId} onChange={(event) => setSelectedMemberId(event.target.value)}>
            {data?.members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name} · {t(`departments.${member.department}`)}
              </option>
            ))}
          </NativeSelect>
        </div>
      </header>

      <aside className="sidebar">
        <div className="stack">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <button className={`nav-button ${route === item.key ? "active" : ""}`} key={item.key} onClick={() => setRoute(item.key)}>
                <Icon size={18} />
                {t(item.labelKey)}
              </button>
            );
          })}
        </div>
      </aside>

      <main className="main">
        <div className="page-header">
          <div>
            <div className="eyebrow">{t("app.eyebrow")}</div>
            <h1>{pageTitle}</h1>
            <p className="muted">{t("app.subtitle")}</p>
          </div>
          <Badge>{t("app.workspace")}</Badge>
        </div>

        {isLoading && <LoadingState />}
        {error && <Card>{t("app.apiUnavailable")}</Card>}
        {data && selectedMember && (
          <RouteView
            route={route}
            selectedMember={selectedMember}
            members={data.members}
            todos={data.todos}
            reports={data.reports}
            knowledge={data.knowledge}
            tags={data.tags}
            achievements={data.achievements}
          />
        )}
      </main>
    </div>
  );
}

function RouteView(props: {
  route: Route;
  selectedMember: Member;
  members: Member[];
  todos: Todo[];
  reports: Report[];
  knowledge: KnowledgeEntry[];
  tags: Tag[];
  achievements: Achievement[];
}) {
  switch (props.route) {
    case "weekly":
      return <WeeklyAssistant {...props} />;
    case "wiki":
      return <Wiki {...props} />;
    case "achievements":
      return <Achievements {...props} />;
    case "performance":
      return <Performance {...props} />;
    case "portrait":
      return <TeamPortrait {...props} />;
    case "summary":
      return <TeamSummary {...props} />;
    case "import":
      return <ImportGuide members={props.members} />;
    default:
      return <Workspace {...props} />;
  }
}

function Workspace({ selectedMember, todos }: { selectedMember: Member; todos: Todo[] }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const memberTodos = todos.filter((todo) => todo.member_id === selectedMember.id);
  const createTodo = useMutation({
    mutationFn: api.createTodo,
    onSuccess: () => {
      setContent("");
      queryClient.invalidateQueries({ queryKey: ["state"] });
    },
  });
  const updateTodo = useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) => api.updateTodo(id, { done }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["state"] }),
  });

  return (
    <div className="grid two-col">
      <Card className="stack">
        <h2>{t("workspace.captureTitle")}</h2>
        <Textarea
          value={content}
          placeholder={t("workspace.capturePlaceholder")}
          onChange={(event) => setContent(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (content.trim()) createTodo.mutate({ member_id: selectedMember.id, content });
            }
          }}
        />
        <div className="row-between">
          <span className="muted">{t("workspace.shortcut")}</span>
          <Button onClick={() => createTodo.mutate({ member_id: selectedMember.id, content })} disabled={!content.trim()}>
            <Send size={16} /> {t("workspace.submit")}
          </Button>
        </div>
      </Card>

      <Card className="stack">
        <div className="row-between">
          <h2>{t("workspace.recordsTitle")}</h2>
          <Badge>{t("workspace.doneCount", { count: memberTodos.filter((todo) => todo.done).length })}</Badge>
        </div>
        {memberTodos.map((todo) => (
          <motion.div layout className={`todo ${todo.done ? "done" : ""}`} key={todo.id}>
            <div className="row-between">
              <label className="row">
                <Checkbox checked={Boolean(todo.done)} onChange={(event) => updateTodo.mutate({ id: todo.id, done: event.target.checked })} />
                <span className="todo-title">{todo.content}</span>
              </label>
              <Badge>{todo.category}</Badge>
            </div>
            {todo.summary && <div className="muted" style={{ marginTop: 6 }}>{todo.summary}</div>}
          </motion.div>
        ))}
      </Card>
    </div>
  );
}

function WeeklyAssistant({ selectedMember, reports }: { selectedMember: Member; reports: Report[] }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [weeklyNote, setWeeklyNote] = useState("");
  const memberReports = reports.filter((report) => report.member_id === selectedMember.id);
  const draft = memberReports.find((report) => !report.archived) ?? memberReports[0];
  const generate = useMutation({
    mutationFn: api.generateReport,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["state"] }),
  });
  const archive = useMutation({
    mutationFn: api.archiveReport,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["state"] }),
  });

  return (
    <div className="grid two-col">
      <Card className="stack">
        <h2>{t("weekly.uploadTitle")}</h2>
        <Textarea value={weeklyNote} onChange={(event) => setWeeklyNote(event.target.value)} placeholder={t("weekly.notePlaceholder")} />
        <Button onClick={() => generate.mutate({ member_id: selectedMember.id, weekly_note: weeklyNote })}>
          {generate.isPending ? <Loader2 size={16} /> : <Sparkles size={16} />} {t("weekly.generate")}
        </Button>
      </Card>

      <Card className="stack">
        <div className="row-between">
          <h2>{t("weekly.currentReport")}</h2>
          {draft?.markdown_path && <Badge>{draft.markdown_path}</Badge>}
        </div>
        {draft ? (
          <>
            {draft.archived ? <ReportSections report={draft} /> : <EditableReport key={draft.id} report={draft} />}
            {!draft.archived && (
              <Button variant="gold" onClick={() => archive.mutate(draft.id)}>
                <Archive size={16} /> {t("weekly.archive")}
              </Button>
            )}
          </>
        ) : (
          <p className="muted">{t("weekly.empty")}</p>
        )}
      </Card>
    </div>
  );
}

function EditableReport({ report }: { report: Report }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [completed, setCompleted] = useState(report.completed.join("\n"));
  const [inProgress, setInProgress] = useState(report.in_progress.join("\n"));
  const [nextWeek, setNextWeek] = useState(report.next_week.join("\n"));
  const [risks, setRisks] = useState(report.risks.join("\n"));
  const save = useMutation({
    mutationFn: () =>
      api.updateReport(report.id, {
        completed: lines(completed),
        in_progress: lines(inProgress),
        next_week: lines(nextWeek),
        risks: lines(risks),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["state"] }),
  });

  return (
    <div className="stack">
      <EditableSection title={t("report.completed")} value={completed} onChange={setCompleted} />
      <EditableSection title={t("report.inProgress")} value={inProgress} onChange={setInProgress} />
      <EditableSection title={t("report.nextWeek")} value={nextWeek} onChange={setNextWeek} />
      <EditableSection title={t("report.risks")} value={risks} onChange={setRisks} />
      <Button variant="secondary" onClick={() => save.mutate()}>
        <FileText size={16} /> {t("weekly.saveDraft")}
      </Button>
    </div>
  );
}

function EditableSection({ title, value, onChange }: { title: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="stack">
      <strong>{title}</strong>
      <Textarea className="compact" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function lines(value: string): string[] {
  return value.split("\n").map((line) => line.trim()).filter(Boolean);
}

function ReportSections({ report }: { report: Report }) {
  const { t } = useTranslation();
  return (
    <div className="stack">
      <Section title={t("report.completed")} items={report.completed} />
      <Section title={t("report.inProgress")} items={report.in_progress} />
      <Section title={t("report.nextWeek")} items={report.next_week} />
      <Section title={t("report.risks")} items={report.risks} />
    </div>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  const { t } = useTranslation();
  return (
    <div>
      <strong>{title}</strong>
      <ul className="section-list">
        {(items.length ? items : [t("report.none")]).map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}

function Wiki({ selectedMember, knowledge, tags }: { selectedMember: Member; knowledge: KnowledgeEntry[]; tags: Tag[] }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const entries = knowledge.filter((entry) => entry.member_id === selectedMember.id && entry.text.toLowerCase().includes(query.toLowerCase()));
  const memberTags = tags.filter((tag) => tag.member_id === selectedMember.id);
  return (
    <div className="grid two-col">
      <Card className="stack">
        <h2>{t("wiki.profile")}</h2>
        <p>{t("wiki.profileSummary", { name: selectedMember.name, entries: entries.length, tags: memberTags.length })}</p>
        <div className="tag-cloud">
          {memberTags.map((tag) => <span className="tag" key={tag.id}>{tag.name} · {tag.count}</span>)}
        </div>
      </Card>
      <Card className="stack">
        <div className="row">
          <Search size={18} />
          <Input value={query} placeholder={t("wiki.searchPlaceholder")} onChange={(event) => setQuery(event.target.value)} />
        </div>
        {entries.map((entry) => (
          <div className="todo" key={entry.id}>
            <div className="muted">{entry.week_key} · {entry.source} · {entry.markdown_path}</div>
            <div>{entry.text}</div>
          </div>
        ))}
      </Card>
    </div>
  );
}

function Achievements({ selectedMember, achievements }: { selectedMember: Member; achievements: Achievement[] }) {
  const { t } = useTranslation();
  const memberAchievements = achievements.filter((achievement) => achievement.member_id === selectedMember.id);
  return (
    <div className="grid three-col">
      {memberAchievements.map((achievement) => (
        <div className={`badge-card ${achievement.unlocked ? "unlocked" : ""}`} key={achievement.id}>
          <div className="row-between">
            <Flame color={achievement.unlocked ? "#e8b86d" : "#6b7a99"} />
            <Badge>{achievement.progress} / {achievement.threshold}</Badge>
          </div>
          <h2 style={{ marginTop: 12 }}>{achievement.badge_name}</h2>
          <p className="muted">{achievement.unlocked ? t("achievements.unlocked") : t("achievements.locked")}</p>
        </div>
      ))}
      {!memberAchievements.length && <Card>{t("achievements.empty")}</Card>}
    </div>
  );
}

function Performance({ selectedMember, knowledge, tags }: { selectedMember: Member; knowledge: KnowledgeEntry[]; tags: Tag[] }) {
  const { t } = useTranslation();
  const entries = knowledge.filter((entry) => entry.member_id === selectedMember.id);
  const memberTags = tags.filter((tag) => tag.member_id === selectedMember.id);
  const score = Math.min(100, 60 + entries.length * 5 + memberTags.length * 3);
  return (
    <div className="grid three-col">
      <Card>
        <h2>{t("performance.health")}</h2>
        <div style={{ fontSize: 44, fontWeight: 750 }}>{score}%</div>
        <p className="muted">{score >= 90 ? t("performance.healthy") : score >= 70 ? t("performance.attention") : t("performance.offTrack")}</p>
      </Card>
      <Card>
        <h2>{t("performance.outputVolume")}</h2>
        <div style={{ fontSize: 44, fontWeight: 750 }}>{entries.length}</div>
        <p className="muted">{t("performance.archivedEntries")}</p>
      </Card>
      <Card>
        <h2>{t("performance.capabilityTags")}</h2>
        <div style={{ fontSize: 44, fontWeight: 750 }}>{memberTags.length}</div>
        <p className="muted">{t("performance.activeSignals")}</p>
      </Card>
    </div>
  );
}

function TeamPortrait({ members, tags }: { members: Member[]; tags: Tag[] }) {
  const { t } = useTranslation();
  const activeMembers = members.filter((member) => !member.is_manager);
  return (
    <div className="grid">
      <Card>
        <h2>{t("portrait.cloud")}</h2>
        <div className="tag-cloud">
          {tags.map((tag) => <span className="tag" key={tag.id}>{tag.name} · {tag.count}</span>)}
        </div>
      </Card>
      <Card className="stack">
        <h2>{t("portrait.snapshot")}</h2>
        {activeMembers.map((member) => (
          <div className="row-between todo" key={member.id}>
            <strong>{member.name}</strong>
            <div className="tag-cloud">
              {tags.filter((tag) => tag.member_id === member.id).slice(0, 6).map((tag) => <Badge key={tag.id}>{tag.name}</Badge>)}
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

function TeamSummary({ members }: { members: Member[] }) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const selectable = members.filter((member) => !member.is_manager);
  const [selected, setSelected] = useState<string[]>(selectable.map((member) => member.id));
  const summary = useMutation({
    mutationFn: api.teamSummary,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["state"] }),
  });
  const toggle = (id: string) => setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  return (
    <div className="grid two-col">
      <Card className="stack">
        <h2>{t("summary.configuration")}</h2>
        {selectable.map((member) => (
          <label className="row" key={member.id}>
            <Checkbox checked={selected.includes(member.id)} onChange={() => toggle(member.id)} />
            {member.name} · {t(`roles.${member.role}`)}
          </label>
        ))}
        <Button onClick={() => summary.mutate({ member_ids: selected, weeks: 4, language: languageCode(i18n.language) })}>
          <Brain size={16} /> {t("summary.generate")}
        </Button>
      </Card>
      <Card className="stack">
        <h2>{t("summary.output")}</h2>
        {summary.data ? (
          <>
            <Badge>{summary.data.markdown_path}</Badge>
            <pre className="markdown">{summary.data.markdown}</pre>
          </>
        ) : (
          <p className="muted">{t("summary.empty")}</p>
        )}
      </Card>
    </div>
  );
}

function ImportGuide({ members }: { members: Member[] }) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const selectable = members.filter((member) => !member.is_manager);
  const [memberId, setMemberId] = useState(selectable[0]?.id ?? "m1");
  const [filename, setFilename] = useState(t("import.filename"));
  const [weekKey, setWeekKey] = useState("");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const importText = useMutation({
    mutationFn: api.importText,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["state"] }),
  });
  const importFile = useMutation({
    mutationFn: api.importFile,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["state"] }),
  });
  const latestImport = importText.data ?? importFile.data;
  const language = languageCode(i18n.language);

  return (
    <div className="grid two-col">
      <Card className="stack">
        <h2>{t("import.title")}</h2>
        <p className="muted">{t("import.description")}</p>
        <div className="row">
          <NativeSelect value={memberId} onChange={(event) => setMemberId(event.target.value)}>
            {selectable.map((member) => (
              <option key={member.id} value={member.id}>{member.name} · {t(`roles.${member.role}`)}</option>
            ))}
          </NativeSelect>
          <Input value={weekKey} placeholder="2026-W19" onChange={(event) => setWeekKey(event.target.value)} />
        </div>
        <Input value={filename} onChange={(event) => setFilename(event.target.value)} />
        <Textarea className="tall" value={content} onChange={(event) => setContent(event.target.value)} placeholder={t("import.sample")} />
        <Button disabled={!content.trim()} onClick={() => importText.mutate({ member_id: memberId, filename, content, week_key: weekKey || undefined, archive: true, language })}>
          <Archive size={16} /> {t("import.action")}
        </Button>
        <div className="stack">
          <p className="muted">{t("import.fileHint")}</p>
          <Input type="file" accept=".md,.txt,text/markdown,text/plain" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          <Button variant="secondary" disabled={!file} onClick={() => file && importFile.mutate({ member_id: memberId, file, week_key: weekKey || undefined, archive: true, language })}>
            <FileText size={16} /> {t("import.fileAction")}
          </Button>
        </div>
      </Card>
      <Card className="stack">
        <h2>{t("import.result")}</h2>
        {latestImport ? (
          <>
            <Badge>{latestImport.markdown_path}</Badge>
            <p>{t("import.entriesCreated", { count: latestImport.knowledge_entries })}</p>
            <ReportSections report={latestImport.report} />
          </>
        ) : (
          <div className="todo">{t("import.empty")}</div>
        )}
      </Card>
    </div>
  );
}

function languageCode(language: string): "en" | "zh" {
  return language.startsWith("zh") ? "zh" : "en";
}

function LoadingState() {
  const { t } = useTranslation();
  return (
    <Card className="row">
      <Loader2 size={18} /> {t("app.loadingState")}
    </Card>
  );
}

function AppContent() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <LoadingState />;
  if (!user) return <LoginPage />;

  return <App />;
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
