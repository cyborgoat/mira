import { KeyboardEvent, useEffect, useRef, useState } from "react";
import { Send, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "../shared";
import type { AskMiraSourceType, LlmWikiOwner, AskMiraSource, AskMiraMessage, ViewMode } from "../types";
import { renderMarkdown } from "../helpers";

type AskMiraViewProps = {
  canViewTeam: boolean;
  viewMode: ViewMode;
  onLoadOwners: () => Promise<LlmWikiOwner[]>;
  onAsk: (payload: { question: string; language: "en" | "zh"; scope: "personal" | "team"; ownerId?: string }) => Promise<{ answer: string; sources: AskMiraSource[] }>;
};

export function AskMiraView({ canViewTeam, viewMode, onLoadOwners, onAsk }: AskMiraViewProps) {
  const { t, i18n: i18nInstance } = useTranslation();
  const language = i18nInstance.resolvedLanguage?.startsWith("zh") ? "zh" : "en";
  const isTeamView = viewMode === "team" && canViewTeam;
  const [owners, setOwners] = useState<LlmWikiOwner[]>([]);
  const [target, setTarget] = useState<"team" | string>("team");
  const [messages, setMessages] = useState<AskMiraMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [selectedSource, setSelectedSource] = useState<AskMiraSource | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const askScope = isTeamView ? "team" : "personal";
  const queryOwnerId = isTeamView && target !== "team" ? target : undefined;

  useEffect(() => {
    if (!isTeamView) {
      setOwners([]);
      setTarget("team");
      setMessages([]);
      return;
    }
    void onLoadOwners()
      .then((list) => {
        setOwners(list);
        if (list[0]) setTarget("team");
      })
      .catch((err) => setError(errorMessage(err)));
  }, [isTeamView, onLoadOwners]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages, loading]);

  const sendQuestion = async () => {
    const cleanQuestion = question.trim();
    if (!cleanQuestion) return;
    const nextQuestion: AskMiraMessage = { id: `q-${Date.now()}`, role: "user", content: cleanQuestion, createdAt: new Date().toISOString() };
    setMessages((current) => [...current, nextQuestion]);
    setQuestion("");
    setLoading(true);
    setError("");
    try {
      const result = await onAsk({
        question: cleanQuestion,
        language,
        scope: askScope,
        ownerId: queryOwnerId,
      });
      setMessages((current) => [...current, { id: `a-${Date.now()}`, role: "assistant", content: result.answer, sources: result.sources, createdAt: new Date().toISOString() }]);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setSelectedSource(null);
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    void sendQuestion();
  };

  const ownerLabel = isTeamView ? (target === "team" ? t("askMira.teamScope") : owners.find((owner) => owner.id === target)?.name || t("askMira.individual")) : t("askMira.personalScope");

  const sourceTypeLabel: Record<AskMiraSourceType, string> = {
    wiki: t("askMira.sourceTypes.wiki"),
    "wiki-index": t("askMira.sourceTypes.wikiIndex"),
    "wiki-page": t("askMira.sourceTypes.wikiPage"),
    task: t("askMira.sourceTypes.task"),
    note: t("askMira.sourceTypes.note"),
    "team-member": t("askMira.sourceTypes.teamMember"),
  };

  return (
    <div className="ask-mira-shell">
      <div className="ask-mira-layout">
        <Card className="stack ask-chat">
          <div className="ask-chat-toolbar">
            <div>
              <h2>{t("askMira.title")}</h2>
              <span>{t("askMira.scope")}: {ownerLabel}</span>
            </div>
            <div className="ask-chat-actions">
              {isTeamView ? (
                <Select value={target} onValueChange={(next) => setTarget(next)}>
                  <SelectTrigger className="ask-scope-select"><SelectValue placeholder={t("askMira.targetScope")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="team">{t("askMira.teamScope")}</SelectItem>
                    {owners.map((owner) => (
                      <SelectItem value={owner.id} key={owner.id}>{owner.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Badge>{t("askMira.personalScope")}</Badge>
              )}
              <Button type="button" variant="ghost" size="sm" onClick={clearChat}>
                <Trash2 size={14} /> {t("askMira.clearChat")}
              </Button>
            </div>
          </div>
          <div className="ask-chat-scroll">
            {messages.map((message) => (
              <div className={`chat-message ${message.role}`} key={message.id}>
                <div className="chat-message-meta">
                  <span>{message.role === "user" ? t("askMira.userRole") : t("askMira.assistantRole")}</span>
                  <time>{formatChatTime(message.createdAt)}</time>
                </div>
                <div className="chat-bubble">
                  <div className="markdown compact-markdown" dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }} />
                </div>
                {message.sources?.length ? (
                  <div className="chat-sources">
                    <h3>{t("askMira.sources")}</h3>
                    {message.sources.map((source) => (
                      <button
                        type="button"
                        className="source-card"
                        key={source.id}
                        onClick={() => setSelectedSource(source)}
                      >
                        <strong>{source.title}</strong>
                        <span>{sourceTypeLabel[source.type]} · {source.ownerName}</span>
                        <small>{source.snippet}</small>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
            {loading && (
              <div className="chat-message assistant">
                <div className="chat-message-meta">
                  <span>{t("askMira.assistantRole")}</span>
                  <time>{formatChatTime(new Date().toISOString())}</time>
                </div>
                <div className="chat-bubble loading-bubble" aria-label={t("askMira.thinking")}>
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}
            {error && <div className="form-error">{error}</div>}
            <div ref={chatEndRef} />
          </div>
          <div className="ask-composer">
            <Textarea
              className="compact"
              value={question}
              placeholder={t("askMira.placeholder")}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={handleComposerKeyDown}
            />
            <div className="row">
              <Button
                type="button"
                disabled={loading || !question.trim()}
                onClick={() => void sendQuestion()}
              >
                <Send size={15} /> {loading ? t("askMira.asking") : t("askMira.ask")}
              </Button>
            </div>
          </div>
        </Card>

        <Card className="stack ask-source-view">
          <div className="row-between">
            <h2>{t("askMira.selectedSource")}</h2>
            {selectedSource ? <Badge>{sourceTypeLabel[selectedSource.type]}</Badge> : <Badge>{t("askMira.noSourceOpen")}</Badge>}
          </div>
          {selectedSource ? (
            <div className="stack">
              <div className="source-meta">
                <strong>{selectedSource.title}</strong>
                <small>{sourceTypeLabel[selectedSource.type]} · {selectedSource.ownerName}</small>
                {selectedSource.path && <small>{selectedSource.path}</small>}
              </div>
              <div className="markdown compact-markdown" dangerouslySetInnerHTML={{ __html: renderMarkdown(selectedSource.content) }} />
            </div>
          ) : (
            <EmptyState title={t("askMira.selectSourceTitle")} text={t("askMira.selectSourceText")} />
          )}
        </Card>
      </div>
    </div>
  );
}

function formatChatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : "Failed to ask Mira";
}
