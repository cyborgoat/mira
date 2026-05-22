import React, { createContext, useContext, useReducer, useEffect, useState } from 'react';
import type { AppState, Task, ChatMsg } from '../types';
import { PROJECTS } from '../constants';
import { reducer, type Action } from './actions';
import { tauriCommands } from '../hooks/useTauri';
import { buildSeed } from '../lib/seed';

const initialState: AppState = {
  tasks: [],
  projects: PROJECTS,
  route: 'tasks',
  chatHistory: [],
  wikiChatHistory: [],
};

interface StoreContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  ready: boolean;
}

const StoreContext = createContext<StoreContextValue>({
  state: initialState,
  dispatch: () => {},
  ready: false,
});

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [ready, setReady] = useState(false);

  // Load state from Rust on mount
  useEffect(() => {
    tauriCommands.loadState().then((persisted) => {
      const hasTasks = Array.isArray(persisted.tasks) && persisted.tasks.length > 0;
      if (!hasTasks) {
        const seed = buildSeed();
        dispatch({ type: 'HYDRATE', state: { ...seed, route: 'tasks' } });
      } else {
        dispatch({
          type: 'HYDRATE',
          state: {
            tasks: persisted.tasks,
            projects: persisted.projects,
            chatHistory: persisted.chatHistory,
            wikiChatHistory: persisted.wikiChatHistory,
            route: 'tasks',
          },
        });
      }
      setReady(true);
    }).catch(() => {
      // Fallback to seed data if Tauri not available
      dispatch({ type: 'HYDRATE', state: { ...buildSeed(), route: 'tasks' } });
      setReady(true);
    });
  }, []);

  // Persist state to Rust whenever it changes (after initial load)
  useEffect(() => {
    if (!ready) return;
    tauriCommands.saveState({
      tasks: state.tasks,
      projects: state.projects,
      chatHistory: state.chatHistory,
      wikiChatHistory: state.wikiChatHistory,
    }).catch(console.error);
  }, [state.tasks, state.projects, state.chatHistory, state.wikiChatHistory, ready]);

  return (
    <StoreContext.Provider value={{ state, dispatch, ready }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  return useContext(StoreContext);
}

// Convenience action creators
export function useActions() {
  const { dispatch } = useStore();
  return {
    setRoute: (route: string) => dispatch({ type: 'SET_ROUTE', route }),
    addTask: (task: Partial<Task>) => dispatch({ type: 'ADD_TASK', task }),
    updateTask: (id: string, patch: Partial<Task>) => dispatch({ type: 'UPDATE_TASK', id, patch }),
    removeTask: (id: string) => dispatch({ type: 'REMOVE_TASK', id }),
    addChatMessage: (msg: ChatMsg) => dispatch({ type: 'ADD_CHAT_MESSAGE', msg }),
    clearChat: () => dispatch({ type: 'CLEAR_CHAT' }),
    addWikiChatMessage: (msg: ChatMsg) => dispatch({ type: 'ADD_WIKI_CHAT_MESSAGE', msg }),
    clearWikiChat: () => dispatch({ type: 'CLEAR_WIKI_CHAT' }),
    resetAll: () => dispatch({ type: 'RESET_ALL' }),
  };
}
