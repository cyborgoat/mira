import { useCallback, useEffect, useState } from "react";
import { Edit3, Plus, Save, Trash2, Upload, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "../shared";
import type { MeetingNote, TeamNode } from "../types";
import { createBlankNote, formatDate, nodeLabel, renderMarkdown, toDateInput } from "../helpers";
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
  const [isEditing, setIsEditing] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const activeNote = activeId ? notes.find((note) => note.id === activeId) ?? null : null;
  const [draft, setDraft] = useState(createBlankNote(t("notes.blank")));
  const [uploadError, setUploadError] = useState("");
  const viewingContent = isCreating || isEditing ? draft.content : activeNote?.content ?? "";

  useEffect(() => {
    if (!activeId && !isCreating && notes[0]) setActiveId(notes[0].id);
  }, [activeId, isCreating, notes]);

  useEffect(() => {
    if (activeId && !activeNote) setActiveId(notes[0]?.id ?? "");
  }, [activeId, activeNote, notes]);

  useEffect(() => {
    if (activeNote && !isCreating && !isEditing) setDraft({ ...activeNote, date: toDateInput(activeNote.date) });
  }, [activeNote?.id]);

  const saveNote = useCallback(async () => {
    if (readOnly) return;
    const title = draft.title.trim() || t("notes.untitled");
    if (activeNote && !isCreating) {
      await onUpdate(activeNote.id, { title, date: draft.date, content: draft.content, tags: draft.tags });
      setIsEditing(false);
    } else {
      const created = await onCreate({ title, date: draft.date, content: draft.content, tags: draft.tags });
      setActiveId(created.id);
      setIsCreating(false);
      setIsEditing(false);
    }
  }, [activeNote, draft, isCreating, onCreate, onUpdate, readOnly]);

  const newNote = useCallback(() => {
    setDraft(createBlankNote(t("notes.blank")));
    setActiveId("");
    setIsCreating(true);
    setIsEditing(true);
  }, [t]);

  const editNote = () => {
    if (!activeNote || readOnly) return;
    setDraft({ ...activeNote, date: toDateInput(activeNote.date) });
    setIsCreating(false);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsCreating(false);
    setIsEditing(false);
    if (activeNote) setDraft({ ...activeNote, date: toDateInput(activeNote.date) });
    else if (notes[0]) setActiveId(notes[0].id);
  };

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
      setIsEditing(false);
      setShowUpload(false);
    } catch {
      setUploadError(t("notes.readError"));
    }
  };

  return (
    <div className="grid notes-grid tab-page notes-workspace">
      <Card className="stack note-list">
        <div className="row-between">
          <h2>{readOnly ? t("notes.teamTitle") : t("notes.title")}</h2>
          {!readOnly && (
            <div className="cluster">
              <Button type="button" size="sm" variant="secondary" onClick={() => setShowUpload((open) => !open)}>
                <Upload size={15} /> {t("common.upload")}
              </Button>
              <Button type="button" size="sm" onClick={newNote}>
                <Plus size={15} /> {t("notes.new")}
              </Button>
            </div>
          )}
        </div>
        {!readOnly && showUpload && (
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
                setIsEditing(false);
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

      <Card className="stack note-reader-card">
        <div className="row-between">
          <div>
            <h2>{isCreating ? t("notes.newNote") : activeNote?.title ?? t("notes.preview")}</h2>
            <p className="muted">{activeNote ? `${nodeLabel(nodes, activeNote.ownerNodeId)} · ${formatDate(activeNote.date)}` : t("notes.emptyText")}</p>
          </div>
          {!readOnly && activeNote && !isEditing && !isCreating && (
            <div className="cluster">
              <Button type="button" size="sm" variant="secondary" onClick={editNote}>
                <Edit3 size={14} /> {t("common.edit")}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => onDelete(activeNote.id)}>
                <Trash2 size={14} /> {t("common.delete")}
              </Button>
            </div>
          )}
        </div>
        {isCreating || isEditing ? (
          <div className="stack markdown-editor">
            <div className="editor-fields">
              <Input disabled={readOnly} value={draft.title} placeholder={t("notes.meetingTitle")} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
              <Input disabled={readOnly} type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} />
            </div>
            <Input disabled={readOnly} value={draft.tags} placeholder={t("notes.tagsPlaceholder")} onChange={(event) => setDraft({ ...draft, tags: event.target.value })} />
            <Textarea disabled={readOnly} className="markdown-source" value={draft.content} onChange={(event) => setDraft({ ...draft, content: event.target.value })} />
            {!readOnly && (
              <div className="row-between">
                <Button type="button" variant="secondary" onClick={cancelEditing}>
                  <X size={15} /> {t("llmWiki.cancelEdit")}
                </Button>
                <Button type="button" onClick={saveNote}>
                  <Save size={15} /> {t("notes.saveNote")}
                </Button>
              </div>
            )}
          </div>
        ) : activeNote ? (
          <div className="markdown-preview note-preview" dangerouslySetInnerHTML={{ __html: renderMarkdown(viewingContent) }} />
        ) : (
          <EmptyState title={t("notes.emptyTitle")} text={t("notes.emptyText")} actionLabel={readOnly ? undefined : t("notes.newNote")} onAction={newNote} />
        )}
      </Card>
    </div>
  );
}

function today() {
  return new Date().toISOString().slice(0, 10);
}
