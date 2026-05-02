import { useState, useEffect, useCallback, type CSSProperties } from 'react'
import ParleyScreen from './components/ParleyScreen'
import type { ParleyCharStub } from './engine/parley'
import { useParleyState } from './hooks/useParleyState'
import { useParleyAI } from './hooks/useParleyAI'
import type { AIDebugTurn } from './hooks/useParleyAI'

const CHARS_URL = '/assets/chars.json'

type Char = {
  id: string
  name: string
  race: string
  class: string
  hp: number
  ac: number
  stats: Record<string, number>
  skills: string[]
  backstory: string
  special: string
  portrait: string
}

export function App() {
  const [chars, setChars] = useState<Char[]>([])
  const [selectedCharId, setSelectedCharId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [aiDebugTurns, setAiDebugTurns] = useState<AIDebugTurn[]>([])

  const game = useParleyState()
  const ai = useParleyAI()

  const selectedChar = chars.find(c => c.id === selectedCharId) ?? null

  useEffect(() => {
    fetch(CHARS_URL)
      .then(r => r.json())
      .then((c: Char[]) => {
        setChars(c)
        setSelectedCharId(prev => prev || c[0]?.id || '')
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleStartSession = () => {
    if (!selectedCharId) return
    const char = chars.find(c => c.id === selectedCharId)
    if (!char) return

    const seed = `session-${char.id}-${Date.now()}`
    const charData: ParleyCharStub = {
      id: char.id,
      name: char.name,
      race: char.race,
      class: char.class,
      hp: char.hp,
      ac: char.ac,
      stats: char.stats,
      skills: char.skills ?? [],
      portrait: char.portrait,
    }
    game.startSession(charData, seed)
  }

  const handleSendMessage = useCallback(async (text: string) => {
    if (game.state.isResolving) return
    game.addPlayerMessage(text)
    game.setResolving(true)

    const response = await ai.sendAction(text, game.state)
    if (response) {
      const debugTurn = response.debug
      if (debugTurn) setAiDebugTurns(prev => [...prev, debugTurn])
      game.applyUpdates(response.updates, response.narration, response.suggestions, response.beats)
    } else {
      game.setResolving(false)
      if (ai.error) game.setError(ai.error)
    }
  }, [game, ai])

  const handleRestart = () => {
    game.resetSession()
    setSelectedCharId('')
    setAiDebugTurns([])
  }

  if (loading) {
    return (
      <div
        className="flex items-center justify-center screen-shell"
        style={{
          minHeight: '100dvh',
          background: 'radial-gradient(circle at top, rgba(104, 80, 192, 0.18), transparent 42%), linear-gradient(180deg, #060914 0%, #0c1222 55%, #111827 100%)',
        }}
      >
        <div className="text-brown/70 text-sm uppercase tracking-[0.22em]">Loading nexus data...</div>
      </div>
    )
  }

  if (game.state.phase === 'hero_select') {
    return (
      <div
        className="screen-shell hero-select-shell"
        style={{
          background: 'linear-gradient(180deg, rgba(6,9,20,0.94), rgba(8,12,24,0.95)), url(/assets/redesign/backgrounds/menu-banner.png) center/cover no-repeat fixed',
        }}
      >
        <div className="hero-select-layout relative z-10">
          <section className="hero-preview" style={{ '--preview-bg': 'url(/assets/redesign/backgrounds/menu-banner.png)' } as CSSProperties}>
            <div className="hero-preview__content">
              <div className="hero-preview__title">
                <div className="hero-preview__kicker">Experimental — Hermes Agent Hackathon</div>
                <h1 className="hero-preview__headline">
                  Nexuses &amp; Neurodrakes
                </h1>
                <p className="hero-preview__subhead">
                  A dialog survival game where <strong>Hermes Agent</strong> powers the AI guardians. Talk your way out — every encounter is a live parley with physical stakes.
                </p>
              </div>

              <div className="hero-preview__selected">
                <div className="hero-preview__portrait">
                  <img
                    src={selectedChar?.portrait ?? chars[0]?.portrait ?? '/assets/redesign/backgrounds/menu-banner.png'}
                    alt={selectedChar?.name ?? 'Selected hero preview'}
                    className="w-full h-full object-cover object-top"
                  />
                </div>
                <div className="hero-preview__meta">
                  <div className="text-wood text-xs uppercase tracking-[0.22em]">Chosen champion</div>
                  <div className="text-brown text-2xl font-bold">
                    {selectedChar?.name ?? 'Choose a hero'}
                  </div>
                  <div className="text-brown/70 text-sm">
                    {selectedChar ? `${selectedChar.race} • ${selectedChar.class}` : 'Select a hero below.'}
                  </div>
                  {selectedChar && (
                    <>
                      <div className="hero-preview__meta-row">
                        <span className="px-3 py-1 border border-white/10 bg-white/5 text-sky text-xs uppercase tracking-wide">HP {selectedChar.hp}</span>
                        <span className="px-3 py-1 border border-white/10 bg-white/5 text-gold text-xs uppercase tracking-wide">AC {selectedChar.ac}</span>
                        <span className="px-3 py-1 border border-white/10 bg-white/5 text-green text-xs uppercase tracking-wide">Ready</span>
                      </div>
                      {selectedChar.skills?.length > 0 && (
                        <div className="hero-preview__meta-row">
                          {selectedChar.skills.map(s => (
                            <span key={s} className="px-2 py-0.5 border border-purple/20 bg-purple/5 text-purple text-xs uppercase tracking-wide">{s}</span>
                          ))}
                        </div>
                      )}
                      <p className="text-brown/60 text-sm leading-relaxed max-w-xl">{selectedChar.backstory}</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </section>

          <aside className="hero-roster">
            <div className="hero-roster__title">
              <h2 className="text-lg text-brown font-bold uppercase tracking-[0.18em]">Choose Your Hero</h2>
              <p className="text-xs text-wood leading-relaxed max-w-md">
                Pick one survivor. Every encounter is a parley with physical stakes; your words and parenthesized actions drive the turn.
              </p>
            </div>

            <div className="hero-roster__list" role="region" aria-label="Hero roster" tabIndex={0}>
              {chars.map(c => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCharId(c.id)}
                  className={`hero-row text-left ${selectedCharId === c.id ? 'hero-row--selected' : ''}`}
                >
                  <div className="hero-row__portrait">
                    <img src={c.portrait} alt={c.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <div className="hero-row__name">{c.name}</div>
                    <div className="hero-row__sub">{c.race} • {c.class}</div>
                    <div className="hero-row__chips">
                      <span className="px-2 py-0.5 border border-white/10 bg-white/5 text-sky text-[10px] uppercase tracking-wide">HP {c.hp}</span>
                      <span className="px-2 py-0.5 border border-white/10 bg-white/5 text-gold text-[10px] uppercase tracking-wide">AC {c.ac}</span>
                    </div>
                    <div className="hero-row__special">{c.special}</div>
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.24em] text-wood">
                    {selectedCharId === c.id ? 'Selected' : 'Pick'}
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={handleStartSession}
              disabled={!selectedCharId}
              className={`btn-warm w-full py-3.5 text-sm uppercase tracking-[0.24em] ${selectedCharId ? '' : 'opacity-50'}`}
            >
              Start Escape Protocol
            </button>
          </aside>
        </div>
      </div>
    )
  }

  return (
    <ParleyScreen
      state={game.state}
      isResolving={game.state.isResolving || ai.isResolving}
      onSendMessage={handleSendMessage}
      onRestart={handleRestart}
      onBeginRun={game.beginRun}
      onChooseReward={game.chooseReward}
      onSetActiveTool={game.setActiveTool}
      aiDebugTurns={aiDebugTurns}
    />
  )
}

export default App
