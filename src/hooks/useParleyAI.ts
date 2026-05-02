import { useCallback, useState } from 'react';
import type { DialogTool, EncounterTemplate, ParleyBeat, ParleyState, ParleyUpdate } from '../engine/parley';
import { COSTLY_PASS_THRESHOLD, INSIGHT_PASS_THRESHOLD, TRUST_PASS_THRESHOLD, getEncounterTemplate } from '../engine/parley';
import type { AIDebugTurn } from '../engine/dmHandler';

export interface ParleyClientGameState {
  mode: 'parley';
  hero: {
    id: string;
    name: string;
    race: string;
    class: string;
    skills: string[];
    stats: Record<string, number>;
  };
  pressure: number;
  maxPressure: number;
  playerHp: number;
  playerMaxHp: number;
  thresholds: {
    trustPass: number;
    insightPass: number;
    costlyPass: number;
  };
  wounds: { name: string; severity: number }[];
  encounterIndex: number;
  encounterCount: number;
  encounterTurnCount: number;
  encounterBeatId: string;
  encounterFlags: string[];
  lastEntityIntent: string | null;
  encounter: {
    id: string;
    name: string;
    threat: string;
    premise: string;
    trust: number;
    insight: number;
    enemyHp: number;
    enemyMaxHp: number;
    clues: string[];
    hidden: Pick<EncounterTemplate, 'need' | 'fear' | 'taboo' | 'leverage'> | null;
  };
  activeToolId: string | null;
  dialogTools: Pick<DialogTool, 'id' | 'kind' | 'name' | 'description' | 'used'>[];
  recentMessages: { type: string; speaker?: string; text: string }[];
}

export interface ParleyDMResponse {
  updates: ParleyUpdate[];
  narration: string;
  beats: ParleyBeat[];
  suggestions: string[];
  debug?: AIDebugTurn;
}

export type { AIDebugTurn };

export function buildParleyClientGameState(state: ParleyState): ParleyClientGameState | null {
  if (!state.hero || !state.encounter) return null;
  const template = getEncounterTemplate(state.encounter.id);
  return {
    mode: 'parley',
    hero: {
      id: state.hero.id,
      name: state.hero.name,
      race: state.hero.race,
      class: state.hero.class,
      skills: state.hero.skills,
      stats: state.hero.stats,
    },
    pressure: state.pressure,
    maxPressure: state.maxPressure,
    playerHp: state.playerHp,
    playerMaxHp: state.playerMaxHp,
    thresholds: {
      trustPass: TRUST_PASS_THRESHOLD,
      insightPass: INSIGHT_PASS_THRESHOLD,
      costlyPass: COSTLY_PASS_THRESHOLD,
    },
    wounds: state.wounds.map(wound => ({ name: wound.name, severity: wound.severity })),
    encounterIndex: state.encounterIndex,
    encounterCount: state.encounterCount,
    encounterTurnCount: state.encounterTurnCount,
    encounterBeatId: state.encounterBeatId,
    encounterFlags: state.encounterFlags,
    lastEntityIntent: state.lastEntityIntent,
    encounter: {
      id: state.encounter.id,
      name: state.encounter.name,
      threat: state.encounter.threat,
      premise: state.encounter.premise,
      trust: state.encounter.trust,
      insight: state.encounter.insight,
      enemyHp: state.encounter.enemyHp,
      enemyMaxHp: state.encounter.enemyMaxHp,
      clues: state.encounter.clues,
      hidden: template ? {
        need: template.need,
        fear: template.fear,
        taboo: template.taboo,
        leverage: template.leverage,
      } : null,
    },
    activeToolId: state.activeToolId,
    dialogTools: state.dialogTools.map(tool => ({
      id: tool.id,
      kind: tool.kind,
      name: tool.name,
      description: tool.description,
      used: tool.used,
    })),
    recentMessages: state.messages.slice(-10).map(message => ({
      type: message.type,
      speaker: message.speaker,
      text: message.text,
    })),
  };
}

export function useParleyAI() {
  const [isResolving, setIsResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendAction = useCallback(async (message: string, state: ParleyState): Promise<ParleyDMResponse | null> => {
    const gameState = buildParleyClientGameState(state);
    if (!gameState) {
      setError('Parley state is not ready.');
      return null;
    }

    setIsResolving(true);
    setError(null);

    try {
      const res = await fetch('/api/dm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, gameState }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => 'Unknown error');
        throw new Error(`${res.status}: ${text}`);
      }
      return await res.json() as ParleyDMResponse;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      return null;
    } finally {
      setIsResolving(false);
    }
  }, []);

  return { sendAction, isResolving, error, clearError: () => setError(null) } as const;
}
