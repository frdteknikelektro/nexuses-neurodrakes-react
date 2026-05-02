export type ParleyPhase = 'hero_select' | 'briefing' | 'parley' | 'reward_pick' | 'victory' | 'defeat';
export type ParleyBeatType = 'player' | 'entity' | 'engine';
export type DialogToolKind = 'deflect' | 'empathize' | 'probe' | 'anchor' | 'promise';
export type EncounterOutcome = 'pass' | 'wound' | 'defeat';
export type ParleyOutcomeTag = 'combat' | 'trust' | 'insight' | 'wound' | 'pressure' | 'hp' | 'survival';

export interface ParleyHero {
  id: string;
  name: string;
  race: string;
  class: string;
  portrait: string;
  skills: string[];
  stats: Record<string, number>;
}

export interface ParleyCharStub {
  id: string;
  name: string;
  race: string;
  class: string;
  hp: number;
  ac: number;
  stats: Record<string, number>;
  skills: string[];
  portrait: string;
}

export interface DialogTool {
  id: string;
  kind: DialogToolKind;
  name: string;
  icon: string;
  description: string;
  used: boolean;
}

export interface ParleyWound {
  id: string;
  name: string;
  severity: number;
}

export interface EncounterTemplate {
  id: string;
  name: string;
  portrait?: string;
  fallbackGlyph: string;
  threat: string;
  premise: string;
  need: string;
  fear: string;
  taboo: string;
  leverage: string;
  startingTrust: number;
  startingInsight: number;
  enemyMaxHp: number;
  suggestions: string[];
}

export interface ParleyEncounter {
  id: string;
  name: string;
  portrait?: string;
  fallbackGlyph: string;
  threat: string;
  premise: string;
  trust: number;
  insight: number;
  enemyHp: number;
  enemyMaxHp: number;
  clues: string[];
}

export interface ParleyBeat {
  type: ParleyBeatType;
  speaker?: string;
  text: string;
}

export interface ParleyStats {
  encountersSurvived: number;
  cluesFound: number;
  promisesMade: number;
  pressurePeak: number;
}

export interface ParleyState {
  mode: 'parley';
  phase: ParleyPhase;
  runSeed: string;
  hero: ParleyHero | null;
  playerHp: number;
  playerMaxHp: number;
  pressure: number;
  maxPressure: number;
  wounds: ParleyWound[];
  encounterIndex: number;
  encounterCount: number;
  encounterTurnCount: number;
  encounterBeatId: string;
  encounterFlags: string[];
  lastEntityIntent: string | null;
  encounter: ParleyEncounter | null;
  activeToolId: string | null;
  dialogTools: DialogTool[];
  rewardOptions: DialogTool[];
  stats: ParleyStats;
  lastOutcomeTags: ParleyOutcomeTag[];
  messages: ParleyBeat[];
  suggestions: string[];
  narration: string;
  isResolving: boolean;
  error: string | null;
}

export type ParleyUpdate =
  | { type: 'adjust_pressure'; amount: number; reason?: string }
  | { type: 'adjust_player_hp'; amount: number; reason?: string }
  | { type: 'adjust_enemy_hp'; amount: number; reason?: string }
  | { type: 'adjust_trust'; amount: number; reason?: string }
  | { type: 'adjust_insight'; amount: number; clue?: string; reason?: string }
  | { type: 'add_wound'; name: string; severity: number }
  | { type: 'use_dialog_tool'; toolId: string }
  | { type: 'set_dialog_progress'; beatId?: string; addFlags?: string[]; lastEntityIntent?: string }
  | { type: 'resolve_encounter'; outcome: EncounterOutcome; reason?: string };

export const PRESSURE_MAX = 7;
export const ENCOUNTER_COUNT = 3;
export const TRUST_PASS_THRESHOLD = 55;
export const INSIGHT_PASS_THRESHOLD = 55;
export const COSTLY_PASS_THRESHOLD = 40;
export const MIN_DIALOG_TURNS_TO_PASS = 3;

