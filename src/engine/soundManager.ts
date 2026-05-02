/**
 * Singleton sound manager wrapping Howler.js.
 * Lazy-loads sounds on first play. Handles ambient crossfade,
 * global mute, and autoplay policy unlocking.
 */
import { Howl, Howler } from 'howler'
import {
  generateDiceRoll,
  generateAttackHit,
  generateAttackMiss,
  generateEnemyAppear,
  generateLootPickup,
  generateDoorOpen,
  generateVictory,
  generateDefeat,
  generateAmbient,
} from './soundGenerator'

export type SoundId =
  | 'dice_roll'
  | 'attack_hit'
  | 'attack_miss'
  | 'enemy_appear'
  | 'loot_pickup'
  | 'door_open'
  | 'victory'
  | 'defeat'

export type AmbientId = 'ambient_explore' | 'ambient_combat' | 'ambient_boss'

interface SoundManager {
  play: (id: SoundId) => void
  playAmbient: (id: AmbientId) => void
  stopAmbient: () => void
  setMuted: (muted: boolean) => void
  isMuted: () => boolean
  unlock: () => void
}

// ── Generator registry ──
const soundGenerators: Record<SoundId, () => Promise<Blob>> = {
  dice_roll: generateDiceRoll,
  attack_hit: generateAttackHit,
  attack_miss: generateAttackMiss,
  enemy_appear: generateEnemyAppear,
  loot_pickup: generateLootPickup,
  door_open: generateDoorOpen,
  victory: generateVictory,
  defeat: generateDefeat,
}

const ambientGenerators: Record<AmbientId, () => Promise<Blob>> = {
  ambient_explore: () => generateAmbient(false),
  ambient_combat: () => generateAmbient(true),
  ambient_boss: () => generateAmbient(true), // darker ambient for boss
}

// ── Preload ambient crossfade time ──
const CROSSFADE_MS = 800

// ── Internal state ──
let _muted = false
let _unlocked = false
const soundCache = new Map<string, Howl>()
const loading = new Set<string>()
let currentAmbient: Howl | null = null
let currentAmbientId: AmbientId | null = null

/** Convert Blob to object URL and create a Howl instance. */
async function createHowl(id: string, blobPromise: Promise<Blob>): Promise<Howl> {
  const blob = await blobPromise
  const url = URL.createObjectURL(blob)
  return new Howl({
    src: [url],
    format: ['wav'],
    volume: id.startsWith('ambient') ? 0.3 : 0.7,
    loop: id.startsWith('ambient'),
    onend: () => {
      // Clean up URL after playback for non-looping sounds
      if (!id.startsWith('ambient')) {
        // Keep URL alive for reuse; Howler handles caching
      }
    },
  })
}

/** Get or create a Howl instance for a sound ID. */
async function getSound(id: string, generator: () => Promise<Blob>): Promise<Howl | null> {
  if (soundCache.has(id)) {
    return soundCache.get(id)!
  }
  if (loading.has(id)) {
    // Already loading — wait a tick and try again
    await new Promise((r) => setTimeout(r, 50))
    return soundCache.get(id) ?? null
  }
  loading.add(id)
  try {
    const howl = await createHowl(id, generator())
    soundCache.set(id, howl)
    return howl
  } catch {
    return null
  } finally {
    loading.delete(id)
  }
}

// ── Public API ──

function unlock(): void {
  if (_unlocked) return
  // Howler.js auto-unlocks on first user gesture via its internal handler.
  // We fire a silent dummy sound to trigger the autoplay policy unlock.
  // Create a silent buffer
  try {
    // Howler.js auto-unlocks on first user gesture via its internal handler.
    // We fire a silent dummy sound to trigger the autoplay policy unlock.
    const silent = new Howl({ src: ['data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA='], volume: 0 })
    silent.play()
  } catch {
    // ignore
  }
  _unlocked = true
}

async function play(id: SoundId): Promise<void> {
  if (_muted) return
  const generator = soundGenerators[id]
  if (!generator) return
  const howl = await getSound(id, generator)
  if (howl) {
    howl.play()
  }
}

async function playAmbient(id: AmbientId): Promise<void> {
  if (currentAmbientId === id) return // already playing

  const generator = ambientGenerators[id]
  if (!generator) return

  const newAmbient = await getSound('ambient:' + id, generator)
  if (!newAmbient) return

  // Crossfade: fade out old, fade in new
  if (currentAmbient && currentAmbient.playing()) {
    const old = currentAmbient
    old.fade(old.volume(), 0, CROSSFADE_MS)
    setTimeout(() => old.stop(), CROSSFADE_MS + 50)
  }

  if (!_muted) {
    newAmbient.volume(0)
    newAmbient.play()
    newAmbient.fade(0, 0.3, CROSSFADE_MS)
  } else {
    // If muted, load but don't play
  }

  currentAmbient = newAmbient
  currentAmbientId = id
}

function stopAmbient(): void {
  if (currentAmbient) {
    currentAmbient.fade(currentAmbient.volume(), 0, CROSSFADE_MS)
    setTimeout(() => currentAmbient?.stop(), CROSSFADE_MS + 50)
    currentAmbient = null
    currentAmbientId = null
  }
}

function setMuted(muted: boolean): void {
  _muted = muted
  Howler.mute(muted)
}

function isMuted(): boolean {
  return _muted
}

export const soundManager: SoundManager = {
  play,
  playAmbient,
  stopAmbient,
  setMuted,
  isMuted,
  unlock,
}
