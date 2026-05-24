import { useEffect, useState } from "react";
import { Download, GitFork, KeyRound, Plus, Save, Trash2, Upload, UserRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { MeetingNote, SettingsTab, Task, TeamNode, User, WorkView } from "../types";
import { InlineStats, LanguageSelect } from "../shared";
import { buildStats, nodePath } from "../helpers";

type SettingsViewProps = {
  user: User;
  nodes: TeamNode[];
  teamView: WorkView | null;
  onUpdateProfile: (payload: { name: string; email: string; role: string }) => Promise<void>;
  onUpdatePassword: (payload: { currentPassword: string; newPassword: string }) => Promise<void>;
  onCreate: (payload: { name: string; title?: string; parentId?: string }) => Promise<void>;
  onUpdate: (id: string, payload: { name?: string; title?: string | null; parentId?: string | null }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
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

function buildTreeRows(nodes: TeamNode[]) {
  const byParent = new Map<string, TeamNode[]>();
  for (const node of nodes) byParent.set(node.parentId ?? "root", [...(byParent.get(node.parentId ?? "root") ?? []), node]);
  for (const siblings of byParent.values()) siblings.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  const rows: Array<{ node: TeamNode; depth: number }> = [];
  const visit = (parentId: string, depth: number) => {
    for (const node of byParent.get(parentId) ?? []) {
      rows.push({ node, depth });
      visit(node.id, depth + 1);
    }
  };
  visit("root", 0);
  return rows;
}

function confirmAction(message: string, action: () => void | Promise<void>) {
  if (window.confirm(message)) void action();
}