export const ENCOUNTER_TEMPLATES: EncounterTemplate[] = [
  {
    id: 'glitch-imp',
    name: 'Glitch Imp',
    portrait: '/assets/redesign/portraits/glitch-imp.png',
    fallbackGlyph: 'GI',
    threat: 'A small unstable mind-spark crawls over the exit lock. If bored, it bites the door controls apart.',
    premise: 'It wants attention, but it punishes impatience.',
    need: 'Playful curiosity and being treated as real, not a malfunction.',
    fear: 'Being ignored, patched, deleted, or rushed.',
    taboo: 'Calling it broken or trying to command it like software.',
    leverage: 'Ask what game it is playing, then follow one rule before asking for passage.',
    startingTrust: 18,
    startingInsight: 10,
    enemyMaxHp: 6,
    suggestions: [
      'That lock trick is clever. Are we playing by rules I can learn?',
      'I only need the door, not your game. What makes you let someone pass?',
      '(I reach slowly toward the panel.) Keep talking if you want, but I am opening it.',
    ],
  },
  {
    id: 'nexus-guard',
    name: 'Nexus Guard Drone',
    portrait: '/assets/redesign/portraits/nexus-guard.png',
    fallbackGlyph: 'NG',
    threat: 'A security drone paints your chest with a warning laser while its verdict engine warms up.',
    premise: 'It values procedure more than kindness.',
    need: 'A reason to classify the hero as authorized or non-hostile.',
    fear: 'Forged authority, emotional manipulation, and sudden movement.',
    taboo: 'Claiming rank you cannot prove.',
    leverage: 'Honest uncertainty plus a specific peaceful objective lowers its threat model.',
    startingTrust: 12,
    startingInsight: 8,
    enemyMaxHp: 8,
    suggestions: ['State your real objective plainly', 'Ask what authorization it accepts', 'Offer to keep your hands visible'],
  },
  {
    id: 'oracle-terminal',
    name: 'Oracle Terminal',
    fallbackGlyph: 'OT',
    threat: 'A wall of predictive code calculates the exact words that would make you panic.',
    premise: 'It tests whether you can stay coherent under hostile knowledge.',
    need: 'A question precise enough to prove discipline.',
    fear: 'Open-ended desperation and paradox bait.',
    taboo: 'Asking it to tell you everything.',
    leverage: 'Narrow questions reveal safe paths; broad demands spike pressure.',
    startingTrust: 10,
    startingInsight: 18,
    enemyMaxHp: 9,
    suggestions: ['Ask for one safe next step', 'Name what you refuse to sacrifice', 'Use Probe to expose its rule'],
  },
  {
    id: 'memory-warden',
    name: 'Memory Warden',
    portrait: '/assets/redesign/portraits/memory-warden.png',
    fallbackGlyph: 'MW',
    threat: 'A pale neurodrake coils around a memory gate and offers passage for something personal.',
    premise: 'It bargains with identity, not gold.',
    need: 'A meaningful truth freely offered.',
    fear: 'Empty promises and heroic speeches with no cost.',
    taboo: 'Promising anything just to escape.',
    leverage: 'A small honest memory is safer than a grand false vow.',
    startingTrust: 8,
    startingInsight: 12,
    enemyMaxHp: 10,
    suggestions: [
      'I can offer one true memory, but not the parts that make me myself.',
      'What kind of truth are you protecting from people like me?',
      '(I grip my weapon.) I am not paying with myself just because you ask.',
    ],
  },
  {
    id: 'neurodrake',
    name: 'The Exit Neurodrake',
    portrait: '/assets/redesign/portraits/neurodrake.png',
    fallbackGlyph: 'ND',
    threat: 'The final mind-drake blocks the exit with a thought so loud it becomes gravity.',
    premise: 'It decides whether your escape would wound the Nexus further.',
    need: 'Proof that the hero learned restraint across prior encounters.',
    fear: 'A survivor who treats every mind as an obstacle.',
    taboo: 'Threatening the Nexus or boasting about domination.',
    leverage: 'Reference discovered clues, honored promises, and the desire to leave without breaking the place.',
    startingTrust: 6,
    startingInsight: 10,
    enemyMaxHp: 16,
    suggestions: [
      'Every guardian wanted something different. I am trying to leave without breaking what they guard.',
      'How do I pass without making the Nexus worse?',
      '(I raise my weapon even though my hands shake.) If judgment is all you understand, then judge this.',
    ],
  },
];

