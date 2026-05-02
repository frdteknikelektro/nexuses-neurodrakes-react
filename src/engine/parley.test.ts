import { describe, expect, it } from 'vitest';
import {
  ENCOUNTER_COUNT,
  PRESSURE_MAX,
  INSIGHT_PASS_THRESHOLD,
  MIN_DIALOG_TURNS_TO_PASS,
  TRUST_PASS_THRESHOLD,
  applyParleyUpdates,
  beginParleyRun,
  chooseParleyReward,
  startParleySession,
} from './parley';
import type { ParleyCharStub } from './parley';

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

function activeState() {
  return beginParleyRun(startParleySession(hero, 'seed'));
}

describe('parley state', () => {
  it('clamps pressure and triggers defeat at max pressure', () => {
    const state = activeState();
    const next = applyParleyUpdates(
      state,
      [{ type: 'adjust_pressure', amount: 3 }],
      'Pressure spikes.',
      ['"Breathe."', '"Explain."', '"Ask."'],
      [],
    );

    expect(next.pressure).toBe(3);

    const defeated = applyParleyUpdates(
      { ...next, pressure: PRESSURE_MAX - 1 },
      [{ type: 'adjust_pressure', amount: 4 }],
      'The Nexus overwhelms you.',
      [],
      [],
    );
    expect(defeated.pressure).toBe(PRESSURE_MAX);
    expect(defeated.phase).toBe('defeat');
  });

  it('initializes the three-encounter demo with normalized player and enemy HP', () => {
    const state = activeState();
    expect(state.encounterCount).toBe(ENCOUNTER_COUNT);
    expect(state.maxPressure).toBe(PRESSURE_MAX);
    expect(state.playerMaxHp).toBe(12);
    expect(state.playerHp).toBe(12);
    expect(state.encounter?.id).toBe('glitch-imp');
    expect(state.encounterTurnCount).toBe(0);
    expect(state.encounterBeatId).toBe('opening');
    expect(state.encounterFlags).toEqual([]);
    expect(state.encounter?.enemyMaxHp).toBe(6);
    expect(state.encounter?.enemyHp).toBe(6);
  });

  it('records new clues once without forcing a pass below threshold', () => {
    const state = activeState();
    const next = applyParleyUpdates(
      state,
      [
        { type: 'adjust_trust', amount: 10 },
        { type: 'adjust_insight', amount: 10, clue: 'It hates being rushed.' },
        { type: 'adjust_insight', amount: 5, clue: 'It hates being rushed.' },
      ],
      'You understand the threat.',
      [],
      [],
    );

    expect(next.phase).toBe('parley');
    expect(next.encounter?.trust).toBe(28);
    expect(next.encounter?.insight).toBe(25);
    expect(next.encounter?.clues).toEqual(['It hates being rushed.']);
    expect(next.stats.cluesFound).toBe(1);
  });

  it('player HP 0 causes defeat', () => {
    const state = activeState();
    const defeated = applyParleyUpdates(
      state,
      [{ type: 'adjust_player_hp', amount: -99 }],
      'The entity hits too hard.',
      [],
      [],
    );

    expect(defeated.playerHp).toBe(6);

    const final = applyParleyUpdates(
      { ...defeated, playerHp: 1, phase: 'parley', encounter: state.encounter },
      [{ type: 'adjust_player_hp', amount: -2 }],
      'The hero drops.',
      [],
      [],
    );

    expect(final.playerHp).toBe(0);
    expect(final.phase).toBe('defeat');
  });

  it('enemy HP 0 resolves the encounter by combat', () => {
    const state = activeState();
    const next = applyParleyUpdates(
      state,
      [{ type: 'adjust_enemy_hp', amount: -99 }],
      'The entity falls back from the exit.',
      [],
      [],
    );

    expect(next.phase).toBe('reward_pick');
    expect(next.lastOutcomeTags).toContain('combat');
  });

  it('trust and insight thresholds wait for the min-turn gate', () => {
    const trustState = applyParleyUpdates(
      activeState(),
      [{ type: 'adjust_trust', amount: TRUST_PASS_THRESHOLD }],
      'The entity trusts you.',
      [],
      [],
    );
    expect(trustState.phase).toBe('parley');
    expect(trustState.encounterTurnCount).toBe(1);

    const insightState = applyParleyUpdates(
      { ...activeState(), encounterTurnCount: MIN_DIALOG_TURNS_TO_PASS - 1 },
      [{ type: 'adjust_insight', amount: INSIGHT_PASS_THRESHOLD }],
      'The entity is understood.',
      [],
      [],
    );
    expect(insightState.phase).toBe('reward_pick');
    expect(insightState.lastOutcomeTags).toContain('insight');
  });

  it('advances to reward after an encounter and wins after the third', () => {
    let state = activeState();
    state = applyParleyUpdates({ ...state, encounter: state.encounter ? { ...state.encounter, enemyHp: 1 } : state.encounter }, [{ type: 'adjust_enemy_hp', amount: -99 }], 'Passed.', [], []);

    expect(state.phase).toBe('reward_pick');
    expect(state.encounterIndex).toBe(1);
    expect(state.rewardOptions.length).toBeGreaterThan(0);

    state = chooseParleyReward(state, state.rewardOptions[0].id);
    expect(state.encounter?.id).toBe('memory-warden');
    expect(state.encounterTurnCount).toBe(0);
    state = applyParleyUpdates({ ...state, encounter: state.encounter ? { ...state.encounter, enemyHp: 1 } : state.encounter }, [{ type: 'adjust_enemy_hp', amount: -99 }], 'Passed.', [], []);

    expect(state.phase).toBe('reward_pick');
    state = chooseParleyReward(state, state.rewardOptions[0].id);
    expect(state.encounter?.id).toBe('neurodrake');
    state = applyParleyUpdates({ ...state, encounter: state.encounter ? { ...state.encounter, enemyHp: 1 } : state.encounter }, [{ type: 'adjust_enemy_hp', amount: -99 }], 'Passed.', [], []);

    expect(state.phase).toBe('victory');
    expect(state.stats.encountersSurvived).toBe(ENCOUNTER_COUNT);
  });

  it('adds and uses dialog tools', () => {
    let state = activeState();
    const firstTool = state.dialogTools[0];
    state = applyParleyUpdates(
      state,
      [
        { type: 'use_dialog_tool', toolId: firstTool.id },
        { type: 'use_dialog_tool', toolId: firstTool.id },
      ],
      'Tool used.',
      [],
      [],
    );

    expect(state.dialogTools.find(tool => tool.id === firstTool.id)?.used).toBe(true);
    expect(state.dialogTools.filter(tool => tool.used)).toHaveLength(1);
  });

  it('consumes an active dialog tool on the next resolved message', () => {
    const state = { ...activeState(), activeToolId: activeState().dialogTools[1].id };
    const activeToolId = state.activeToolId!;
    const next = applyParleyUpdates(state, [], 'Tool spent.', [], []);

    expect(next.activeToolId).toBeNull();
    expect(next.dialogTools.find(tool => tool.id === activeToolId)?.used).toBe(true);
  });

  it('records authored dialog progress updates', () => {
    const next = applyParleyUpdates(
      activeState(),
      [{ type: 'set_dialog_progress', beatId: 'rules_given', addFlags: ['rules_revealed'], lastEntityIntent: 'explain_rules' }],
      'Rules.',
      [],
      [],
    );

    expect(next.encounterBeatId).toBe('rules_given');
    expect(next.encounterFlags).toContain('rules_revealed');
    expect(next.lastEntityIntent).toBe('explain_rules');
  });
});
