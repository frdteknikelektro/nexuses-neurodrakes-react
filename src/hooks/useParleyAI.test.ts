import { describe, expect, it } from 'vitest';
import { beginParleyRun, startParleySession } from '../engine/parley';
import type { ParleyCharStub } from '../engine/parley';
import { buildParleyClientGameState } from './useParleyAI';

const hero: ParleyCharStub = {
  id: 'test-hero',
  name: 'Test Hero',
  race: 'Nova Human',
  class: 'Hacker Hero',
  hp: 36,
  ac: 12,
  stats: { str: 10, dex: 12, int: 16, cha: 14 },
  skills: ['Hacking'],
  portrait: '/portrait.png',
};

describe('buildParleyClientGameState', () => {
  it('sends HP, thresholds, active tool, hidden encounter data, and recent messages', () => {
    const state = beginParleyRun(startParleySession(hero, 'seed'));
    const activeToolId = state.dialogTools[1].id;
    const clientState = buildParleyClientGameState({
      ...state,
      activeToolId,
      messages: [
        ...state.messages,
        { type: 'player', speaker: 'Test Hero', text: '"What rule binds you?"' },
      ],
    });

    expect(clientState?.playerHp).toBe(12);
    expect(clientState?.playerMaxHp).toBe(12);
    expect(clientState?.encounter.enemyHp).toBe(6);
    expect(clientState?.encounter.enemyMaxHp).toBe(6);
    expect(clientState?.thresholds).toEqual({ trustPass: 55, insightPass: 55, costlyPass: 40 });
    expect(clientState?.encounterTurnCount).toBe(0);
    expect(clientState?.encounterBeatId).toBe('opening');
    expect(clientState?.encounterFlags).toEqual([]);
    expect(clientState?.lastEntityIntent).toBeNull();
    expect(clientState?.activeToolId).toBe(activeToolId);
    expect(clientState?.encounter.hidden?.leverage).toContain('Ask what game');
    expect(clientState?.recentMessages.at(-1)?.text).toBe('"What rule binds you?"');
  });
});
