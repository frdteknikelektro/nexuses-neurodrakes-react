import { useCallback, useEffect, useState } from 'react';
import {
  applyParleyUpdates,
  beginParleyRun,
  chooseParleyReward,
  makeInitialParleyState,
  startParleySession,
  type ParleyBeat,
  type ParleyCharStub,
  type ParleyState,
  type ParleyUpdate,
} from '../engine/parley';

const SESSION_STORAGE_KEY = 'nexuses-neurodrakes.parley.v3';

function loadSession(): ParleyState | null {
  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ParleyState) : null;
  } catch {
    return null;
  }
}

function saveSession(state: ParleyState): void {
  try {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage failures.
  }
}

function clearSession(): void {
  try {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}

export function useParleyState() {
  const [state, setState] = useState<ParleyState>(() => loadSession() ?? makeInitialParleyState());

  useEffect(() => {
    if (state.phase === 'hero_select' && !state.runSeed) {
      clearSession();
      return;
    }
    saveSession(state);
  }, [state]);

  const startSession = useCallback((charData: ParleyCharStub, seed: string) => {
    setState(() => startParleySession(charData, seed));
  }, []);

  const beginRun = useCallback(() => {
    setState(prev => beginParleyRun(prev));
  }, []);

  const chooseReward = useCallback((rewardId: string) => {
    setState(prev => chooseParleyReward(prev, rewardId));
  }, []);

  const setActiveTool = useCallback((toolId: string | null) => {
    setState(prev => {
      const tool = toolId ? prev.dialogTools.find(item => item.id === toolId) : null;
      if (toolId && (!tool || tool.used)) return prev;
      return { ...prev, activeToolId: prev.activeToolId === toolId ? null : toolId };
    });
  }, []);

  const resetSession = useCallback(() => {
    clearSession();
    setState(makeInitialParleyState());
  }, []);

  const addPlayerMessage = useCallback((text: string) => {
    setState(prev => ({
      ...prev,
      messages: [...prev.messages, { type: 'player', speaker: prev.hero?.name ?? 'Player', text }],
    }));
  }, []);

  const setResolving = useCallback((isResolving: boolean) => {
    setState(prev => ({ ...prev, isResolving }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState(prev => ({ ...prev, error, isResolving: false }));
  }, []);

  const applyUpdates = useCallback((
    updates: ParleyUpdate[],
    narration: string,
    suggestions: string[],
    beats: ParleyBeat[] = [],
  ) => {
    setState(prev => applyParleyUpdates(prev, updates, narration, suggestions, beats));
  }, []);

  return {
    state,
    startSession,
    beginRun,
    chooseReward,
    setActiveTool,
    resetSession,
    addPlayerMessage,
    setResolving,
    setError,
    applyUpdates,
  } as const;
}
