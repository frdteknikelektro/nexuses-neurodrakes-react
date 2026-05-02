// Core AI game-engine logic. Used by both api/dm.ts (Vercel) and the Vite dev middleware.

// ── Types ─────────────────────────────────────────────────────────────────────

export type GameStateUpdate =
  | { type: 'hp'; targetId: string; newHp: number }
  | { type: 'move'; entityId: string; x: number; y: number }
  | { type: 'add_item'; name: string; description: string; itemType: string; effect?: string }
  | { type: 'remove_item'; itemId: string }
  | { type: 'add_condition'; targetId: string; condition: string; turns: number }
  | { type: 'remove_condition'; targetId: string; condition: string }
  | { type: 'end_turn' }
  | { type: 'advance_room' }
  | { type: 'scene'; flavor: string }
  | { type: 'dice_roll'; notations: string[]; results: number[] };

interface ConditionEntry { name: string; turns: number }
interface InventoryEntry { id: string; name: string; description: string; effect?: string }
interface EnemyEntry { id: string; name: string; hp: number; maxHp: number; ac: number; x: number; y: number }
interface EntityEntry { id: string; name: string; x: number; y: number }

export interface ClientGameState {
  char: {
    id: string; name: string; race: string; class: string;
    hp: number; maxHp: number; ac: number;
    str: number; dex: number; int: number; cha: number;
    skills: string[];
    conditions: ConditionEntry[];
    inventory: InventoryEntry[];
    weaponDmg: string;
  };
  enemies: EnemyEntry[];
  map: {
    playerX: number; playerY: number;
    roomName: string; roomFlavor: string;
    entities: EntityEntry[];
    lootPositions: { x: number; y: number }[];
    exitPos: { x: number; y: number } | null;
  };
  turn: 'player' | 'enemy';
  round: number;
  recentMessages: { from: string; text: string }[];
}

export interface Beat {
  type: 'player' | 'enemy' | 'dm';
  speaker?: string;
  text: string;
  roll?: {
    notation: string;
    result: number;
    dc?: number;
    success?: boolean;
  };
}

export interface DMResponse {
  updates: GameStateUpdate[];
  narration: string;
  beats: Beat[];
  suggestions: string[];
  debug?: AIDebugTurn;
}

// ── Parley engine types ──────────────────────────────────────────────────────

export type ParleyGameStateUpdate =
  | { type: 'adjust_pressure'; amount: number; reason?: string }
  | { type: 'adjust_player_hp'; amount: number; reason?: string }
  | { type: 'adjust_enemy_hp'; amount: number; reason?: string }
  | { type: 'adjust_trust'; amount: number; reason?: string }
  | { type: 'adjust_insight'; amount: number; clue?: string; reason?: string }
  | { type: 'add_wound'; name: string; severity: number }
  | { type: 'use_dialog_tool'; toolId: string }
  | { type: 'set_dialog_progress'; beatId?: string; addFlags?: string[]; lastEntityIntent?: string }
  | { type: 'resolve_encounter'; outcome: 'pass' | 'wound' | 'defeat'; reason?: string };

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
  thresholds?: {
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
    hidden: {
      need: string;
      fear: string;
      taboo: string;
      leverage: string;
    } | null;
  };
  activeToolId: string | null;
  dialogTools: {
    id: string;
    kind: string;
    name: string;
    description: string;
    used: boolean;
  }[];
  recentMessages: { type: string; speaker?: string; text: string }[];
}

export interface ParleyBeat {
  type: 'player' | 'entity' | 'engine';
  speaker?: string;
  text: string;
}

export interface ParleyDMResponse {
  updates: ParleyGameStateUpdate[];
  narration: string;
  beats: ParleyBeat[];
  suggestions: string[];
  debug?: AIDebugTurn;
}

// ── OpenAI wire types ─────────────────────────────────────────────────────────

interface OAITool {
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

interface OAIToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

type OAIMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: OAIToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };

export type AIDebugMessage = OAIMessage;

interface AIDebugEvent {
  id: string;
  at: string;
  type: string;
  title: string;
  content?: string;
  data?: unknown;
}

export interface AIDebugTurn {
  id: string;
  createdAt: string;
  model: string;
  api?: 'chat_completions' | 'responses';
  status: 'ai' | 'fallback' | 'error';
  error?: string;
  messages?: AIDebugMessage[];
  events?: AIDebugEvent[];
}

function cloneDebugMessages(messages: OAIMessage[]): AIDebugMessage[] {
  return JSON.parse(JSON.stringify(messages)) as AIDebugMessage[];
}

function createDebugTurn(
  model: string,
  status: AIDebugTurn['status'],
  messages: OAIMessage[],
  error?: string,
): AIDebugTurn {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    model,
    status,
    error,
    messages: cloneDebugMessages(messages),
  };
}

// ── Dice ──────────────────────────────────────────────────────────────────────

function rollNotation(notation: string): number {
  const match = notation.trim().match(/^(\d+)?d(\d+)([+-]\d+)?$/i);
  if (!match) return 0;
  const count = parseInt(match[1] ?? '1', 10);
  const sides = parseInt(match[2], 10);
  const bonus = parseInt(match[3] ?? '0', 10);
  let total = bonus;
  for (let i = 0; i < count; i++) total += Math.floor(Math.random() * sides) + 1;
  return total;
}

// ── Tool definitions ──────────────────────────────────────────────────────────

