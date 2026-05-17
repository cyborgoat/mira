import { ChangeEvent, useCallback, useEffect, useState } from "react";
import { Plus, Save, Trash2, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "../shared";
import type { MeetingNote, TeamNode, WorkView } from "../types";
import { createBlankNote, formatDate, firstLines, nodeLabel, renderMarkdown, toDateInput } from "../helpers";
import { useKeyboardShortcuts } from "../shared";

type NotesViewProps = {
  notes: MeetingNote[];
  nodes: TeamNode[];
  readOnly: boolean;
  onCreate: (payload: { title: string; date: string; content: string; tags: string }) => Promise<MeetingNote>;
  onUpdate: (id: string, payload: { title?: string; date?: string; content?: string; tags?: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

export function NotesView({ notes, nodes, readOnly, onCreate, onUpdate, onDelete }: NotesViewProps) {
  const { t } = useTranslation();
  const [activeId, setActiveId] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const activeNote = activeId ? notes.find((note) => note.id === activeId) ?? null : null;
  const [draft, setDraft] = useState(createBlankNote(t("notes.blank")));
  const [uploadError, setUploadError] = useState("");

  useEffect(() => {
    if (!activeId && !isCreating && notes[0]) setActiveId(notes[0].id);
  }, [activeId, isCreating, notes]);

  useEffect(() => {
    if (activeId && !activeNote) setActiveId(notes[0]?.id ?? "");
  }, [activeId, activeNote, notes]);

  useEffect(() => {
    if (activeNote) setDraft({ ...activeNote, date: toDateInput(activeNote.date) });
  }, [activeNote?.id]);

  const saveNote = useCallback(async () => {
    if (readOnly) return;
    const title = draft.title.trim() || t("notes.untitled");
    if (activeNote && !isCreating) {
      await onUpdate(activeNote.id, { title, date: draft.date, content: draft.content, tags: draft.tags });
    } else {
      const created = await onCreate({ title, date: draft.date, content: draft.content, tags: draft.tags });
      setActiveId(created.id);
      setIsCreating(false);
    }
  }, [activeNote, draft, isCreating, onCreate, onUpdate, readOnly]);

  const newNote = useCallback(() => {
    setDraft(createBlankNote(t("notes.blank")));
    setActiveId("");
    setIsCreating(true);
  }, [t]);

  useKeyboardShortcuts({ onSave: saveNote, onNew: newNote, enabled: !readOnly });

  const uploadNote = async (file: File | undefined) => {
    if (!file || readOnly) return;
    setUploadError("");
    if (!/\.(md|markdown|txt)$/i.test(file.name)) {
      setUploadError(t("notes.uploadError"));
      return;
    }
    try {
      const content = await file.text();
      const title = file.name.replace(/\.(md|markdown|txt)$/i, "");
      const created = await onCreate({ title, date: today(), content, tags: "" });
      setActiveId(created.id);
      setIsCreating(false);
    } catch {
      setUploadError(t("notes.readError"));
    }
  };

  return (
    <div className="grid notes-grid tab-page">
      <Card className="stack note-list">
        <div className="row-between">
          <h2>{readOnly ? t("notes.teamTitle") : t("notes.title")}</h2>
          {!readOnly && (
            <Button type="button" size="sm" onClick={newNote}>
              <Plus size={15} /> {t("notes.new")}
            </Button>
          )}
        </div>
        {!readOnly && (
          <label className="upload-button">
            <Upload size={15} />
            {t("notes.uploadMarkdown")}
            <Input type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" onChange={(event) => uploadNote(event.target.files?.[0])} />
          </label>
        )}
        {uploadError && <div className="form-error">{uploadError}</div>}
        <div className="item-list note-tab-list">
          {notes.map((note) => (
            <button
              className={`note-tab ${note.id === activeId ? "active" : ""}`}
              key={note.id}
              onClick={() => {
                setIsCreating(false);
                setActiveId(note.id);
              }}
            >
              <span>{note.title}</span>
              <small>{nodeLabel(nodes, note.ownerNodeId)} · {formatDate(note.date)}</small>
              {note.tags && <small>{note.tags}</small>}
            </button>
          ))}
          {!notes.length && <EmptyState title={t("notes.emptyTitle")} text={t("notes.emptyText")} actionLabel={readOnly ? undefined : t("notes.newNote")} onAction={newNote} />}
        </div>
      </Card>

      <Card className="stack markdown-editor">
        <div className="row-between">
          <h2>{t("notes.markdownEditor")}</h2>
          <Badge>{formatDate(draft.date)}</Badge>
        </div>
        <div className="editor-fields">
          <Input disabled={readOnly} value={draft.title} placeholder={t("notes.meetingTitle")} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
          <Input disabled={readOnly} type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} />
        </div>
        <Input disabled={readOnly} value={draft.tags} placeholder={t("notes.tagsPlaceholder")} onChange={(event) => setDraft({ ...draft, tags: event.target.value })} />
        <Textarea disabled={readOnly} className="markdown-source" value={draft.content} onChange={(event) => setDraft({ ...draft, content: event.target.value })} />
        {!readOnly && (
          <div className="row-between">
            <Button type="button" variant="secondary" disabled={!activeNote} onClick={() => activeNote && onDelete(activeNote.id)}>
              <Trash2 size={15} /> {t("common.delete")}
            </Button>
            <Button type="button" onClick={saveNote}>
              <Save size={15} /> {t("notes.saveNote")}
            </Button>
          </div>
        )}
      </Card>

      <Card className="stack markdown-preview-card">
        <h2>{t("notes.preview")}</h2>
        <div className="markdown-preview" dangerouslySetInnerHTML={{ __html: renderMarkdown(draft.content) }} />
      </Card>
    </div>
  );
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

