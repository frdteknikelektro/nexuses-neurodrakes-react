import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import AIDebugSidePanel from './AIDebugSidePanel';
import { INSIGHT_PASS_THRESHOLD, TRUST_PASS_THRESHOLD, createEncounter } from '../engine/parley';
import type { DialogTool, ParleyBeat, ParleyState } from '../engine/parley';
import type { AIDebugTurn } from '../hooks/useParleyAI';

interface ParleyScreenProps {
  state: ParleyState;
  isResolving: boolean;
  onSendMessage: (text: string) => void;
  onRestart: () => void;
  onBeginRun: () => void;
  onChooseReward: (rewardId: string) => void;
  onSetActiveTool: (toolId: string | null) => void;
  aiDebugTurns?: AIDebugTurn[];
}

function Meter({
  label,
  value,
  max,
  tone,
  note,
}: {
  label: string;
  value: number;
  max: number;
  tone: 'danger' | 'trust' | 'insight' | 'hp' | 'enemy';
  note?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const color = tone === 'danger' ? '#d96a4b' : tone === 'trust' ? '#7cd39b' : tone === 'enemy' ? '#d7a34a' : tone === 'hp' ? '#b7d7ff' : '#7aa5e8';
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-wood">
        <span>{label}</span>
        <span className="tabular-nums">{value}/{max}</span>
      </div>
      {note ? <div className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-brown/45">{note}</div> : null}
      <div className="mt-1 h-2 overflow-hidden rounded bg-black/40 border border-white/10">
        <div className="h-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function Portrait({ src, glyph, name }: { src?: string; glyph: string; name: string }) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className="h-full w-full object-cover object-top"
      />
    );
  }
  return (
    <div className="h-full w-full flex items-center justify-center bg-sky/10 text-sky text-5xl font-bold tracking-widest">
      {glyph}
    </div>
  );
}

function ResetButton({ onRestart }: { onRestart: () => void }) {
  return (
    <button
      type="button"
      onClick={onRestart}
      className="px-3 py-1.5 rounded-full border border-gold/25 bg-gold/10 text-gold text-xs font-semibold uppercase tracking-[0.18em] hover:bg-gold/15 hover:border-gold/40 transition-colors min-w-[44px] min-h-[44px]"
      title="Reset parley and return to the menu"
    >
      Reset
    </button>
  );
}

function BeatLine({ beat }: { beat: ParleyBeat }) {
  const color = beat.type === 'player' ? 'text-green' : beat.type === 'entity' ? 'text-rust' : 'text-sky';
  return (
    <div className="border border-white/10 bg-black/20 px-3 py-2">
      <div className={`text-[10px] uppercase tracking-[0.18em] ${color}`}>
        {beat.speaker ?? beat.type}
      </div>
      <div className="mt-1 text-sm leading-relaxed text-brown/85"><ReactMarkdown>{beat.text}</ReactMarkdown></div>
    </div>
  );
}

function ToolButton({
  tool,
  active,
  disabled,
  onSelect,
}: {
  tool: DialogTool;
  active: boolean;
  disabled: boolean;
  onSelect: (toolId: string) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled || tool.used}
      onClick={() => onSelect(tool.id)}
      className={`flex w-full items-center gap-3 border px-3 py-2 text-left transition-colors ${tool.used ? 'border-white/5 bg-white/[0.02] opacity-45' : active ? 'border-gold/60 bg-gold/15' : 'border-white/10 bg-white/[0.04] hover:border-sky/35 hover:bg-sky/10'} disabled:cursor-not-allowed`}
    >
      <div className="h-9 w-9 shrink-0 overflow-hidden rounded border border-white/10 bg-black/30">
        <img src={tool.icon} alt={tool.name} className="h-full w-full object-cover" />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-brown">{tool.name}</div>
        <div className="text-xs leading-snug text-wood">{tool.description}</div>
      </div>
      <div className="ml-auto text-[10px] uppercase tracking-[0.18em] text-brown/30">
        {tool.used ? 'Used' : active ? 'Active' : 'Ready'}
      </div>
    </button>
  );
}