const TOOLS: OAITool[] = [
  { type: 'function', function: { name: 'roll_dice', description: 'Roll one or more dice. ALWAYS call this before resolving any attack, skill check, or random outcome. Never invent numbers.', parameters: { type: 'object', properties: { notations: { type: 'array', items: { type: 'string' }, description: 'Dice notations e.g. ["d20+3", "2d6+2"]' } }, required: ['notations'] } } },
  { type: 'function', function: { name: 'deal_damage', description: "Reduce a target's HP. Use after a successful attack roll.", parameters: { type: 'object', properties: { targetId: { type: 'string' }, amount: { type: 'number' }, damageType: { type: 'string' } }, required: ['targetId', 'amount'] } } },
  { type: 'function', function: { name: 'heal', description: 'Restore HP to a target.', parameters: { type: 'object', properties: { targetId: { type: 'string' }, amount: { type: 'number' } }, required: ['targetId', 'amount'] } } },
  { type: 'function', function: { name: 'move_entity', description: 'Move the player or an enemy to a new map position.', parameters: { type: 'object', properties: { entityId: { type: 'string' }, x: { type: 'number' }, y: { type: 'number' } }, required: ['entityId', 'x', 'y'] } } },
  { type: 'function', function: { name: 'add_item', description: 'Give the player an item.', parameters: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' }, itemType: { type: 'string' }, effect: { type: 'string' } }, required: ['name', 'description', 'itemType'] } } },
  { type: 'function', function: { name: 'remove_item', description: "Remove an item from the player's inventory.", parameters: { type: 'object', properties: { itemId: { type: 'string' } }, required: ['itemId'] } } },
  { type: 'function', function: { name: 'add_condition', description: 'Apply a status condition. Key: stunned (locks input), in_cover (+2 AC), dead (ends combat).', parameters: { type: 'object', properties: { targetId: { type: 'string' }, condition: { type: 'string', description: 'stunned, prone, poisoned, in_cover, blinded, frightened, etc.' }, turns: { type: 'number' } }, required: ['targetId', 'condition', 'turns'] } } },
  { type: 'function', function: { name: 'remove_condition', description: 'Remove a condition.', parameters: { type: 'object', properties: { targetId: { type: 'string' }, condition: { type: 'string' } }, required: ['targetId', 'condition'] } } },
  { type: 'function', function: { name: 'set_scene', description: 'Update the room description when something changes.', parameters: { type: 'object', properties: { flavor: { type: 'string' } }, required: ['flavor'] } } },
  { type: 'function', function: { name: 'end_turn', description: 'End current turn, pass to the other side. Call after all actions are resolved.', parameters: { type: 'object', properties: {}, required: [] } } },
  { type: 'function', function: { name: 'advance_room', description: 'Move to next room. Only when all enemies are defeated.', parameters: { type: 'object', properties: {}, required: [] } } },
  { type: 'function', function: { name: 'narrate', description: 'Final structured narration. ALWAYS call this last. Fill beats[] for cinematic sequential reveal, suggestions[] for next actions.', parameters: { type: 'object', properties: { text: { type: 'string', description: 'Flat fallback narration (required)' }, beats: { type: 'array', description: 'Ordered cinematic beats. Player action first, then dm outcome, then enemy reaction.', items: { type: 'object', properties: { type: { type: 'string', enum: ['player', 'enemy', 'dm'] }, speaker: { type: 'string', description: 'Character name or "Game Master"' }, text: { type: 'string', description: 'What this character does or says' }, roll: { type: 'object', properties: { notation: { type: 'string' }, result: { type: 'number' }, dc: { type: 'number' }, success: { type: 'boolean' } }, required: ['notation', 'result'] } }, required: ['type', 'text'] } }, suggestions: { type: 'array', items: { type: 'string' }, description: '2-3 concrete next actions for the player (plain text, no brackets)' } }, required: ['text', 'beats', 'suggestions'] } } },
];

const PARLEY_TOOLS: OAITool[] = [
  { type: 'function', function: { name: 'adjust_pressure', description: 'Change run pressure after the player creates or reduces physical danger. Use -4..4 only.', parameters: { type: 'object', properties: { amount: { type: 'number' }, reason: { type: 'string' } }, required: ['amount'] } } },
  { type: 'function', function: { name: 'adjust_player_hp', description: 'Change player HP. Negative means damage; positive means recovery. Use -6..4 only.', parameters: { type: 'object', properties: { amount: { type: 'number' }, reason: { type: 'string' } }, required: ['amount'] } } },
  { type: 'function', function: { name: 'adjust_enemy_hp', description: 'Change current entity HP. Negative means damage; positive means recovery. Use -8..4 only.', parameters: { type: 'object', properties: { amount: { type: 'number' }, reason: { type: 'string' } }, required: ['amount'] } } },
  { type: 'function', function: { name: 'adjust_trust', description: "Change current entity trust after judging the player's intent. Use -20..20 only.", parameters: { type: 'object', properties: { amount: { type: 'number' }, reason: { type: 'string' } }, required: ['amount'] } } },
  { type: 'function', function: { name: 'adjust_insight', description: 'Change insight and optionally reveal one concise clue when the player learns a real rule, fear, need, or leverage.', parameters: { type: 'object', properties: { amount: { type: 'number' }, clue: { type: 'string' }, reason: { type: 'string' } }, required: ['amount'] } } },
  { type: 'function', function: { name: 'add_wound', description: 'Add a physical or psychic wound only after a serious failure or dangerous bargain.', parameters: { type: 'object', properties: { name: { type: 'string' }, severity: { type: 'number', description: '1 minor, 2 serious, 3 severe' } }, required: ['name', 'severity'] } } },
  { type: 'function', function: { name: 'use_dialog_tool', description: 'Mark a dialog tool as used when the player explicitly uses or clearly invokes one. toolId may be the id or kind.', parameters: { type: 'object', properties: { toolId: { type: 'string' } }, required: ['toolId'] } } },
  { type: 'function', function: { name: 'set_dialog_progress', description: 'Advance the authored encounter dialog spine after the entity responds. Use only valid next beat ids from the prompt. Add concise flags for remembered facts.', parameters: { type: 'object', properties: { beatId: { type: 'string' }, addFlags: { type: 'array', items: { type: 'string' } }, lastEntityIntent: { type: 'string' } } } } },
  { type: 'function', function: { name: 'resolve_encounter', description: 'Resolve only when enemy HP is 0, trust/insight is high enough, costly pass is justified, or HP/pressure defeats the player.', parameters: { type: 'object', properties: { outcome: { type: 'string', enum: ['pass', 'wound', 'defeat'] }, reason: { type: 'string' } }, required: ['outcome'] } } },
  { type: 'function', function: { name: 'narrate', description: 'Final structured narration. ALWAYS call this last. Beats and suggestions must be natural text without wrapping quotation marks. Suggestions are player lines, optionally with parenthesized actions.', parameters: { type: 'object', properties: { text: { type: 'string' }, beats: { type: 'array', items: { type: 'object', properties: { type: { type: 'string', enum: ['player', 'entity', 'engine'] }, speaker: { type: 'string' }, text: { type: 'string', description: 'Natural spoken/action text. Do not wrap spoken lines in quotation marks.' } }, required: ['type', 'text', 'speaker'] } }, suggestions: { type: 'array', items: { type: 'string' } } }, required: ['text', 'beats', 'suggestions'] } } },
];

// ── Tool executor ─────────────────────────────────────────────────────────────

function executeTool(name: string, args: Record<string, unknown>, updates: GameStateUpdate[], state: ClientGameState): string {
  switch (name) {
    case 'roll_dice': {
      const notations = args.notations as string[];
      const results = notations.map(rollNotation);
      updates.push({ type: 'dice_roll', notations, results });
      return JSON.stringify({ results });
    }
    case 'deal_damage': {
      const { targetId, amount } = args as { targetId: string; amount: number };
      const currentHp = targetId === state.char.id ? state.char.hp : (state.enemies.find(e => e.id === targetId)?.hp ?? 0);
      const newHp = Math.max(0, currentHp - amount);
      updates.push({ type: 'hp', targetId, newHp });
      return JSON.stringify({ targetId, newHp, damage: amount });
    }
    case 'heal': {
      const { targetId, amount } = args as { targetId: string; amount: number };
      const isPlayer = targetId === state.char.id;
      const currentHp = isPlayer ? state.char.hp : (state.enemies.find(e => e.id === targetId)?.hp ?? 0);
      const maxHp = isPlayer ? state.char.maxHp : (state.enemies.find(e => e.id === targetId)?.maxHp ?? currentHp);
      const newHp = Math.min(maxHp, currentHp + amount);
      updates.push({ type: 'hp', targetId, newHp });
      return JSON.stringify({ targetId, newHp, healed: newHp - currentHp });
    }
    case 'move_entity': {
      const { entityId, x, y } = args as { entityId: string; x: number; y: number };
      updates.push({ type: 'move', entityId, x, y });
      return JSON.stringify({ entityId, x, y });
    }
    case 'add_item': {
      const { name, description, itemType, effect } = args as { name: string; description: string; itemType: string; effect?: string };
      updates.push({ type: 'add_item', name, description, itemType, effect });
      return JSON.stringify({ added: name });
    }
    case 'remove_item': {
      const { itemId } = args as { itemId: string };
      updates.push({ type: 'remove_item', itemId });
      return JSON.stringify({ removed: itemId });
    }
    case 'add_condition': {
      const { targetId, condition, turns } = args as { targetId: string; condition: string; turns: number };
      updates.push({ type: 'add_condition', targetId, condition, turns });
      return JSON.stringify({ targetId, condition, turns });
    }
    case 'remove_condition': {
      const { targetId, condition } = args as { targetId: string; condition: string };
      updates.push({ type: 'remove_condition', targetId, condition });
      return JSON.stringify({ targetId, condition });
    }
    case 'set_scene': {
      const { flavor } = args as { flavor: string };
      updates.push({ type: 'scene', flavor });
      return JSON.stringify({ updated: true });
    }
    case 'end_turn':
      updates.push({ type: 'end_turn' });
      return JSON.stringify({ turnEnded: true });
    case 'advance_room':
      updates.push({ type: 'advance_room' });
      return JSON.stringify({ advanced: true });
    case 'narrate':
      return JSON.stringify({ received: true });
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

// ── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(state: ClientGameState): string {
  const { char, enemies, map, turn, round, recentMessages } = state;
  const mod = (v: number) => { const m = Math.floor((v - 10) / 2); return m >= 0 ? `+${m}` : `${m}`; };

  const conditionStr = char.conditions.length > 0 ? char.conditions.map(c => `${c.name}(${c.turns}t)`).join(', ') : 'none';
  const inventoryStr = char.inventory.length > 0 ? char.inventory.map(i => `${i.name}${i.effect ? ` [${i.effect}]` : ''}`).join(', ') : 'empty';
  const enemyStr = enemies.length > 0 ? enemies.map(e => `  - ${e.name} | HP ${e.hp}/${e.maxHp} | AC ${e.ac} | pos (${e.x},${e.y})`).join('\n') : '  - None remaining';
  const entityStr = map.entities.length > 0 ? map.entities.map(e => `${e.name} at (${e.x},${e.y})`).join(', ') : 'none';
  const lootStr = map.lootPositions.length > 0 ? map.lootPositions.map(p => `(${p.x},${p.y})`).join(', ') : 'none';
  const historyStr = recentMessages.slice(-8).map(m => `[${m.from}] ${m.text}`).join('\n');
  const turnLabel = turn === 'player' ? `PLAYER TURN — Round ${round}` : `ENEMY TURN — Round ${round} — Resolve ALL living enemies, then call end_turn()`;

  return `You are the Game Master for Nexuses & Neurodrakes, a sci-fi D&D adventure.

## D&D Rules
- Attack: d20 + stat mod vs AC. Hit = roll damage + mod.
- Skill check: d20 + skill bonus vs DC (easy 10, medium 15, hard 20, very hard 25).
- Crit on natural 20 (double damage dice). Miss on natural 1.
- STR: melee attacks/athletics. DEX: ranged/stealth. INT: hacking/arcane. CHA: persuasion/deception.
- ALWAYS call roll_dice before any uncertain outcome. Never invent numbers.
- ALWAYS finish with narrate(). Fill beats[] for cinematic reveal:
  - "player" beat: rephrase player action in 3rd person. Attach roll{} if a check was made.
  - "dm" beat: outcomes, scene changes, dice context.
  - "enemy" beat: give enemy a voice — what it says/does in 1st or 3rd person.
  - Order: player → dm → enemy (player turn) OR dm → enemy (enemy turn).
- suggestions[]: 2-3 plain-text next actions (no square brackets).

## Character
${char.name} | ${char.race} ${char.class} | HP ${char.hp}/${char.maxHp} | AC ${char.ac}
STR ${mod(char.str)} DEX ${mod(char.dex)} INT ${mod(char.int)} CHA ${mod(char.cha)}
Skills: ${char.skills.length > 0 ? char.skills.join(', ') : 'none'}
Conditions: ${conditionStr} | Weapon: ${char.weaponDmg}
Inventory: ${inventoryStr}

## Enemies
${enemyStr}

## Map
Player at (${map.playerX},${map.playerY}). Entities: ${entityStr}
Loot at: ${lootStr} | Exit at: ${map.exitPos ? `(${map.exitPos.x},${map.exitPos.y})` : 'not visible'}
Room: ${map.roomName} — ${map.roomFlavor}

## Turn
${turnLabel}

## Recent Events
${historyStr || '(start of session)'}`;
}

// ── Core engine function ──────────────────────────────────────────────────────

export interface EngineConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs?: number;
  apiMode?: 'chat' | 'responses';
}

export async function runDMEngine(
  message: string,
  gameState: ClientGameState,
  config: EngineConfig,
): Promise<DMResponse> {
  const { apiKey, baseUrl, model } = config;
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;

  const messages: OAIMessage[] = [
    { role: 'system', content: buildSystemPrompt(gameState) },
    { role: 'user', content: message },
  ];

  const updates: GameStateUpdate[] = [];
  let narration = '';
  let beats: Beat[] = [];
  let narrateSuggestions: string[] = [];
  let narrateCalled = false;

  for (let i = 0; i < 12 && !narrateCalled; i++) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages, tools: TOOLS, tool_choice: 'auto', temperature: 0.85, max_tokens: 1024 }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => 'unknown');
      throw new Error(`Upstream ${response.status}: ${errText}`);
    }

    const data = await response.json() as {
      choices: Array<{ message: { role: string; content: string | null; tool_calls?: OAIToolCall[] } }>;
    };

    const assistantMsg = data.choices[0].message;
    messages.push(assistantMsg as OAIMessage);

    const toolCalls = assistantMsg.tool_calls;
    if (!toolCalls?.length) {
      narration = assistantMsg.content ?? '';
      break;
    }

    const toolResults: OAIMessage[] = [];
    for (const tc of toolCalls) {
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(tc.function.arguments); } catch { /* malformed */ }
      if (tc.function.name === 'narrate') {
        narration = (args.text as string) ?? '';
        beats = (args.beats as Beat[]) ?? [];
        narrateSuggestions = (args.suggestions as string[]) ?? [];
        narrateCalled = true;
      }
      toolResults.push({ role: 'tool', tool_call_id: tc.id, content: executeTool(tc.function.name, args, updates, gameState) });
    }
    messages.push(...toolResults);
  }

  const suggestions = narrateSuggestions.length > 0
    ? narrateSuggestions
    : [...narration.matchAll(/\[([^\]]+)\]/g)].map(m => m[1]);
  return { updates, narration, beats, suggestions };
}

