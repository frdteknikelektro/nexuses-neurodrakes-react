import { afterEach, describe, expect, it, vi } from 'vitest';
import { runParleyEngine } from './dmHandler';
import type { ParleyClientGameState } from './dmHandler';

function makeState(overrides: Partial<ParleyClientGameState> = {}): ParleyClientGameState {
  const base: ParleyClientGameState = {
    mode: 'parley',
    hero: {
      id: 'hero',
      name: 'Test Hero',
      race: 'Nova Human',
      class: 'Hacker Hero',
      skills: ['Hacking'],
      stats: { str: 10, dex: 12, int: 16, cha: 14 },
    },
    pressure: 2,
    maxPressure: 7,
    playerHp: 12,
    playerMaxHp: 12,
    thresholds: { trustPass: 55, insightPass: 55, costlyPass: 40 },
    wounds: [],
    encounterIndex: 0,
    encounterCount: 3,
    encounterTurnCount: 0,
    encounterBeatId: 'opening',
    encounterFlags: [],
    lastEntityIntent: null,
    encounter: {
      id: 'glitch-imp',
      name: 'Glitch Imp',
      threat: 'A mind-spark guards the lock.',
      premise: 'It wants attention, but punishes impatience.',
      trust: 18,
      insight: 10,
      enemyHp: 6,
      enemyMaxHp: 6,
      clues: [],
      hidden: {
        need: 'Playful curiosity and being treated as real.',
        fear: 'Being ignored or deleted.',
        taboo: 'Calling it broken.',
        leverage: 'Ask what game it is playing.',
      },
    },
    activeToolId: null,
    dialogTools: [
      { id: 'deflect-starter', kind: 'deflect', name: 'Deflect', description: 'Redirect pressure.', used: false },
      { id: 'probe-starter', kind: 'probe', name: 'Probe', description: 'Reveal a clue.', used: false },
    ],
    recentMessages: [],
  };
  return { ...base, ...overrides };
}