function Briefing({ state, onBeginRun }: { state: ParleyState; onBeginRun: () => void }) {
  return (
    <div className="min-h-dvh screen-shell flex items-center justify-center p-5" style={{ background: 'linear-gradient(180deg, rgba(6,9,20,0.86), rgba(6,9,20,0.96)), url(/assets/redesign/backgrounds/menu-banner.png) center/cover no-repeat fixed' }}>
      <section className="grid w-full max-w-5xl grid-cols-[minmax(0,1.2fr)_280px] gap-5 max-lg:grid-cols-1">
        <div className="border border-white/10 bg-[#08101f]/90 p-6 shadow-2xl">
          <div className="text-xs uppercase tracking-[0.28em] text-sky">Escape Protocol</div>
          <h1 className="mt-3 text-4xl font-bold uppercase tracking-wide text-brown">Survive three minds</h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-brown/75">
            {state.narration}
          </p>
          <div className="mt-5 grid grid-cols-3 gap-3 max-sm:grid-cols-1">
            <div className="border border-white/10 bg-white/[0.03] p-3">
              <div className="text-[10px] uppercase tracking-[0.2em] text-wood">Rule</div>
              <div className="mt-1 text-sm text-brown">Free typing is the main control.</div>
            </div>
            <div className="border border-white/10 bg-white/[0.03] p-3">
              <div className="text-[10px] uppercase tracking-[0.2em] text-wood">Threat</div>
              <div className="mt-1 text-sm text-brown">Player HP 0 or Pressure {state.maxPressure} ends the run.</div>
            </div>
            <div className="border border-white/10 bg-white/[0.03] p-3">
              <div className="text-[10px] uppercase tracking-[0.2em] text-wood">Goal</div>
              <div className="mt-1 text-sm text-brown">Clear by enemy HP, Trust, or Insight.</div>
            </div>
          </div>
          <div className="mt-3 border border-white/10 bg-white/[0.03] p-3 text-sm leading-relaxed text-brown/75">
            Speak naturally. Put physical actions in parentheses, like <span className="text-brown">"(I lower my hands.) I only want to pass."</span>
          </div>
          <button onClick={onBeginRun} className="btn-warm mt-6 px-6 py-3 text-sm uppercase tracking-[0.24em]">
            Enter the first parley
          </button>
        </div>
        <div className="overflow-hidden border border-white/10 bg-black/30 min-h-80">
          {state.hero ? <Portrait src={state.hero.portrait} glyph={state.hero.name.slice(0, 2)} name={state.hero.name} /> : null}
        </div>
      </section>
    </div>
  );
}