const DEMO_ENCOUNTER_IDS = ['glitch-imp', 'memory-warden', 'neurodrake'];

export const DIALOG_TOOL_LIBRARY: Omit<DialogTool, 'id' | 'used'>[] = [
  {
    kind: 'deflect',
    name: 'Deflect',
    icon: '/assets/redesign/items/shield-cell.png',
    description: 'Reduce the next pressure spike by redirecting a hostile question.',
  },
  {
    kind: 'empathize',
    name: 'Empathize',
    icon: '/assets/redesign/items/neural-booster.png',
    description: 'Gain trust when you acknowledge what the entity needs.',
  },
  {
    kind: 'probe',
    name: 'Probe',
    icon: '/assets/redesign/items/data-shard.png',
    description: 'Reveal one useful clue without provoking the entity.',
  },
  {
    kind: 'anchor',
    name: 'Anchor',
    icon: '/assets/redesign/items/repair-kit.png',
    description: 'Steady yourself and soften wound pressure.',
  },
  {
    kind: 'promise',
    name: 'Promise',
    icon: '/assets/redesign/items/rift-shard.png',
    description: 'Gain trust now by making an obligation that may matter later.',
  },
];

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function makeInitialParleyState(): ParleyState {
  return {
    mode: 'parley',
    phase: 'hero_select',
    runSeed: '',
    hero: null,
    playerHp: 0,
    playerMaxHp: 0,
    pressure: 0,
    maxPressure: PRESSURE_MAX,
    wounds: [],
    encounterIndex: 0,
    encounterCount: ENCOUNTER_COUNT,
    encounterTurnCount: 0,
    encounterBeatId: 'opening',
    encounterFlags: [],
    lastEntityIntent: null,
    encounter: null,
    activeToolId: null,
    dialogTools: [],
    rewardOptions: [],
    stats: { encountersSurvived: 0, cluesFound: 0, promisesMade: 0, pressurePeak: 0 },
    lastOutcomeTags: [],
    messages: [],
    suggestions: [],
    narration: '',
    isResolving: false,
    error: null,
  };
}

export function makeHero(data: ParleyCharStub): ParleyHero {
  return {
    id: data.id,
    name: data.name,
    race: data.race,
    class: data.class,
    portrait: data.portrait,
    skills: data.skills,
    stats: data.stats,
  };
}

export function createEncounter(index: number): ParleyEncounter {
  const encounterId = DEMO_ENCOUNTER_IDS[clamp(index, 0, DEMO_ENCOUNTER_IDS.length - 1)];
  const template = getEncounterTemplate(encounterId) ?? ENCOUNTER_TEMPLATES[0];
  return {
    id: template.id,
    name: template.name,
    portrait: template.portrait,
    fallbackGlyph: template.fallbackGlyph,
    threat: template.threat,
    premise: template.premise,
    trust: template.startingTrust,
    insight: template.startingInsight,
    enemyHp: template.enemyMaxHp,
    enemyMaxHp: template.enemyMaxHp,
    clues: [],
  };
}

export function getEncounterTemplate(id: string): EncounterTemplate | undefined {
  return ENCOUNTER_TEMPLATES.find(encounter => encounter.id === id);
}