describe('runParleyEngine fallback', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('turns hostile parenthesized action into enemy damage and danger', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const response = await runParleyEngine(
      '"Move." (I slash at the lock.)',
      makeState({ pressure: 0 }),
      { apiKey: '', baseUrl: 'http://unused.local', model: 'unused' },
    );

    expect(response.updates).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'set_dialog_progress', beatId: 'combat_escalation' }),
      expect.objectContaining({ type: 'adjust_pressure' }),
      expect.objectContaining({ type: 'adjust_player_hp' }),
      expect.objectContaining({ type: 'adjust_enemy_hp' }),
    ]));
    expect(response.suggestions).toContain('(I pull my hand back.) Fine. No cutting. Tell me how to ask the door.');
  });

  it('keeps ordinary conversation between player and entity without a Nexus beat', async () => {
    const response = await runParleyEngine(
      'That lock trick is clever. Are we playing by rules I can learn?',
      makeState(),
      { apiKey: '', baseUrl: 'http://unused.local', model: 'unused' },
    );

    expect(response.beats.map(beat => beat.type)).toEqual(['player', 'entity']);
    expect(response.beats[0].text).not.toMatch(/^"/);
    expect(response.beats[1].text).toContain('Rules');
    expect(response.beats[1].text).not.toMatch(/^"/);
    expect(response.suggestions).toContain('All right. I am asking before touching: may I approach the door?');
  });

  it('uses recent conversation to advance instead of repeating the same entity line', async () => {
    const response = await runParleyEngine(
      'All right. Tell me the first rule, and I will follow it before I touch the door.',
      makeState({
        recentMessages: [
          { type: 'player', speaker: 'Test Hero', text: 'That lock trick is clever. Are we playing by rules I can learn?' },
          { type: 'entity', speaker: 'Glitch Imp', text: 'Rules, yes. First rule: ask before touching. Second rule: do not pretend I am a broken button.' },
        ],
        encounterBeatId: 'rules_given',
      }),
      { apiKey: '', baseUrl: 'http://unused.local', model: 'unused' },
    );

    expect(response.beats.map(beat => beat.type)).toEqual(['player', 'entity']);
    expect(response.beats[1].text).toContain('You heard the first rule');
    expect(response.beats[1].text).not.toMatch(/^"/);
    expect(response.suggestions).toContain('What does the door like to be called?');
  });

  it('responds differently to Neurodrake threat, accountability, and harm questions', async () => {
    const neurodrake = makeState({
      encounter: {
        id: 'neurodrake',
        name: 'The Exit Neurodrake',
        threat: 'The final mind-drake blocks the exit.',
        premise: 'It judges whether escape wounds the Nexus.',
        trust: 6,
        insight: 10,
        enemyHp: 16,
        enemyMaxHp: 16,
        clues: [],
        hidden: {
          need: 'Proof that the hero learned restraint.',
          fear: 'A survivor who treats every mind as an obstacle.',
          taboo: 'Threatening the Nexus.',
          leverage: 'Reference discovered clues and leave without breaking the place.',
        },
      },
    });
    const threat = await runParleyEngine('(I raise my weapon.) Maybe I am done being judged.', neurodrake, { apiKey: '', baseUrl: 'http://unused.local', model: 'unused' });
    const accountability = await runParleyEngine('I learned the lock was never just a lock. I am asking to leave without making another wound.', neurodrake, { apiKey: '', baseUrl: 'http://unused.local', model: 'unused' });
    const harm = await runParleyEngine('Tell me what harm my escape would cause, and I will answer that first.', { ...neurodrake, encounterBeatId: 'accountability_challenge' }, { apiKey: '', baseUrl: 'http://unused.local', model: 'unused' });

    expect(threat.beats[1].text).toContain('Raise it');
    expect(accountability.beats[1].text).toContain('name the harm');
    expect(harm.beats[1].text).toContain('repair after you leave');
  });

  it('advances Memory Warden from truth question to bounded memory', async () => {
    const response = await runParleyEngine(
      'I remember the first person who trusted me with a secret. I can give you that, but not their name.',
      makeState({
        encounterBeatId: 'truth_requested',
        encounter: {
          id: 'memory-warden',
          name: 'Memory Warden',
          threat: 'A pale neurodrake coils around a memory gate.',
          premise: 'It bargains with identity.',
          trust: 8,
          insight: 12,
          enemyHp: 10,
          enemyMaxHp: 10,
          clues: [],
          hidden: {
            need: 'A meaningful truth freely offered.',
            fear: 'Empty promises.',
            taboo: 'Promising anything just to escape.',
            leverage: 'A small honest memory is safer than a grand false vow.',
          },
        },
      }),
      { apiKey: '', baseUrl: 'http://unused.local', model: 'unused' },
    );

    expect(response.beats[1].text).toContain('bounded truth');
    expect(response.updates).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'set_dialog_progress', beatId: 'bounded_memory' }),
    ]));
  });

  it('uses active Probe to reveal a clue and consume the tool', async () => {
    const response = await runParleyEngine(
      '"What rule binds this game?"',
      makeState({ activeToolId: 'probe-starter' }),
      { apiKey: '', baseUrl: 'http://unused.local', model: 'unused' },
    );

    expect(response.updates).toEqual(expect.arrayContaining([
      { type: 'use_dialog_tool', toolId: 'probe-starter' },
      expect.objectContaining({ type: 'adjust_insight', clue: expect.stringContaining('lock') }),
    ]));
  });
});

function sse(events: unknown[]): string {
  return events.map(event => `event: response.output_item.done\ndata: ${JSON.stringify({ item: event })}\n\n`).join('');
}

