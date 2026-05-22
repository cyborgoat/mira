import { invoke } from '@tauri-apps/api/core';
import type { AppState, ChatMsg, ProjectContext } from '../types';

interface PersistedAppState {
  tasks: AppState['tasks'];
  projects: AppState['projects'];
  chatHistory: AppState['chatHistory'];
  wikiChatHistory: AppState['wikiChatHistory'];
}

interface ClaudeMessage {
  role: string;
  content: string;
}

export const tauriCommands = {
  loadState: () => invoke<PersistedAppState>('load_state'),

  saveState: (state: PersistedAppState) =>
    invoke<void>('save_state', { state }),

  askMira: (messages: ClaudeMessage[], tasksContext: string) =>
    invoke<string>('ask_mira', { messages, tasksContext }),

  askWiki: (messages: ClaudeMessage[], projectContext: ProjectContext) =>
    invoke<string>('ask_wiki', { messages, projectContext }),

  polishReport: (reportMarkdown: string, tasksContext: string) =>
    invoke<string>('polish_report', { reportMarkdown, tasksContext }),

  getApiKeySet: () => invoke<boolean>('get_api_key_set'),

  setApiKey: (key: string, model: string) =>
    invoke<void>('set_api_key', { key, model }),

  getModel: () => invoke<string>('get_model'),
};

export function chatMsgToApiFormat(msg: ChatMsg): ClaudeMessage {
  return { role: msg.role, content: msg.content };
}