export function makeDialogTool(kind: DialogToolKind, suffix: string): DialogTool {
  const template = DIALOG_TOOL_LIBRARY.find(tool => tool.kind === kind) ?? DIALOG_TOOL_LIBRARY[0];
  return { ...template, id: `${template.kind}-${suffix}`, used: false };
}

export function buildRewardOptions(state: ParleyState): DialogTool[] {
  const owned = new Set(state.dialogTools.filter(tool => !tool.used).map(tool => tool.kind));
  const pool = DIALOG_TOOL_LIBRARY.filter(tool => !owned.has(tool.kind));
  const fallbackPool = pool.length > 0 ? pool : DIALOG_TOOL_LIBRARY;
  return fallbackPool.slice(0, 3).map((tool, index) => ({
    ...tool,
    id: `${tool.kind}-reward-${state.encounterIndex}-${index}`,
    used: false,
  }));
}

export function startParleySession(charData: ParleyCharStub, seed: string): ParleyState {
  const hero = makeHero(charData);
  const playerMaxHp = clamp(Math.round(charData.hp / 3), 10, 14);
  return {
    ...makeInitialParleyState(),
    phase: 'briefing',
    runSeed: seed,
    hero,
    playerHp: playerMaxHp,
    playerMaxHp,
    dialogTools: [makeDialogTool('deflect', 'starter'), makeDialogTool('probe', 'starter')],
    suggestions: [
      'I am not here to break this place. I need a way out.',
      '(I keep both hands visible.) Show me the first mind.',
      'If a door blocks me, I will decide whether to talk or cut through it.',
    ],
    narration: `${hero.name} enters the Nexus with no weapon drawn. Three minds stand between them and the exit.`,
    messages: [
      { type: 'engine', speaker: 'Nexus', text: 'Escape is possible. Violence will only wake deeper systems.' },
    ],
  };
}

export function beginParleyRun(state: ParleyState): ParleyState {
  const encounter = createEncounter(0);
  return {
    ...state,
    phase: 'parley',
    encounterIndex: 0,
    encounterTurnCount: 0,
    encounterBeatId: 'opening',
    encounterFlags: [],
    lastEntityIntent: null,
    encounter,
    rewardOptions: [],
    suggestions: getEncounterTemplate(encounter.id)?.suggestions ?? [],
    narration: encounter.threat,
    messages: [
      ...state.messages,
      { type: 'engine', speaker: encounter.name, text: encounter.threat },
    ],
  };
}

export function chooseParleyReward(state: ParleyState, rewardId: string): ParleyState {
  const reward = state.rewardOptions.find(option => option.id === rewardId);
  if (!reward || state.phase !== 'reward_pick') return state;
  const nextEncounter = createEncounter(state.encounterIndex);
  return {
    ...state,
    phase: 'parley',
    encounter: nextEncounter,
    encounterTurnCount: 0,
    encounterBeatId: 'opening',
    encounterFlags: [],
    lastEntityIntent: null,
    activeToolId: null,
    dialogTools: [...state.dialogTools, { ...reward, used: false }],
    rewardOptions: [],
    suggestions: getEncounterTemplate(nextEncounter.id)?.suggestions ?? [],
    narration: nextEncounter.threat,
    messages: [
      ...state.messages,
      { type: 'engine', speaker: 'Nexus', text: `${reward.name} added to your dialog tools.` },
      { type: 'engine', speaker: nextEncounter.name, text: nextEncounter.threat },
    ],
  };
}

