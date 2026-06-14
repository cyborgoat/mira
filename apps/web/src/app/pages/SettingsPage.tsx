import { useEffect, useState } from "react";
import { Bot, Download, GitFork, KeyRound, Plus, Save, Trash2, Upload, UserRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { LlmConfig, LlmProvider, SettingsTab, TeamNode, UpdateLlmConfigPayload, User, WorkView } from "../types";
import { InlineStats, LanguageSelect, confirmAction } from "../shared";
import { buildStats, buildTreeRows, nodePath } from "../helpers";

type SettingsViewProps = {
  user: User;
  nodes: TeamNode[];
  teamView: WorkView | null;
  onUpdateProfile: (payload: { name: string; email: string; role: string }) => Promise<void>;
  onUpdatePassword: (payload: { currentPassword: string; newPassword: string }) => Promise<void>;
  onCreate: (payload: { name: string; title?: string; parentId?: string }) => Promise<void>;
  onUpdate: (id: string, payload: { name?: string; title?: string | null; parentId?: string | null }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onLoadLlmConfig: () => Promise<LlmConfig>;
  onUpdateLlmConfig: (payload: UpdateLlmConfigPayload) => Promise<LlmConfig>;
  onExport: () => Promise<void>;
  onImport: (file: File | undefined) => Promise<void>;
  onReset: () => Promise<void>;
};

export function SettingsView({
  user,
  nodes,
  teamView,
  onUpdateProfile,
  onUpdatePassword,
  onCreate,
  onUpdate,
  onDelete,
  onLoadLlmConfig,
  onUpdateLlmConfig,
  onExport,
  onImport,
  onReset,
}: SettingsViewProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<SettingsTab>("account");
  const [editingId, setEditingId] = useState("");
  const tabs: Array<{ key: SettingsTab; label: string; icon: React.ComponentType<{ size?: number }> }> = [
    { key: "account", label: t("settings.account"), icon: UserRound },
    { key: "security", label: t("settings.password"), icon: KeyRound },
    { key: "llm", label: t("settings.llmConfig"), icon: Bot },
    ...(user.canManageSettings ? [{ key: "team" as SettingsTab, label: t("settings.teamTree"), icon: GitFork }] : []),
  ];

  useEffect(() => {
    if (activeTab === "team" && !user.canManageSettings) setActiveTab("account");
  }, [activeTab, user.canManageSettings]);

  return (
    <div className="settings-layout">
      <nav className="settings-tabs" aria-label={t("settings.sections")}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button className={`settings-tab ${activeTab === tab.key ? "active" : ""}`} type="button" key={tab.key} onClick={() => setActiveTab(tab.key)}>
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="settings-content">
        {activeTab === "account" && <AccountSettingsPanel user={user} onSubmit={onUpdateProfile} />}
        {activeTab === "security" && <PasswordSettingsPanel onSubmit={onUpdatePassword} />}
        {activeTab === "team" && user.canManageSettings && (
          <TeamManagementTab
            user={user}
            nodes={nodes}
            editingId={editingId}
            setEditingId={setEditingId}
            onCreate={onCreate}
            onUpdate={onUpdate}
            onDelete={onDelete}
            onExport={onExport}
            onImport={onImport}
            onReset={onReset}
            teamView={teamView}
          />
        )}
        {activeTab === "llm" && <LlmSettingsPanel onLoad={onLoadLlmConfig} onSubmit={onUpdateLlmConfig} />}
      </div>
    </div>
  );
}

function AccountSettingsPanel({ user, onSubmit }: { user: User; onSubmit: (payload: { name: string; email: string; role: string }) => Promise<void> }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState({ name: user.teamNode?.name ?? "", email: user.email, role: user.role ?? "" });

  useEffect(() => {
    setDraft({ name: user.teamNode?.name ?? "", email: user.email, role: user.role ?? "" });
  }, [user.email, user.role, user.teamNode?.name]);

  return (
    <Card className="stack settings-panel">
      <div className="panel-heading">
        <div>
          <h2>{t("settings.account")}</h2>
          <p className="muted">{t("settings.accountHelp")}</p>
        </div>
        <Badge>{user.isSuperuser ? t("common.superuser") : t("common.user")}</Badge>
      </div>
      <div className="settings-form">
        <label className="field">
          <span>{t("settings.name")}</span>
          <Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
        </label>
        <label className="field">
          <span>{t("settings.email")}</span>
          <Input type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} />
        </label>
        <label className="field">
          <span>{t("settings.role")}</span>
          <Input value={draft.role} placeholder={t("settings.rolePlaceholder")} onChange={(event) => setDraft({ ...draft, role: event.target.value })} />
        </label>
        <div className="settings-meta">
          <span>{t("settings.treeNode")}</span>
          <strong>{user.teamNode?.title || t("common.noTitle")}</strong>
        </div>
        <div className="settings-meta">
          <span>{t("language.label")}</span>
          <LanguageSelect />
        </div>
      </div>
      <div className="row-between">
        <span className="muted">{t("settings.roleHelp")}</span>
        <Button type="button" disabled={!draft.name.trim() || !draft.email.trim()} onClick={() => onSubmit({ name: draft.name, email: draft.email, role: draft.role })}>
          <Save size={15} /> {t("settings.saveAccount")}
        </Button>
      </div>
    </Card>
  );
}

function PasswordSettingsPanel({ onSubmit }: { onSubmit: (payload: { currentPassword: string; newPassword: string }) => Promise<void> }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const mismatch = draft.newPassword && draft.confirmPassword && draft.newPassword !== draft.confirmPassword;
  const canSave = draft.currentPassword.length > 0 && draft.newPassword.length >= 8 && draft.newPassword === draft.confirmPassword;

  const save = async () => {
    if (!canSave) return;
    await onSubmit({ currentPassword: draft.currentPassword, newPassword: draft.newPassword });
    setDraft({ currentPassword: "", newPassword: "", confirmPassword: "" });
  };

  return (
    <Card className="stack settings-panel">
      <div className="panel-heading">
        <div>
          <h2>{t("settings.password")}</h2>
          <p className="muted">{t("settings.passwordHelp")}</p>
        </div>
        <Badge>{t("common.private")}</Badge>
      </div>
      <div className="settings-form">
        <label className="field">
          <span>{t("settings.currentPassword")}</span>
          <Input type="password" value={draft.currentPassword} onChange={(event) => setDraft({ ...draft, currentPassword: event.target.value })} />
        </label>
        <label className="field">
          <span>{t("settings.newPassword")}</span>
          <Input type="password" value={draft.newPassword} onChange={(event) => setDraft({ ...draft, newPassword: event.target.value })} />
        </label>
        <label className="field">
          <span>{t("settings.confirmPassword")}</span>
          <Input type="password" value={draft.confirmPassword} onChange={(event) => setDraft({ ...draft, confirmPassword: event.target.value })} />
        </label>
      </div>
      <div className="row-between">
        <span className={mismatch ? "form-inline-error" : "muted"}>{mismatch ? t("settings.passwordMismatch") : t("settings.passwordNextLogin")}</span>
        <Button type="button" disabled={!canSave} onClick={save}>
          <Save size={15} /> {t("settings.updatePassword")}
        </Button>
      </div>
    </Card>
  );
}

function TeamManagementTab({
  nodes,
  editingId,
  setEditingId,
  onCreate,
  onUpdate,
  onDelete,
  onExport,
  onImport,
  onReset,
  teamView,
}: {
  nodes: TeamNode[];
  editingId: string;
  setEditingId: (value: string) => void;
  onCreate: (payload: { name: string; title?: string; parentId?: string }) => Promise<void>;
  onUpdate: (id: string, payload: { name?: string; title?: string | null; parentId?: string | null }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onExport: () => Promise<void>;
  onImport: (file: File | undefined) => Promise<void>;
  onReset: () => Promise<void>;
  user: User;
  teamView: WorkView | null;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState({ name: "", title: "", parentId: "root" });
  const [importError, setImportError] = useState("");
  const editingNode = nodes.find((node) => node.id === editingId);
  const rows = buildTreeRows(nodes);
  const stats = teamView ? buildStats(teamView.tasks, teamView.notes) : buildStats([], []);

  const save = async () => {
    const name = draft.name.trim();
    if (!name) return;
    if (editingNode) {
      await onUpdate(editingNode.id, { name, title: draft.title.trim() || undefined, parentId: draft.parentId === "root" ? undefined : draft.parentId });
      setEditingId("");
    } else {
      await onCreate({ name, title: draft.title.trim() || undefined, parentId: draft.parentId === "root" ? undefined : draft.parentId });
    }
    setDraft({ name: "", title: "", parentId: "root" });
  };

  return (
    <div className="grid team-grid">
      <Card className="stack">
        <div className="row-between">
          <h2>{t("settings.teamTree")}</h2>
          <Badge>{t("settings.nodes", { count: nodes.length })}</Badge>
        </div>
        <div className="team-tree">
          {rows.map(({ node, depth }) => (
            <button
              className={`team-node ${node.id === editingId ? "active" : ""}`}
              key={node.id}
              style={{ paddingLeft: 10 + depth * 18 }}
              onClick={() => {
                setEditingId(node.id);
                setDraft({ name: node.name, title: node.title ?? "", parentId: node.parentId ?? "root" });
              }}
            >
              <span>{node.name}</span>
              <small>{node.title || t("common.untitledRole")}</small>
            </button>
          ))}
        </div>
      </Card>
      <Card className="stack">
        <div className="row-between">
          <h2>{editingNode ? t("settings.editNode") : t("settings.addNode")}</h2>
          {editingNode && <Badge>{editingNode.name}</Badge>}
        </div>
        <Input value={draft.name} placeholder={t("settings.name")} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
        <Input value={draft.title} placeholder={t("settings.rolePlaceholder")} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
        <Select value={draft.parentId} onValueChange={(value) => setDraft({ ...draft, parentId: value })}>
          <SelectTrigger><SelectValue placeholder={t("settings.parentNode")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="root">{t("settings.topLevel")}</SelectItem>
            {nodes.filter((node) => node.id !== editingId).map((node) => (
              <SelectItem value={node.id} key={node.id}>{nodePath(nodes, node)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="row-between">
          <Button type="button" variant="secondary" onClick={() => { setEditingId(""); setDraft({ name: "", title: "", parentId: "root" }); }}>{t("common.clear")}</Button>
          <Button type="button" disabled={!draft.name.trim()} onClick={save}>{editingNode ? <Save size={15} /> : <Plus size={15} />} {editingNode ? t("common.save") : t("common.add")}</Button>
        </div>
        {editingNode && (
          <Button type="button" variant="ghost" onClick={() => confirmAction(t("settings.deleteNodeConfirm"), () => onDelete(editingNode.id))}>
            <Trash2 size={15} /> {t("settings.deleteNode")}
          </Button>
        )}
      </Card>
      <Card className="stack">
        <h2>{t("settings.workspaceData")}</h2>
        <p className="muted">{t("settings.workspaceDataHelp")}</p>
        <div className="row tool-row">
          <Button type="button" variant="secondary" onClick={onExport}><Download size={15} /> {t("common.export")}</Button>
          <label className="upload-button tool-upload">
            <Upload size={15} /> {t("common.import")}
            <Input type="file" accept="application/json,.json" onChange={(event) => onImport(event.target.files?.[0])} />
          </label>
          <Button type="button" variant="ghost" onClick={() => confirmAction(t("settings.resetConfirm"), onReset)}>
            <Trash2 size={15} /> {t("common.reset")}
          </Button>
        </div>
        <InlineStats stats={stats} t={t} />
      </Card>
    </div>
  );
}

const providerDefaults: Record<LlmProvider, { baseUrl: string; model: string }> = {
  openai: { baseUrl: "https://api.openai.com/v1", model: "gpt-5.2" },
  openrouter: { baseUrl: "https://openrouter.ai/api/v1", model: "gpt-5.2" },
  anthropic: { baseUrl: "https://api.anthropic.com", model: "claude-3-5-sonnet-latest" },
  "custom-openai-compatible": { baseUrl: "https://api.openai.com/v1", model: "gpt-5.2" },
};

function LlmSettingsPanel({ onLoad, onSubmit }: { onLoad: () => Promise<LlmConfig>; onSubmit: (payload: UpdateLlmConfigPayload) => Promise<LlmConfig> }) {
  const { t } = useTranslation();
  const [config, setConfig] = useState<LlmConfig | null>(null);
  const [draft, setDraft] = useState({
    provider: "openai" as LlmProvider,
    baseUrl: "",
    model: "",
    apiKey: "",
    maxTokens: 4000,
    timeoutMs: 45000,
    proxy: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [manuallyEditedEndpoint, setManuallyEditedEndpoint] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    void onLoad()
      .then((next) => {
        if (cancelled) return;
        setConfig(next);
        setDraft({
          provider: next.provider,
          baseUrl: next.baseUrl,
          model: next.model,
          apiKey: "",
          maxTokens: next.maxTokens,
          timeoutMs: next.timeoutMs,
          proxy: next.proxy,
        });
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : t("errors.generic"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [onLoad, t]);

  const setProvider = (provider: LlmProvider) => {
    const defaults = providerDefaults[provider];
    setDraft((current) => ({
      ...current,
      provider,
      baseUrl: manuallyEditedEndpoint ? current.baseUrl : defaults.baseUrl,
      model: manuallyEditedEndpoint ? current.model : defaults.model,
    }));
  };

  const save = async (clearApiKey = false) => {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const next = await onSubmit({
        provider: draft.provider,
        baseUrl: draft.baseUrl,
        model: draft.model,
        maxTokens: draft.maxTokens,
        timeoutMs: draft.timeoutMs,
        proxy: draft.proxy,
        ...(draft.apiKey.trim() ? { apiKey: draft.apiKey.trim() } : {}),
        ...(clearApiKey ? { clearApiKey: true } : {}),
      });
      setConfig(next);
      setDraft({ ...draft, apiKey: "" });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.generic"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="stack settings-panel llm-settings-panel">
      <div className="panel-heading">
        <div>
          <h2>{t("settings.llmConfig")}</h2>
          <p className="muted">{t("settings.llmConfigHelp")}</p>
        </div>
        <Badge>{config?.hasApiKey ? t("settings.apiKeyConfigured") : t("settings.apiKeyMissing")}</Badge>
      </div>
      {loading ? (
        <p className="muted">{t("settings.loadingLlmConfig")}</p>
      ) : (
        <>
          <div className="settings-form llm-settings-form">
            <label className="field">
              <span>{t("settings.provider")}</span>
              <Select value={draft.provider} onValueChange={(value) => setProvider(value as LlmProvider)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="openrouter">OpenRouter</SelectItem>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                  <SelectItem value="custom-openai-compatible">{t("settings.customProvider")}</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label className="field">
              <span>{t("settings.model")}</span>
              <Input value={draft.model} onChange={(event) => { setManuallyEditedEndpoint(true); setDraft({ ...draft, model: event.target.value }); }} />
            </label>
            <label className="field">
              <span>{t("settings.baseUrl")}</span>
              <Input value={draft.baseUrl} onChange={(event) => { setManuallyEditedEndpoint(true); setDraft({ ...draft, baseUrl: event.target.value }); }} />
            </label>
            <label className="field">
              <span>{t("settings.apiKey")}</span>
              <Input
                type="password"
                value={draft.apiKey}
                placeholder={config?.hasApiKey ? t("settings.apiKeyKeepPlaceholder") : t("settings.apiKeyNewPlaceholder")}
                onChange={(event) => setDraft({ ...draft, apiKey: event.target.value })}
              />
            </label>
            <label className="field">
              <span>{t("settings.maxTokens")}</span>
              <Input type="number" min={1} value={draft.maxTokens} onChange={(event) => setDraft({ ...draft, maxTokens: Number(event.target.value) })} />
            </label>
            <label className="field">
              <span>{t("settings.timeoutMs")}</span>
              <Input type="number" min={1000} value={draft.timeoutMs} onChange={(event) => setDraft({ ...draft, timeoutMs: Number(event.target.value) })} />
            </label>
            <label className="field">
              <span>{t("settings.proxy")}</span>
              <Input value={draft.proxy} placeholder={t("settings.proxyPlaceholder")} onChange={(event) => setDraft({ ...draft, proxy: event.target.value })} />
            </label>
            <div className="settings-meta">
              <span>{t("settings.configSource")}</span>
              <strong>{config ? t(`settings.configSources.${config.source}`) : t("common.unknown")}</strong>
            </div>
          </div>
          {error && <div className="form-inline-error">{error}</div>}
          <div className="row-between">
            <span className="muted">{saved ? t("settings.llmConfigSaved") : t("settings.llmConfigNote")}</span>
            <div className="row tool-row">
              {config?.hasApiKey && (
                <Button type="button" variant="ghost" disabled={saving} onClick={() => void save(true)}>
                  <Trash2 size={15} /> {t("settings.clearApiKey")}
                </Button>
              )}
              <Button type="button" disabled={saving || !draft.baseUrl.trim() || !draft.model.trim()} onClick={() => void save(false)}>
                <Save size={15} /> {saving ? t("settings.savingLlmConfig") : t("settings.saveLlmConfig")}
              </Button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