function Reward({ state, onChooseReward }: { state: ParleyState; onChooseReward: (rewardId: string) => void }) {
  const nextEncounter = createEncounter(state.encounterIndex - 1);
  return (
    <div className="min-h-dvh screen-shell flex items-center justify-center p-5" style={{ background: 'linear-gradient(180deg, rgba(6,9,20,0.88), rgba(6,9,20,0.96)), url(/assets/redesign/backgrounds/menu-banner.png) center/cover no-repeat fixed' }}>
      <section className="w-full max-w-3xl border border-white/10 bg-[#08101f]/95 p-5 shadow-2xl">
        <div className="text-xs uppercase tracking-[0.28em] text-green">Encounter survived</div>
        <h1 className="mt-2 text-3xl font-bold text-brown">Choose one dialog tool</h1>
        <p className="mt-2 text-sm text-wood">
          The next mind will be less forgiving. Take the tool that changes how you answer under pressure.
        </p>
        <div className="mt-3 border border-sky/20 bg-sky/10 px-3 py-2 text-xs uppercase tracking-[0.18em] text-sky">
          Next: {nextEncounter.name}
        </div>
        <div className="mt-5 grid gap-3">
          {state.rewardOptions.map(option => (
            <button
              key={option.id}
              onClick={() => onChooseReward(option.id)}
              className="flex items-center gap-4 border border-white/10 bg-white/[0.04] p-3 text-left transition-colors hover:border-gold/40 hover:bg-gold/10"
            >
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded border border-white/10 bg-black/30">
                <img src={option.icon} alt={option.name} className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0">
                <div className="text-lg font-semibold text-brown">{option.name}</div>
                <div className="text-sm text-wood">{option.description}</div>
              </div>
              <div className="ml-auto text-xs uppercase tracking-[0.2em] text-gold">Take</div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function EndState({ state, onRestart }: { state: ParleyState; onRestart: () => void }) {
  const victory = state.phase === 'victory';
  const tags = new Set(state.lastOutcomeTags);
  const endingLabel = victory
    ? tags.has('combat') ? 'Dark victory' : state.wounds.length > 0 ? 'Wounded escape' : 'Clean escape'
    : tags.has('hp') ? 'HP depleted' : tags.has('pressure') ? 'Pressure overload' : 'Defeat';
  return (
    <div className="min-h-dvh screen-shell flex items-center justify-center p-5" style={{ background: 'linear-gradient(180deg, rgba(6,9,20,0.9), rgba(6,9,20,0.98)), url(/assets/redesign/backgrounds/menu-banner.png) center/cover no-repeat fixed' }}>
      <section className="w-full max-w-2xl border border-white/10 bg-[#08101f]/95 p-6 text-center shadow-2xl">
        <div className={`text-xs uppercase tracking-[0.28em] ${victory ? 'text-green' : 'text-rust'}`}>
          {endingLabel}
        </div>
        <h1 className="mt-3 text-4xl font-bold uppercase tracking-wide text-brown">
          {victory ? 'The exit opens' : 'The Nexus holds'}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-brown/75">
          {state.narration || (victory
            ? 'You leave without breaking the minds behind you.'
            : 'The conversation collapses into survival static. The next attempt will need a steadier read.')}
        </p>
        <div className="mt-6 grid grid-cols-4 gap-3 max-sm:grid-cols-2">
          <div className="border border-white/10 bg-white/[0.03] p-3">
            <div className="text-2xl font-bold text-brown">{state.stats.encountersSurvived}</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-wood">Survived</div>
          </div>
          <div className="border border-white/10 bg-white/[0.03] p-3">
            <div className="text-2xl font-bold text-brown">{state.stats.cluesFound}</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-wood">Clues</div>
          </div>
          <div className="border border-white/10 bg-white/[0.03] p-3">
            <div className="text-2xl font-bold text-brown">{state.stats.promisesMade}</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-wood">Promises</div>
          </div>
          <div className="border border-white/10 bg-white/[0.03] p-3">
            <div className="text-2xl font-bold text-brown">{state.playerHp}</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-wood">HP Left</div>
          </div>
        </div>
        <button onClick={onRestart} className="btn-warm mt-6 px-6 py-3 text-sm uppercase tracking-[0.24em]">
          Start over
        </button>
      </section>
    </div>
  );
}

function ActionInput({
  suggestions,
  disabled,
  activeToolName,
  onSendMessage,
}: {
  suggestions: string[];
  disabled: boolean;
  activeToolName?: string;
  onSendMessage: (text: string) => void;
}) {
  const [custom, setCustom] = useState('');
  const sendCustom = () => {
    if (!custom.trim() || disabled) return;
    onSendMessage(custom.trim());
    setCustom('');
  };

  return (
    <div className="border-t border-white/10 bg-[#050914]/95 p-3">
      <div className="grid grid-cols-3 gap-2 max-md:grid-cols-1">
        {suggestions.slice(0, 3).map(suggestion => (
          <button
            key={suggestion}
            disabled={disabled}
            onClick={() => onSendMessage(suggestion)}
            className="min-h-12 border border-sky/25 bg-sky/10 px-3 py-2 text-left text-sm text-brown transition-colors hover:bg-sky/15 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {suggestion}
          </button>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <textarea
          value={custom}
          onChange={event => setCustom(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              sendCustom();
            }
          }}
          disabled={disabled}
          rows={2}
          placeholder={disabled ? 'The Nexus is answering...' : activeToolName ? `${activeToolName} active for your next line.` : 'Say anything. Use parentheses for actions.'}
          className="min-h-14 flex-1 resize-none border border-white/10 bg-black/35 px-3 py-2 text-sm text-brown outline-none placeholder:text-brown/30 focus:border-gold/40 disabled:opacity-45"
        />
        <button
          onClick={sendCustom}
          disabled={disabled || !custom.trim()}
          className="btn-warm w-28 text-sm uppercase tracking-[0.18em] disabled:opacity-45"
        >
          Speak
        </button>
      </div>
    </div>
  );
}

function ParleyActive({ state, isResolving, onSendMessage, onRestart, onSetActiveTool, aiDebugTurns = [] }: Pick<ParleyScreenProps, 'state' | 'isResolving' | 'onSendMessage' | 'onRestart' | 'onSetActiveTool' | 'aiDebugTurns'>) {
  const logRef = useRef<HTMLDivElement>(null);
  const [debugOpen, setDebugOpen] = useState(false);
  const encounter = state.encounter;
  const visibleBeats = state.messages.slice(-8);
  const activeTool = state.dialogTools.find(tool => tool.id === state.activeToolId);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [state.messages.length]);

  if (!encounter) return null;

  return (
    <div className="screen-shell flex h-dvh flex-col overflow-hidden" style={{ background: 'linear-gradient(180deg, rgba(6,9,20,0.9), rgba(6,9,20,0.98)), url(/assets/redesign/backgrounds/menu-banner.png) center/cover no-repeat fixed' }}>
      <header className="grid grid-cols-[1fr_220px_1fr] gap-4 border-b border-white/10 bg-[#050914]/90 px-4 py-3 max-lg:grid-cols-1">
        <Meter label="Pressure" value={state.pressure} max={state.maxPressure} tone="danger" note={`defeat at ${state.maxPressure}`} />
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-[0.22em] text-wood">Encounter {state.encounterIndex + 1}/{state.encounterCount}</div>
          <div className="text-lg font-semibold text-brown">{encounter.name}</div>
        </div>
        <div className="flex items-center justify-end gap-2 max-lg:justify-start">
          <button
            type="button"
            onClick={() => setDebugOpen(true)}
            className="min-h-[44px] border border-sky/25 bg-sky/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-sky transition-colors hover:border-sky/45 hover:bg-sky/15"
          >
            AI Debug {aiDebugTurns.length}
          </button>
          <ResetButton onRestart={onRestart} />
          {state.wounds.length === 0 ? (
            <span className="border border-white/10 bg-white/[0.03] px-3 py-2 text-xs uppercase tracking-[0.18em] text-green">No wounds</span>
          ) : state.wounds.map(wound => (
            <span key={wound.id} className="border border-rust/30 bg-rust/10 px-3 py-2 text-xs uppercase tracking-[0.18em] text-rust">
              {wound.name} {wound.severity}
            </span>
          ))}
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_340px] gap-0 max-lg:grid-cols-1">
        <section className="grid min-h-0 grid-rows-[minmax(0,1fr)_220px] border-r border-white/10 max-lg:border-r-0">
          <div className="relative min-h-0 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-sky/10 via-transparent to-black/60" />
            <div className="relative z-10 grid h-full grid-cols-[minmax(260px,35%)_1fr] gap-5 p-5 max-md:grid-cols-1">
              <div className="min-h-0 overflow-hidden border border-white/10 bg-black/35">
                <Portrait src={encounter.portrait} glyph={encounter.fallbackGlyph} name={encounter.name} />
              </div>
          <div className="flex min-h-0 flex-col justify-end">
                <div className="border border-white/10 bg-[#07111f]/90 p-4">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-rust">Physical threat</div>
                  <p className="mt-2 text-lg leading-relaxed text-brown">{encounter.threat}</p>
                  <p className="mt-3 text-sm leading-relaxed text-wood">{encounter.premise}</p>
                  {isResolving ? <div className="mt-3 text-xs uppercase tracking-[0.2em] text-sky animate-pulse">Judging intent...</div> : null}
                </div>
              </div>
            </div>
          </div>
          <div ref={logRef} className="min-h-0 space-y-2 overflow-y-auto border-t border-white/10 bg-[#050914]/80 p-3">
            {visibleBeats.map((beat, index) => <BeatLine key={`${beat.type}-${index}-${beat.text}`} beat={beat} />)}
          </div>
        </section>

        <aside className="min-h-0 overflow-y-auto bg-[#07101e]/95 p-4">
          <div className="grid gap-4">
            <Meter label="Player HP" value={state.playerHp} max={state.playerMaxHp} tone="hp" note="defeat at 0" />
            <Meter label="Enemy HP" value={encounter.enemyHp} max={encounter.enemyMaxHp} tone="enemy" note="clear at 0" />
            <Meter label="Trust" value={encounter.trust} max={TRUST_PASS_THRESHOLD} tone="trust" note={`pass at ${TRUST_PASS_THRESHOLD}`} />
            <Meter label="Insight" value={encounter.insight} max={INSIGHT_PASS_THRESHOLD} tone="insight" note={`pass at ${INSIGHT_PASS_THRESHOLD}`} />

            <section>
              <div className="text-[10px] uppercase tracking-[0.22em] text-wood">Discovered clues</div>
              <div className="mt-2 grid gap-2">
                {encounter.clues.length > 0 ? encounter.clues.map(clue => (
                  <div key={clue} className="border border-sky/20 bg-sky/10 px-3 py-2 text-sm text-brown">{clue}</div>
                )) : (
                  <div className="border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-brown/40">No clues yet.</div>
                )}
              </div>
            </section>

            <section>
              <div className="text-[10px] uppercase tracking-[0.22em] text-wood">Dialog tools</div>
              <div className="mt-2 grid gap-2">
                {state.dialogTools.map(tool => (
                  <ToolButton
                    key={tool.id}
                    tool={tool}
                    active={state.activeToolId === tool.id}
                    disabled={isResolving || state.isResolving}
                    onSelect={onSetActiveTool}
                  />
                ))}
              </div>
            </section>

            {state.error ? (
              <div className="border border-rust/30 bg-rust/10 px-3 py-2 text-sm text-rust">{state.error}</div>
            ) : null}
          </div>
        </aside>

      </main>

      <ActionInput suggestions={state.suggestions} disabled={isResolving || state.isResolving} activeToolName={activeTool?.name} onSendMessage={onSendMessage} />
      <AIDebugSidePanel turns={aiDebugTurns} isOpen={debugOpen} onClose={() => setDebugOpen(false)} />
    </div>
  );
}

export default function ParleyScreen(props: ParleyScreenProps) {
  if (props.state.phase === 'briefing') {
    return <Briefing state={props.state} onBeginRun={props.onBeginRun} />;
  }
  if (props.state.phase === 'reward_pick') {
    return <Reward state={props.state} onChooseReward={props.onChooseReward} />;
  }
  if (props.state.phase === 'victory' || props.state.phase === 'defeat') {
    return <EndState state={props.state} onRestart={props.onRestart} />;
  }
  return <ParleyActive {...props} />;
}