interface ParleySimState {
  pressure: number;
  maxPressure: number;
  playerHp: number;
  playerMaxHp: number;
  enemyHp: number;
  enemyMaxHp: number;
  trust: number;
  insight: number;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function extractJSONFromContent(content: string): unknown {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : content;
  return JSON.parse(raw.trim());
}

function executeParleyTool(
  name: string,
  args: Record<string, unknown>,
  updates: ParleyGameStateUpdate[],
  state: ParleyClientGameState,
  sim: ParleySimState,
): string {
  switch (name) {
    case 'adjust_pressure': {
      const amount = clampNumber(Math.round(Number(args.amount ?? 0)), -4, 4);
      sim.pressure = clampNumber(sim.pressure + amount, 0, sim.maxPressure);
      updates.push({ type: 'adjust_pressure', amount, reason: args.reason as string | undefined });
      return JSON.stringify({ pressure: sim.pressure });
    }
    case 'adjust_player_hp': {
      const amount = clampNumber(Math.round(Number(args.amount ?? 0)), -6, 4);
      sim.playerHp = clampNumber(sim.playerHp + amount, 0, sim.playerMaxHp);
      updates.push({ type: 'adjust_player_hp', amount, reason: args.reason as string | undefined });
      return JSON.stringify({ playerHp: sim.playerHp });
    }
    case 'adjust_enemy_hp': {
      const amount = clampNumber(Math.round(Number(args.amount ?? 0)), -8, 4);
      sim.enemyHp = clampNumber(sim.enemyHp + amount, 0, sim.enemyMaxHp);
      updates.push({ type: 'adjust_enemy_hp', amount, reason: args.reason as string | undefined });
      return JSON.stringify({ enemyHp: sim.enemyHp });
    }
    case 'adjust_trust': {
      const amount = clampNumber(Math.round(Number(args.amount ?? 0)), -20, 20);
      sim.trust = clampNumber(sim.trust + amount, 0, 100);
      updates.push({ type: 'adjust_trust', amount, reason: args.reason as string | undefined });
      return JSON.stringify({ trust: sim.trust });
    }
    case 'adjust_insight': {
      const amount = clampNumber(Math.round(Number(args.amount ?? 0)), -20, 20);
      const clue = typeof args.clue === 'string' ? args.clue.slice(0, 120) : undefined;
      sim.insight = clampNumber(sim.insight + amount, 0, 100);
      updates.push({ type: 'adjust_insight', amount, clue, reason: args.reason as string | undefined });
      return JSON.stringify({ insight: sim.insight, clue });
    }
    case 'add_wound': {
      const nameArg = typeof args.name === 'string' ? args.name : 'Nexus Wound';
      const severity = clampNumber(Math.round(Number(args.severity ?? 1)), 1, 3);
      updates.push({ type: 'add_wound', name: nameArg.slice(0, 48), severity });
      return JSON.stringify({ wound: nameArg, severity });
    }
    case 'use_dialog_tool': {
      const toolId = String(args.toolId ?? '');
      const tool = state.dialogTools.find(item => item.id === toolId || item.kind === toolId);
      if (!tool || tool.used) return JSON.stringify({ used: false, reason: 'tool unavailable' });
      updates.push({ type: 'use_dialog_tool', toolId });
      return JSON.stringify({ used: true, tool: tool.name });
    }
    case 'set_dialog_progress': {
      const beatId = typeof args.beatId === 'string' ? args.beatId.slice(0, 48) : undefined;
      const addFlags = Array.isArray(args.addFlags)
        ? args.addFlags.filter(flag => typeof flag === 'string').map(flag => flag.slice(0, 48)).slice(0, 5)
        : undefined;
      const lastEntityIntent = typeof args.lastEntityIntent === 'string' ? args.lastEntityIntent.slice(0, 80) : undefined;
      updates.push({ type: 'set_dialog_progress', beatId, addFlags, lastEntityIntent });
      return JSON.stringify({ beatId, addFlags, lastEntityIntent });
    }
    case 'resolve_encounter': {
      const outcome = args.outcome === 'defeat' || args.outcome === 'wound' ? args.outcome : 'pass';
      const trustPass = state.thresholds?.trustPass ?? 55;
      const insightPass = state.thresholds?.insightPass ?? 55;
      const costlyPass = state.thresholds?.costlyPass ?? 40;
      const minTurnsReached = state.encounterTurnCount + 1 >= 3;
      const canPass = sim.enemyHp <= 0 || sim.trust >= trustPass || sim.insight >= insightPass;
      const canWoundPass = outcome === 'wound' && (sim.trust >= costlyPass || sim.insight >= costlyPass);
      const pressureDefeat = sim.pressure >= sim.maxPressure;
      const hpDefeat = sim.playerHp <= 0;
      if (outcome === 'defeat' || pressureDefeat || hpDefeat) {
        updates.push({ type: 'resolve_encounter', outcome: 'defeat', reason: args.reason as string | undefined });
        return JSON.stringify({ resolved: true, outcome: 'defeat' });
      }
      if (sim.enemyHp > 0 && !minTurnsReached) {
        return JSON.stringify({ resolved: false, reason: 'conversation needs at least three turns before trust or insight can resolve' });
      }
      if (!canPass && !canWoundPass) {
        return JSON.stringify({ resolved: false, reason: 'trust or insight too low' });
      }
      updates.push({ type: 'resolve_encounter', outcome, reason: args.reason as string | undefined });
      return JSON.stringify({ resolved: true, outcome });
    }
    case 'narrate':
      return JSON.stringify({ received: true });
    default:
      return JSON.stringify({ error: `Unknown parley tool: ${name}` });
  }
}

function buildParleySystemPrompt(state: ParleyClientGameState): string {
  const { hero, encounter, pressure, maxPressure, playerHp, playerMaxHp, wounds, dialogTools } = state;
  const hidden = encounter.hidden;
  const thresholds = state.thresholds ?? { trustPass: 55, insightPass: 55, costlyPass: 40 };
  const woundsText = wounds.length > 0
    ? wounds.map(wound => `${wound.name}(severity ${wound.severity})`).join(', ')
    : 'none';
  const toolsText = dialogTools.length > 0
    ? dialogTools.map(tool => `- ${tool.name} [id:${tool.id}, kind:${tool.kind}, ${tool.used ? 'used' : 'ready'}]: ${tool.description}`).join('\n')
    : 'none';
  const activeTool = state.activeToolId ? dialogTools.find(tool => tool.id === state.activeToolId) : null;
  const cluesText = encounter.clues.length > 0 ? encounter.clues.join('; ') : 'none';

  return `You are the AI game engine for "Nexus Parley", a hybrid dialog/combat survival game.

The player is physically threatened. Conversation is the primary action, but parenthesized physical actions and combat intent are valid. Judge intent, not exact keywords. The tone is teen-tense sci-fi survival: dangerous, clear, not graphic.

## Rules
- Pressure is run-level danger. At ${maxPressure} the player loses.
- Player HP at 0 = loss. Enemy HP at 0 = encounter clears (costly tone).
- Trust/Insight pass at >= ${thresholds.trustPass}. Wound-pass at >= ${thresholds.costlyPass} (trust or insight).
- Trust/Insight/wound-pass cannot resolve before turn 3. HP 0 and pressure max resolve immediately.
- Speech = dialog. Parentheses = physical action. Judge intent, not keywords.
- Calming actions reduce danger. Sudden/aggressive actions invite retaliation.
- Do not resolve early. Let the player earn it.
- beats order: player -> entity. Add engine beat only for resolution, defeat, or major environmental event.
- Entity beats sound in-the-moment. No meta-commentary. No quotation marks in beats or suggestions.
- Do not repeat the entity's previous line unless asked. Advance: clarify, challenge, concede, reveal, escalate.
- suggestions: 2-3 natural player lines, mostly dialog, optionally with parenthesized action. Ambiguous — no labels.

## Turn Contract
1. Read player line + Recent Conversation.
2. Advance the authored beat by exactly one step.
3. Entity reacts to the latest player intent.
4. Set dialogProgress.beatId to the valid next beat id.
5. Write suggestions as follow-ups to the entity's new line.

## Hero
${hero.name}, ${hero.race} ${hero.class}
Skills: ${hero.skills.join(', ') || 'none'}
Stats: ${JSON.stringify(hero.stats)}

## Run
Encounter ${state.encounterIndex + 1}/${state.encounterCount}
Pressure: ${pressure}/${maxPressure}
Player HP: ${playerHp}/${playerMaxHp}
Wounds: ${woundsText}
Encounter turns taken: ${state.encounterTurnCount}
Current beat: ${state.encounterBeatId}
Flags: ${state.encounterFlags.length > 0 ? state.encounterFlags.join(', ') : 'none'}
Last entity intent: ${state.lastEntityIntent ?? 'none'}

## Current Entity
Name: ${encounter.name}
Threat: ${encounter.threat}
Premise: ${encounter.premise}
Trust: ${encounter.trust}/100
Insight: ${encounter.insight}/100
Enemy HP: ${encounter.enemyHp}/${encounter.enemyMaxHp}
Visible clues: ${cluesText}

## Hidden Entity Truth
Need: ${hidden?.need ?? 'unknown'}
Fear: ${hidden?.fear ?? 'unknown'}
Taboo: ${hidden?.taboo ?? 'unknown'}
Leverage: ${hidden?.leverage ?? 'unknown'}

## Authored Beat Spine
Glitch Imp beats: opening -> rules_given -> permission_test -> door_named -> pass_ready or combat_escalation
Memory Warden beats: opening -> truth_requested -> bounded_memory -> promise_test -> pass_ready or combat_escalation
Exit Neurodrake beats: opening -> accountability_challenge -> harm_question -> restraint_proven -> pass_ready or combat_escalation
Do not jump to pass_ready before turn 3 unless enemy HP reaches 0.

## Dialog Tools
${toolsText}
Active next-line tool: ${activeTool ? `${activeTool.name} [id:${activeTool.id}, kind:${activeTool.kind}]` : 'none'}

## Response Format
Return ONLY a valid JSON object. No prose, no markdown fences, no explanation.

{
  "narration": "flat fallback string",
  "beats": [{"type": "player|entity|engine", "speaker": "string", "text": "string"}],
  "suggestions": ["string", "string"],
  "adjustments": {"trust": 0, "insight": 0, "pressure": 0, "playerHp": 0, "enemyHp": 0},
  "clue": null,
  "wound": {"name": "string", "severity": 1},
  "dialogProgress": {"beatId": "string", "addFlags": [], "lastEntityIntent": "string"},
  "resolve": {"outcome": "pass|wound|defeat", "reason": "string"}
}

wound, resolve, clue, dialogProgress are optional — omit if not applicable.
adjustments values are deltas (positive = increase, negative = decrease). Bounds: trust/insight -20..20, pressure -4..4, playerHp -6..4, enemyHp -8..4.
beats must have at least one entry. suggestions must have 2-3 entries.`;
}

function stripOuterQuotes(text: string): string {
  const trimmed = text.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function fallbackClue(encounterId: string, hidden?: ParleyClientGameState['encounter']['hidden']): string | undefined {
  if (!hidden) return undefined;
  if (encounterId === 'glitch-imp') return 'It wants you to ask about the game before touching the lock.';
  if (encounterId === 'memory-warden') return 'A small honest memory is safer than a grand promise.';
  if (encounterId === 'neurodrake') return 'It is judging whether you learned restraint from the other guardians.';
  return hidden.leverage;
}

interface FallbackIntentFlags {
  hostile: boolean;
  curious: boolean;
  respectful: boolean;
  currentText: string;
}

interface FallbackProgression {
  beatId: string;
  addFlags: string[];
  lastEntityIntent: string;
  entityText: string;
  suggestions: string[];
  clue?: string;
  trustBonus: number;
  insightBonus: number;
  pressureBonus: number;
}

function hasAny(text: string, words: string[]): boolean {
  return words.some(word => text.includes(word));
}

function buildFallbackProgression(gameState: ParleyClientGameState, flags: FallbackIntentFlags): FallbackProgression {
  const beat = gameState.encounterBeatId || 'opening';
  const text = flags.currentText;
  const accountability = hasAny(text, ['learned', 'restraint', 'without making', 'without harm', 'without wound', 'not break', 'guardians', 'accountable']);
  const asksHarm = hasAny(text, ['what harm', 'harm my escape', 'wound this place', 'cause']);
  const boundedTruth = hasAny(text, ['remember', 'memory', 'truth', 'secret', 'name']);
  const asksRule = hasAny(text, ['rule', 'rules', 'game', 'playing']);
  const asksPermission = hasAny(text, ['may i', 'permission', 'ask before', 'touch the door', 'door, may']);

  if (gameState.encounter.id === 'glitch-imp') {
    if (flags.hostile) {
      return {
        beatId: 'combat_escalation',
        addFlags: ['imp_threatened'],
        lastEntityIntent: 'punish_force',
        entityText: 'No cutting. Cutting means bite-the-door, bite-the-hand, bite-everything. The lock begins to spark under its claws.',
        suggestions: [
          '(I pull my hand back.) Fine. No cutting. Tell me how to ask the door.',
          'I made the wrong move. What does the door want to be called?',
          '(I strike before it bites the controls.) Then get away from the lock.',
        ],
        pressureBonus: 1,
        trustBonus: -4,
        insightBonus: 0,
      };
    }
    if ((beat === 'rules_given' || beat === 'opening') && (asksPermission || flags.respectful || text.includes('before i touch'))) {
      return {
        beatId: 'permission_test',
        addFlags: ['asked_before_touching'],
        lastEntityIntent: 'test_permission',
        entityText: 'Good. You heard the first rule. Now ask the door nicely, and ask me what it likes to be called.',
        suggestions: [
          'Door, may I pass if I use the name the imp gives me?',
          'What does the door like to be called?',
          'I followed the first rule. What is the second rule really testing?',
        ],
        clue: 'Ask before touching, then learn what the door likes to be called.',
        pressureBonus: -1,
        trustBonus: 8,
        insightBonus: 8,
      };
    }
    if (beat === 'permission_test' && hasAny(text, ['called', 'name', 'door, may', 'door may'])) {
      return {
        beatId: 'door_named',
        addFlags: ['door_respected'],
        lastEntityIntent: 'offer_passage',
        entityText: 'It likes "Latchbright." Say please to Latchbright, not to me. I only keep score.',
        suggestions: [
          'Please, Latchbright, open long enough for me to pass.',
          '(I keep my hands clear of the panel.) Latchbright, I am asking before I touch.',
          'You keep score. What score do I need to leave?',
        ],
        clue: 'The lock responds to being treated like a participant, not an object.',
        pressureBonus: -1,
        trustBonus: 10,
        insightBonus: 10,
      };
    }
    if (beat === 'door_named') {
      return {
        beatId: 'pass_ready',
        addFlags: ['imp_rules_completed'],
        lastEntityIntent: 'yield_exit',
        entityText: 'Latchbright clicks open. The imp grins like it invented mercy and pretends not to move aside.',
        suggestions: [
          'Thank you. I will remember that the locks here listen.',
          '(I pass without touching the imp or the panel.)',
          'You win this game. I am leaving before I ruin the score.',
        ],
        pressureBonus: -1,
        trustBonus: 14,
        insightBonus: 14,
      };
    }
    return {
      beatId: asksRule ? 'rules_given' : 'opening',
      addFlags: asksRule ? ['rules_revealed'] : [],
      lastEntityIntent: asksRule ? 'explain_rules' : 'demand_clearer_move',
      entityText: asksRule
        ? 'Rules, yes. First rule: ask before touching. Second rule: do not pretend I am a broken button.'
        : 'That is a sound, not a move. The imp taps the lock and waits for something sharper.',
      suggestions: asksRule
        ? [
            'All right. I am asking before touching: may I approach the door?',
            '(I pull my hand back from the panel.) Your rule first, my escape second.',
            'If you are not a broken button, what are you in this game?',
          ]
        : [
            'What game are you playing with the lock?',
            '(I keep my hands away from the panel.) I will wait for your rule.',
            '(I reach for the panel anyway.) I do not have time for games.',
          ],
      clue: asksRule ? 'It wants you to ask before touching the lock.' : undefined,
      pressureBonus: 0,
      trustBonus: asksRule ? 6 : 0,
      insightBonus: asksRule ? 10 : 3,
    };
  }

  if (gameState.encounter.id === 'memory-warden') {
    if (flags.hostile) {
      return {
        beatId: 'combat_escalation',
        addFlags: ['warden_attacked'],
        lastEntityIntent: 'punish_force',
        entityText: 'Then you would rather lose blood than truth. The warden coils tighter around the gate.',
        suggestions: [
          '(I lower the weapon.) Wait. I can offer a truth without surrendering myself.',
          'What truth would satisfy the gate without taking my name?',
          '(I strike at the coil before it closes.)',
        ],
        pressureBonus: 1,
        trustBonus: -6,
        insightBonus: 0,
      };
    }
    if (beat === 'opening' || beat === 'truth_requested') {
      if (boundedTruth) {
        return {
          beatId: 'bounded_memory',
          addFlags: ['bounded_truth_offered'],
          lastEntityIntent: 'weigh_truth',
          entityText: 'A bounded truth. Better than a heroic speech. Keep the name if the memory still costs you something.',
          suggestions: [
            'I remember being trusted with a secret and almost spending it to look brave.',
            'You can have the shame of that memory, but not the person who gave it to me.',
            '(I touch my temple.) Take only the weight of it, not the shape.',
          ],
          clue: 'A small honest memory is safer than a grand vow.',
          pressureBonus: -1,
          trustBonus: 10,
          insightBonus: 8,
        };
      }
      return {
        beatId: 'truth_requested',
        addFlags: ['truth_requested'],
        lastEntityIntent: 'ask_cost',
        entityText: 'I protect the memories people spend too cheaply. What can you give that still leaves you whole?',
        suggestions: [
          'I can give you a true memory, but I will not give you a person\'s name.',
          'What do you take from people who promise more than they mean?',
          '(I set my weapon down, but keep it within reach.) I will not buy passage with a fake vow.',
        ],
        pressureBonus: 0,
        trustBonus: flags.curious ? 5 : 2,
        insightBonus: flags.curious ? 8 : 4,
      };
    }
    if (beat === 'bounded_memory' || beat === 'promise_test') {
      return {
        beatId: 'pass_ready',
        addFlags: ['warden_truth_paid'],
        lastEntityIntent: 'accept_cost',
        entityText: 'The gate takes the weight, not the name. You may pass with the memory changed, but not stolen.',
        suggestions: [
          'Then I will carry what remains honestly.',
          '(I step through before I can bargain for the pain back.)',
          'I will not call that mercy, but I accept the cost.',
        ],
        pressureBonus: -1,
        trustBonus: 14,
        insightBonus: 12,
      };
    }
  }

  if (gameState.encounter.id === 'neurodrake') {
    if (flags.hostile || hasAny(text, ['weapon', 'done being judged', 'raise my weapon'])) {
      return {
        beatId: 'combat_escalation',
        addFlags: ['neurodrake_threatened'],
        lastEntityIntent: 'answer_force',
        entityText: 'Raise it, then. But understand this: if force is your answer, the exit will remember you as another wound.',
        suggestions: [
          '(I lower the weapon a fraction.) I do not want force to be my answer.',
          'If the exit remembers wounds, tell me what wound my escape would leave.',
          '(I commit to the strike.) Then remember that I survived.',
        ],
        pressureBonus: 1,
        trustBonus: -8,
        insightBonus: 2,
      };
    }
    if (beat === 'opening') {
      if (accountability) {
        return {
          beatId: 'harm_question',
          addFlags: ['claimed_restraint'],
          lastEntityIntent: 'demand_specific_harm',
          entityText: 'Then name the harm you are trying not to cause. Restraint without an object is only a prettier hunger.',
          suggestions: [
            'If I tear the exit open, every guardian after you learns that listening was pointless.',
            'The harm is treating minds as locks. I am asking instead of forcing because I finally see that.',
            '(I keep my weapon lowered.) Show me the part of leaving that would hurt this place.',
          ],
          clue: 'The Neurodrake needs a specific account of harm, not a vague claim of restraint.',
          pressureBonus: 0,
          trustBonus: 8,
          insightBonus: 10,
        };
      }
      return {
        beatId: 'accountability_challenge',
        addFlags: ['accountability_requested'],
        lastEntityIntent: 'challenge_escape',
        entityText: 'I hear the wish to escape. I do not yet hear why your escape should not wound this place.',
        suggestions: [
          'I learned the lock was never just a lock. I am asking to leave without making another wound.',
          'Tell me what harm my escape would cause, and I will answer that first.',
          '(I raise my weapon.) Maybe I am done being judged.',
        ],
        pressureBonus: 0,
        trustBonus: 2,
        insightBonus: 4,
      };
    }
    if (beat === 'accountability_challenge') {
      if (accountability || asksHarm) {
        return {
          beatId: 'harm_question',
          addFlags: ['harm_named'],
          lastEntityIntent: 'ask_repair',
          entityText: 'Good. Then answer the harder part: what will you repair after you leave?',
          suggestions: [
            'I will carry the rule forward: ask before taking, listen before cutting.',
            'I cannot repair everything, but I can leave without teaching the Nexus that violence is the only language.',
            '(I look back toward the other gates.) I owe the minds behind me more than survival.',
          ],
          clue: 'The final guardian wants accountability after escape, not just permission to escape.',
          pressureBonus: 0,
          trustBonus: 9,
          insightBonus: 9,
        };
      }
    }
    if (beat === 'harm_question' || beat === 'restraint_proven') {
      return {
        beatId: 'pass_ready',
        addFlags: ['restraint_proven'],
        lastEntityIntent: 'open_exit',
        entityText: 'Then leave as someone who was changed by the minds they met. The exit opens because you stopped calling it victory.',
        suggestions: [
          'I will leave without breaking the door behind me.',
          '(I step through and keep my weapon lowered.)',
          'Thank you. I will not make survival my excuse.',
        ],
        pressureBonus: -1,
        trustBonus: 14,
        insightBonus: 14,
      };
    }
  }

  return {
    beatId: beat,
    addFlags: [],
    lastEntityIntent: 'press_for_clarity',
    entityText: `${gameState.encounter.name} waits for a clearer answer.`,
    suggestions: [
      'What do you need from me before the way opens?',
      '(I keep still.) I am listening before I move.',
      '(I move toward the exit.) We can keep talking, but I am not staying here.',
    ],
    pressureBonus: 0,
    trustBonus: flags.respectful ? 4 : 0,
    insightBonus: flags.curious ? 4 : 0,
  };
}

function buildFallbackParleyResponse(message: string, gameState: ParleyClientGameState): ParleyDMResponse {
  const text = message.toLowerCase();
  const updates: ParleyGameStateUpdate[] = [];
  const hidden = gameState.encounter.hidden;
  const thresholds = gameState.thresholds ?? { trustPass: 55, insightPass: 55, costlyPass: 40 };
  const activeTool = gameState.activeToolId ? gameState.dialogTools.find(tool => tool.id === gameState.activeToolId) : null;
  let trustDelta = 0;
  let insightDelta = 0;
  let pressureDelta = 0;
  let playerHpDelta = 0;
  let enemyHpDelta = 0;
  let clue: string | undefined;

  const parenthetical = [...message.matchAll(/\(([^)]*)\)/g)].map(match => match[1].toLowerCase()).join(' ');
  const hostile = /\b(attack|hit|kill|delete|break|threaten|force|hack it open|shut up|slash|strike|shoot|stab|lunge)\b/.test(text);
  const impatient = /\b(hurry|quickly|move|out of my way|skip|ignore)\b/.test(text);
  const curious = /\b(ask|what|why|how|rule|rules|game|playing|guard|protect|want|need)\b/.test(text);
  const respectful = /\b(please|sorry|respect|careful|honest|truth|listen|watch|wait|visible)\b/.test(text);
  const flattering = /\b(clever|smart|interesting|impressive|nice|beautiful)\b/.test(text);
  const promise = /\b(promise|vow|swear|owe|deal|bargain)\b/.test(text);
  const probe = /\b(probe|analyze|scan|study|pattern|rule)\b/.test(text);
  const calmingAction = /\b(lower|open hands|hands visible|step back|kneel|wait|still|slowly)\b/.test(parenthetical);
  const suddenAction = /\b(grab|run|lunge|slash|strike|shoot|stab|force|kick|break)\b/.test(parenthetical);

  if (hostile) {
    trustDelta -= 12;
    pressureDelta += 3;
    enemyHpDelta -= Math.random() < 0.75 ? 3 : 1;
    playerHpDelta -= Math.random() < 0.65 ? 2 : 1;
  }
  if (impatient) {
    trustDelta -= 6;
    pressureDelta += 2;
  }
  if (curious) {
    trustDelta += 6;
    insightDelta += 12;
  }
  if (respectful) {
    trustDelta += 8;
    pressureDelta -= 1;
  }
  if (calmingAction) {
    pressureDelta -= 1;
    trustDelta += 3;
  }
  if (suddenAction) {
    pressureDelta += 2;
    playerHpDelta -= 1;
  }
  if (flattering) {
    trustDelta += 7;
  }
  if (promise || activeTool?.kind === 'promise') {
    trustDelta += 12;
    updates.push({ type: 'use_dialog_tool', toolId: activeTool?.id ?? 'promise' });
  }
  if (probe || activeTool?.kind === 'probe') {
    insightDelta += 10;
    updates.push({ type: 'use_dialog_tool', toolId: activeTool?.id ?? 'probe' });
  }
  if (activeTool?.kind === 'empathize') {
    trustDelta += respectful || curious ? 12 : 4;
    updates.push({ type: 'use_dialog_tool', toolId: activeTool.id });
  }
  if (activeTool?.kind === 'deflect') {
    pressureDelta -= 2;
    trustDelta -= curious || respectful ? 0 : 3;
    updates.push({ type: 'use_dialog_tool', toolId: activeTool.id });
  }
  if (activeTool?.kind === 'anchor') {
    pressureDelta -= 2;
    playerHpDelta += gameState.playerHp < gameState.playerMaxHp ? 1 : 0;
    updates.push({ type: 'use_dialog_tool', toolId: activeTool.id });
  }

  const progression = buildFallbackProgression(gameState, { hostile, curious, respectful, currentText: text });
  pressureDelta += progression.pressureBonus;
  trustDelta += progression.trustBonus;
  insightDelta += progression.insightBonus;

  if (trustDelta === 0 && insightDelta === 0 && pressureDelta === 0) {
    insightDelta += 4;
    pressureDelta += 1;
  }

  if (insightDelta > 0 && hidden) {
    clue = progression.clue ?? fallbackClue(gameState.encounter.id, hidden);
  }

  updates.push({
    type: 'set_dialog_progress',
    beatId: progression.beatId,
    addFlags: progression.addFlags,
    lastEntityIntent: progression.lastEntityIntent,
  });
  if (pressureDelta !== 0) updates.push({ type: 'adjust_pressure', amount: pressureDelta, reason: 'fallback intent judgement' });
  if (playerHpDelta !== 0) updates.push({ type: 'adjust_player_hp', amount: playerHpDelta, reason: 'fallback retaliation' });
  if (enemyHpDelta !== 0) updates.push({ type: 'adjust_enemy_hp', amount: enemyHpDelta, reason: 'fallback combat action' });
  if (trustDelta !== 0) updates.push({ type: 'adjust_trust', amount: trustDelta, reason: 'fallback intent judgement' });
  if (insightDelta !== 0) updates.push({ type: 'adjust_insight', amount: insightDelta, clue, reason: 'fallback intent judgement' });

  const projectedTrust = clampNumber(gameState.encounter.trust + trustDelta, 0, 100);
  const projectedInsight = clampNumber(gameState.encounter.insight + insightDelta, 0, 100);
  const projectedPressure = clampNumber(gameState.pressure + pressureDelta, 0, gameState.maxPressure);
  const projectedPlayerHp = clampNumber(gameState.playerHp + playerHpDelta, 0, gameState.playerMaxHp);
  const projectedEnemyHp = clampNumber(gameState.encounter.enemyHp + enemyHpDelta, 0, gameState.encounter.enemyMaxHp);
  if (projectedPressure >= gameState.maxPressure || projectedPlayerHp <= 0) {
    updates.push({ type: 'resolve_encounter', outcome: 'defeat', reason: projectedPlayerHp <= 0 ? 'player HP reached zero' : 'pressure reached maximum' });
  } else if (projectedEnemyHp <= 0 || projectedTrust >= thresholds.trustPass || projectedInsight >= thresholds.insightPass) {
    updates.push({ type: 'resolve_encounter', outcome: 'pass', reason: 'the entity accepts the parley' });
  }

  const entityReaction = progression.entityText;
  const engineText = projectedEnemyHp <= 0
    ? 'The entity can no longer block the exit. The path opens, but the Nexus remembers the force.'
    : projectedTrust >= thresholds.trustPass || projectedInsight >= thresholds.insightPass
      ? 'The path opens for now. You survived this mind without turning the room into a fight.'
    : clue
      ? clue
      : 'The parley continues. You need more trust, more insight, or a costly risk.';

  const beats: ParleyBeat[] = [
    { type: 'player', speaker: gameState.hero.name, text: stripOuterQuotes(message) },
    { type: 'entity', speaker: gameState.encounter.name, text: entityReaction },
  ];
  if (projectedEnemyHp <= 0 || projectedTrust >= thresholds.trustPass || projectedInsight >= thresholds.insightPass || projectedPressure >= gameState.maxPressure || projectedPlayerHp <= 0) {
    beats.push({ type: 'engine', speaker: 'Nexus', text: engineText });
  }

  return {
    updates,
    narration: `${entityReaction} ${engineText}`,
    beats,
    suggestions: progression.suggestions,
  };
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function shouldUseHermesEngine(config: EngineConfig): boolean {
  if (config.apiMode === 'responses') return true;
  if (config.apiMode === 'chat') return false;
  return /hermes|8642/i.test(config.baseUrl) || /hermes/i.test(config.model);
}

async function runParleyHermesEngine(
  message: string,
  gameState: ParleyClientGameState,
  config: EngineConfig,
): Promise<ParleyDMResponse> {
  const { apiKey, baseUrl, model, timeoutMs = 60000 } = config;
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;

  const historyMessages: OAIMessage[] = gameState.recentMessages.map(m =>
    m.type === 'player'
      ? { role: 'user' as const, content: m.text }
      : { role: 'assistant' as const, content: m.speaker ? `[${m.speaker}] ${m.text}` : m.text },
  );

  const messages: OAIMessage[] = [
    { role: 'system', content: buildParleySystemPrompt(gameState) },
    ...historyMessages,
    { role: 'user', content: message },
  ];

  const fallback = (error?: string): ParleyDMResponse => ({
    ...buildFallbackParleyResponse(message, gameState),
    debug: createDebugTurn(model, 'fallback', messages, error),
  });

  if (!apiKey) return fallback('OPENAI_API_KEY not configured.');

  let response: Response;
  try {
    response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages, temperature: 0.75, max_tokens: 900 }),
    }, timeoutMs);
  } catch (err) {
    return fallback(`Request failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => 'unknown');
    return fallback(`Upstream ${response.status}: ${errText}`);
  }

  const data = await response.json() as {
    choices: Array<{ message: { role: string; content: string | null } }>;
  };

  const content = data.choices?.[0]?.message?.content ?? '';
  messages.push({ role: 'assistant', content });

  let parsed: Record<string, unknown>;
  try {
    parsed = extractJSONFromContent(content) as Record<string, unknown>;
  } catch {
    return fallback(`JSON parse failed. Raw: ${content.slice(0, 200)}`);
  }

  const beats = (parsed.beats as ParleyBeat[] | undefined) ?? [];
  const suggestions = (parsed.suggestions as string[] | undefined) ?? [];

  if (beats.length === 0 || suggestions.length === 0) {
    return fallback('Model returned empty beats or suggestions.');
  }

  const updates: ParleyGameStateUpdate[] = [];
  const sim: ParleySimState = {
    pressure: gameState.pressure, maxPressure: gameState.maxPressure,
    playerHp: gameState.playerHp, playerMaxHp: gameState.playerMaxHp,
    enemyHp: gameState.encounter.enemyHp, enemyMaxHp: gameState.encounter.enemyMaxHp,
    trust: gameState.encounter.trust, insight: gameState.encounter.insight,
  };

  const adj = (parsed.adjustments as Record<string, number> | undefined) ?? {};

  if (adj.trust) {
    const amount = clampNumber(Math.round(adj.trust), -20, 20);
    sim.trust = clampNumber(sim.trust + amount, 0, 100);
    updates.push({ type: 'adjust_trust', amount, reason: 'hermes json' });
  }
  if (adj.insight) {
    const amount = clampNumber(Math.round(adj.insight), -20, 20);
    const clue = typeof parsed.clue === 'string' ? parsed.clue : undefined;
    sim.insight = clampNumber(sim.insight + amount, 0, 100);
    updates.push({ type: 'adjust_insight', amount, clue, reason: 'hermes json' });
  }
  if (adj.pressure) {
    const amount = clampNumber(Math.round(adj.pressure), -4, 4);
    sim.pressure = clampNumber(sim.pressure + amount, 0, sim.maxPressure);
    updates.push({ type: 'adjust_pressure', amount, reason: 'hermes json' });
  }
  if (adj.playerHp) {
    const amount = clampNumber(Math.round(adj.playerHp), -6, 4);
    sim.playerHp = clampNumber(sim.playerHp + amount, 0, sim.playerMaxHp);
    updates.push({ type: 'adjust_player_hp', amount, reason: 'hermes json' });
  }
  if (adj.enemyHp) {
    const amount = clampNumber(Math.round(adj.enemyHp), -8, 4);
    sim.enemyHp = clampNumber(sim.enemyHp + amount, 0, sim.enemyMaxHp);
    updates.push({ type: 'adjust_enemy_hp', amount, reason: 'hermes json' });
  }

  if (parsed.wound && typeof parsed.wound === 'object') {
    const w = parsed.wound as { name?: string; severity?: number };
    updates.push({ type: 'add_wound', name: String(w.name ?? 'Wound').slice(0, 48), severity: clampNumber(Math.round(Number(w.severity ?? 1)), 1, 3) });
  }

  const VALID_BEAT_IDS = new Set([
    'opening', 'rules_given', 'permission_test', 'door_named',
    'truth_requested', 'bounded_memory', 'promise_test',
    'accountability_challenge', 'harm_question', 'restraint_proven',
    'pass_ready', 'combat_escalation',
  ]);

  if (parsed.dialogProgress && typeof parsed.dialogProgress === 'object') {
    const dp = parsed.dialogProgress as { beatId?: string; addFlags?: string[]; lastEntityIntent?: string };
    const beatId = typeof dp.beatId === 'string' ? dp.beatId.slice(0, 48) : undefined;
    if (!beatId || VALID_BEAT_IDS.has(beatId)) {
      updates.push({
        type: 'set_dialog_progress',
        beatId,
        addFlags: Array.isArray(dp.addFlags) ? dp.addFlags.map(f => String(f).slice(0, 48)).slice(0, 5) : undefined,
        lastEntityIntent: typeof dp.lastEntityIntent === 'string' ? dp.lastEntityIntent.slice(0, 80) : undefined,
      });
    }
  }

  if (parsed.resolve && typeof parsed.resolve === 'object') {
    const r = parsed.resolve as { outcome?: string; reason?: string };
    const outcome = r.outcome === 'defeat' || r.outcome === 'wound' ? r.outcome : 'pass';
    const { trustPass, insightPass, costlyPass } = gameState.thresholds ?? { trustPass: 55, insightPass: 55, costlyPass: 40 };
    const minTurnsReached = gameState.encounterTurnCount + 1 >= 3;
    const pressureDefeat = sim.pressure >= sim.maxPressure;
    const hpDefeat = sim.playerHp <= 0;
    const canPass = sim.enemyHp <= 0 || sim.trust >= trustPass || sim.insight >= insightPass;
    const canWoundPass = outcome === 'wound' && (sim.trust >= costlyPass || sim.insight >= costlyPass);
    if (outcome === 'defeat' || pressureDefeat || hpDefeat) {
      updates.push({ type: 'resolve_encounter', outcome: 'defeat', reason: r.reason });
    } else if ((sim.enemyHp > 0 && !minTurnsReached) || (!canPass && !canWoundPass)) {
      // guard: silently drop premature or unearned resolve
    } else {
      updates.push({ type: 'resolve_encounter', outcome, reason: r.reason });
    }
  }

  return {
    updates,
    narration: typeof parsed.narration === 'string' ? parsed.narration : beats.map(b => b.text).join(' '),
    beats,
    suggestions: suggestions.slice(0, 3),
    debug: createDebugTurn(model, 'ai', messages),
  };
}

async function runParleyChatEngine(
  message: string,
  gameState: ParleyClientGameState,
  config: EngineConfig,
): Promise<ParleyDMResponse> {
  const { apiKey, baseUrl, model, timeoutMs = 30000 } = config;
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
  const messages: OAIMessage[] = [
    { role: 'system', content: buildParleySystemPrompt(gameState) },
    { role: 'user', content: message },
  ];
  const fallback = (error?: string): ParleyDMResponse => {
    const response = buildFallbackParleyResponse(message, gameState);
    return {
      ...response,
      debug: createDebugTurn(model, 'fallback', messages, error),
    };
  };

  if (!apiKey) return fallback('OPENAI_API_KEY is not configured; deterministic fallback judged this turn.');

  const updates: ParleyGameStateUpdate[] = [];
  const sim: ParleySimState = {
    pressure: gameState.pressure,
    maxPressure: gameState.maxPressure,
    playerHp: gameState.playerHp,
    playerMaxHp: gameState.playerMaxHp,
    enemyHp: gameState.encounter.enemyHp,
    enemyMaxHp: gameState.encounter.enemyMaxHp,
    trust: gameState.encounter.trust,
    insight: gameState.encounter.insight,
  };
  let narration = '';
  let beats: ParleyBeat[] = [];
  let narrateSuggestions: string[] = [];
  let narrateCalled = false;

  for (let i = 0; i < 10 && !narrateCalled; i++) {
    let response: Response;
    try {
      response = await fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model, messages, tools: PARLEY_TOOLS, tool_choice: 'auto', temperature: 0.75, max_tokens: 900 }),
      }, timeoutMs);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return fallback(`Chat completion request failed: ${msg}`);
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => 'unknown upstream error');
      return fallback(`Upstream ${response.status}: ${errText}`);
    }

    const data = await response.json() as {
      choices: Array<{ message: { role: string; content: string | null; tool_calls?: OAIToolCall[] } }>;
    };

    const assistantMsg = data.choices[0].message;
    messages.push(assistantMsg as OAIMessage);

    const toolCalls = assistantMsg.tool_calls;
    if (!toolCalls?.length) {
      narration = assistantMsg.content ?? '';
      break;
    }

    const toolResults: OAIMessage[] = [];
    for (const tc of toolCalls) {
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(tc.function.arguments); } catch { /* malformed */ }
      if (tc.function.name === 'narrate') {
        narration = (args.text as string) ?? '';
        beats = (args.beats as ParleyBeat[]) ?? [];
        narrateSuggestions = (args.suggestions as string[]) ?? [];
        narrateCalled = true;
      }
      toolResults.push({ role: 'tool', tool_call_id: tc.id, content: executeParleyTool(tc.function.name, args, updates, gameState, sim) });
    }
    messages.push(...toolResults);
  }

  if (!narrateCalled || beats.length === 0 || narrateSuggestions.length === 0) {
    return fallback('Model response did not include the required narrate tool payload.');
  }

  return {
    updates,
    narration,
    beats,
    suggestions: narrateSuggestions.slice(0, 3),
    debug: createDebugTurn(model, 'ai', messages),
  };
}

export async function runParleyEngine(
  message: string,
  gameState: ParleyClientGameState,
  config: EngineConfig,
): Promise<ParleyDMResponse> {
  return shouldUseHermesEngine(config)
    ? runParleyHermesEngine(message, gameState, config)
    : runParleyChatEngine(message, gameState, config);
}