function streamResponse(events: unknown[], status = 200): Response {
  return new Response(sse(events), {
    status,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

function functionCall(call_id: string, name: string, args: Record<string, unknown>) {
  return {
    type: 'function_call',
    call_id,
    name,
    arguments: JSON.stringify(args),
  };
}

describe('runParleyEngine Responses API', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('applies streamed function calls and returns a responses debug timeline', async () => {
    const fetchMock = vi.fn().mockResolvedValue(streamResponse([
      functionCall('call-1', 'adjust_trust', { amount: 9, reason: 'asked permission' }),
      functionCall('call-2', 'set_dialog_progress', { beatId: 'permission_test', addFlags: ['asked_permission'], lastEntityIntent: 'grant_approach' }),
      functionCall('call-3', 'narrate', {
        text: 'The imp lets you approach.',
        beats: [
          { type: 'player', speaker: 'Test Hero', text: 'May I approach?' },
          { type: 'entity', speaker: 'Glitch Imp', text: 'Step close, rule-keeper.' },
        ],
        suggestions: ['What is the door called?', '(I step closer slowly.)'],
      }),
    ]));
    vi.stubGlobal('fetch', fetchMock);

    const response = await runParleyEngine(
      'May I approach?',
      makeState(),
      { apiKey: 'test-key', baseUrl: 'http://localhost:8642/v1', model: 'hermes-agent', apiMode: 'responses' },
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response.debug?.api).toBe('responses');
    expect(response.debug?.status).toBe('ai');
    expect(response.debug?.events?.some(event => event.type === 'function_call_output')).toBe(true);
    expect(response.updates).toEqual(expect.arrayContaining([
      { type: 'adjust_trust', amount: 9, reason: 'asked permission' },
      expect.objectContaining({ type: 'set_dialog_progress', beatId: 'permission_test' }),
    ]));
    expect(response.beats[1].text).toBe('Step close, rule-keeper.');
  });

  it('continues responses with function_call_output and previous_response_id', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(
        `event: response.created\ndata: ${JSON.stringify({ id: 'resp-1' })}\n\nevent: response.output_item.done\ndata: ${JSON.stringify({ item: functionCall('call-1', 'adjust_insight', { amount: 8, clue: 'Ask first.' }) })}\n\n`,
        { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
      ))
      .mockResolvedValueOnce(streamResponse([
        functionCall('call-2', 'narrate', {
          text: 'The rule becomes clear.',
          beats: [
            { type: 'player', text: 'May I approach?' },
            { type: 'entity', text: 'Now you understand the asking-game.' },
          ],
          suggestions: ['What is the next rule?'],
        }),
      ]));
    vi.stubGlobal('fetch', fetchMock);

    const response = await runParleyEngine(
      'May I approach?',
      makeState(),
      { apiKey: 'test-key', baseUrl: 'http://localhost:8642/v1', model: 'hermes-agent', apiMode: 'responses' },
    );
    const secondBody = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(secondBody.previous_response_id).toBe('resp-1');
    expect(secondBody.input).toEqual([
      expect.objectContaining({ type: 'function_call_output', call_id: 'call-1' }),
    ]);
    expect(response.updates).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'adjust_insight', amount: 8 }),
    ]));
    expect(response.narration).toBe('The rule becomes clear.');
  });

  it('falls back when the responses stream has no narrate call', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(streamResponse([
        functionCall('call-1', 'adjust_trust', { amount: 3 }),
      ]))
      .mockResolvedValueOnce(new Response('', {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })));

    const response = await runParleyEngine(
      'May I approach?',
      makeState(),
      { apiKey: 'test-key', baseUrl: 'http://localhost:8642/v1', model: 'hermes-agent', apiMode: 'responses' },
    );

    expect(response.debug?.status).toBe('fallback');
    expect(response.debug?.error).toContain('narrate');
    expect(response.beats.map(beat => beat.type)).toEqual(['player', 'entity']);
  });

  it('falls back on non-2xx responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not available', { status: 503 })));

    const response = await runParleyEngine(
      'May I approach?',
      makeState(),
      { apiKey: 'test-key', baseUrl: 'http://localhost:8642/v1', model: 'hermes-agent', apiMode: 'responses' },
    );

    expect(response.debug?.status).toBe('fallback');
    expect(response.debug?.error).toContain('Upstream 503');
  });
});