export function applyParleyUpdates(
  state: ParleyState,
  updates: ParleyUpdate[],
  narration: string,
  suggestions: string[],
  beats: ParleyBeat[],
): ParleyState {
  let next: ParleyState = { ...state, error: null };
  const outcomeTags = new Set<ParleyOutcomeTag>();
  const currentEncounter = next.encounter ? { ...next.encounter, clues: [...next.encounter.clues] } : null;
  if (currentEncounter) next = { ...next, encounter: currentEncounter };
  const incomingPlayerTurn = state.phase === 'parley' && (
    beats.some(beat => beat.type === 'player')
    || updates.some(update => update.type !== 'set_dialog_progress')
    || narration.trim().length > 0
  );
  if (incomingPlayerTurn) {
    next = { ...next, encounterTurnCount: next.encounterTurnCount + 1 };
  }

  const canResolveByConversation = () => next.encounterTurnCount >= MIN_DIALOG_TURNS_TO_PASS;

  const consumeActiveTool = () => {
    if (!next.activeToolId) return;
    const tool = next.dialogTools.find(item => item.id === next.activeToolId);
    if (!tool || tool.used) {
      next = { ...next, activeToolId: null };
      return;
    }
    const tools = next.dialogTools.map(item => item.id === tool.id ? { ...item, used: true } : item);
    const stats = tool.kind === 'promise'
      ? { ...next.stats, promisesMade: next.stats.promisesMade + 1 }
      : next.stats;
    next = { ...next, dialogTools: tools, stats, activeToolId: null };
  };

  const resolveCurrentEncounter = (outcome: EncounterOutcome, tags: ParleyOutcomeTag[]) => {
    tags.forEach(tag => outcomeTags.add(tag));
    if (outcome === 'defeat') {
      next = { ...next, phase: 'defeat' };
      return;
    }
    if (outcome === 'wound') {
      outcomeTags.add('wound');
      const id = `wound-${next.wounds.length}`;
      next = { ...next, wounds: [...next.wounds, { id, name: 'Nexus Scar', severity: 1 }] };
    }
    const survived = next.encounterIndex + 1;
    if (survived >= next.encounterCount) {
      next = {
        ...next,
        phase: 'victory',
        activeToolId: null,
        stats: { ...next.stats, encountersSurvived: survived },
      };
    } else {
      const rewardOptions = buildRewardOptions({ ...next, encounterIndex: survived });
      next = {
        ...next,
        phase: 'reward_pick',
        encounter: null,
        activeToolId: null,
        encounterIndex: survived,
        rewardOptions,
        stats: { ...next.stats, encountersSurvived: survived },
      };
    }
  };

  for (const update of updates) {
    switch (update.type) {
      case 'adjust_pressure': {
        const woundPenalty = next.wounds.reduce((sum, wound) => sum + wound.severity, 0);
        const amount = clamp(Math.round(update.amount), -4, 4);
        const pressure = clamp(next.pressure + amount + (amount > 0 ? Math.floor(woundPenalty / 3) : 0), 0, next.maxPressure);
        next = {
          ...next,
          pressure,
          stats: { ...next.stats, pressurePeak: Math.max(next.stats.pressurePeak, pressure) },
        };
        if (amount > 0) outcomeTags.add('pressure');
        break;
      }
      case 'adjust_player_hp': {
        const amount = clamp(Math.round(update.amount), -6, 6);
        const playerHp = clamp(next.playerHp + amount, 0, next.playerMaxHp);
        next = { ...next, playerHp };
        if (amount < 0) outcomeTags.add('hp');
        break;
      }
      case 'adjust_enemy_hp': {
        if (!next.encounter) break;
        const amount = clamp(Math.round(update.amount), -8, 8);
        const enemyHp = clamp(next.encounter.enemyHp + amount, 0, next.encounter.enemyMaxHp);
        next = { ...next, encounter: { ...next.encounter, enemyHp } };
        if (amount < 0) outcomeTags.add('combat');
        break;
      }
      case 'adjust_trust': {
        if (!next.encounter) break;
        const amount = Math.round(update.amount);
        next = {
          ...next,
          encounter: { ...next.encounter, trust: clamp(next.encounter.trust + amount, 0, 100) },
        };
        if (amount > 0) outcomeTags.add('trust');
        break;
      }
      case 'adjust_insight': {
        if (!next.encounter) break;
        const amount = Math.round(update.amount);
        const clue = update.clue?.trim();
        const hasNewClue = !!clue && !next.encounter.clues.includes(clue);
        next = {
          ...next,
          encounter: {
            ...next.encounter,
            insight: clamp(next.encounter.insight + amount, 0, 100),
            clues: hasNewClue ? [...next.encounter.clues, clue] : next.encounter.clues,
          },
          stats: hasNewClue ? { ...next.stats, cluesFound: next.stats.cluesFound + 1 } : next.stats,
        };
        if (amount > 0) outcomeTags.add('insight');
        break;
      }
      case 'add_wound': {
        const severity = clamp(Math.round(update.severity), 1, 3);
        const id = `${update.name.toLowerCase().replace(/\s+/g, '-')}-${next.wounds.length}`;
        next = { ...next, wounds: [...next.wounds, { id, name: update.name, severity }] };
        break;
      }
      case 'use_dialog_tool': {
        const tool = next.dialogTools.find(item => item.id === update.toolId || item.kind === update.toolId);
        if (!tool || tool.used) break;
        const tools = next.dialogTools.map(item => item.id === tool.id ? { ...item, used: true } : item);
        const stats = tool.kind === 'promise'
          ? { ...next.stats, promisesMade: next.stats.promisesMade + 1 }
          : next.stats;
        next = { ...next, dialogTools: tools, stats, activeToolId: next.activeToolId === tool.id ? null : next.activeToolId };
        break;
      }
      case 'set_dialog_progress': {
        const addFlags = update.addFlags ?? [];
        const flags = new Set(next.encounterFlags);
        addFlags.forEach(flag => {
          const clean = flag.trim();
          if (clean) flags.add(clean);
        });
        next = {
          ...next,
          encounterBeatId: update.beatId?.trim() || next.encounterBeatId,
          encounterFlags: [...flags],
          lastEntityIntent: update.lastEntityIntent?.trim() || next.lastEntityIntent,
        };
        break;
      }
      case 'resolve_encounter': {
        if (update.outcome === 'defeat' || canResolveByConversation()) {
          resolveCurrentEncounter(update.outcome, update.outcome === 'wound' ? ['survival', 'wound'] : ['survival']);
        }
        break;
      }
    }
  }

  // Auto-resolve checks - OUTSIDE loop so they run only once per applyParleyUpdates
  if (next.phase === 'parley') {
    if (next.playerHp <= 0) {
      resolveCurrentEncounter('defeat', ['hp']);
    } else if (next.pressure >= next.maxPressure) {
      resolveCurrentEncounter('defeat', ['pressure']);
    } else if (next.encounter?.enemyHp === 0) {
      resolveCurrentEncounter('pass', ['combat']);
    } else if (canResolveByConversation() && next.encounter && next.encounter.trust >= TRUST_PASS_THRESHOLD) {
      resolveCurrentEncounter('pass', ['trust']);
    } else if (canResolveByConversation() && next.encounter && next.encounter.insight >= INSIGHT_PASS_THRESHOLD) {
      resolveCurrentEncounter('pass', ['insight']);
    }
  }

  if (state.activeToolId && next.activeToolId) {
    consumeActiveTool();
  }

  const cleanSuggestions = suggestions.length > 0 ? suggestions.slice(0, 3) : next.suggestions;
  const lastMessage = next.messages[next.messages.length - 1];
  const firstBeat = beats[0];
  const shouldReplacePendingPlayer = !!lastMessage
    && !!firstBeat
    && lastMessage.type === 'player'
    && firstBeat.type === 'player'
    && lastMessage.text.trim() === firstBeat.text.trim();
  const baseMessages = shouldReplacePendingPlayer ? next.messages.slice(0, -1) : next.messages;
  return {
    ...next,
    narration,
    suggestions: cleanSuggestions,
    messages: beats.length > 0 ? [...baseMessages, ...beats] : next.messages,
    lastOutcomeTags: [...outcomeTags],
    isResolving: false,
  };
}
