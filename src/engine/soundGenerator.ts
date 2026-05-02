/**
 * Procedural sound effect generator using Web Audio API.
 * Each function synthesizes a short sound and returns a Blob (WAV format).
 * The blobs get converted to object URLs for Howler.js to consume.
 */

/** Convert an AudioBuffer to a WAV ArrayBuffer (16-bit PCM, mono). */
function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const bitsPerSample = 16
  const bytesPerSample = bitsPerSample / 8
  const data = buffer.getChannelData(0)
  const dataLength = data.length * bytesPerSample
  const headerLength = 44
  const totalLength = headerLength + dataLength

  const wav = new ArrayBuffer(totalLength)
  const view = new DataView(wav)

  // RIFF header
  writeString(view, 0, 'RIFF')
  view.setUint32(4, totalLength - 8, true)
  writeString(view, 8, 'WAVE')

  // fmt chunk
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true) // chunk size
  view.setUint16(20, 1, true) // PCM format
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true)
  view.setUint16(32, numChannels * bytesPerSample, true)
  view.setUint16(34, bitsPerSample, true)

  // data chunk
  writeString(view, 36, 'data')
  view.setUint32(40, dataLength, true)

  // PCM samples
  let offset = 44
  for (let i = 0; i < data.length; i++) {
    const sample = Math.max(-1, Math.min(1, data[i]))
    const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff
    view.setInt16(offset, intSample, true)
    offset += 2
  }

  return wav
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i))
  }
}

/** Create OfflineAudioContext and render a WAV Blob from the callback. */
async function renderSound(
  duration: number,
  sampleRate: number,
  build: (ctx: OfflineAudioContext) => void,
): Promise<Blob> {
  const ctx = new OfflineAudioContext(1, sampleRate * duration, sampleRate)
  build(ctx)
  const buffer = await ctx.startRendering()
  const wav = audioBufferToWav(buffer)
  return new Blob([wav], { type: 'audio/wav' })
}

// ═══════════════════════════════════════════════════════════
// Sound generators
// ═══════════════════════════════════════════════════════════

/** Short rattle/settle sound (~0.5s) */
export async function generateDiceRoll(): Promise<Blob> {
  return renderSound(0.5, 22050, (ctx) => {
    const now = ctx.currentTime
    // Create a burst of short noise grains to simulate rattling
    for (let i = 0; i < 8; i++) {
      const t = now + i * 0.04
      const len = 0.03 + Math.random() * 0.03
      const bufferSize = Math.floor(ctx.sampleRate * len)
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
      const noiseData = noiseBuffer.getChannelData(0)
      for (let j = 0; j < bufferSize; j++) {
        noiseData[j] = (Math.random() * 2 - 1) * (1 - j / bufferSize)
      }
      const src = ctx.createBufferSource()
      src.buffer = noiseBuffer
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.25 * (1 - i / 10), t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + len)
      const filter = ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.setValueAtTime(800 + Math.random() * 2000, t)
      filter.Q.setValueAtTime(0.5, t)
      src.connect(filter).connect(gain).connect(ctx.destination)
      src.start(t)
      src.stop(t + len)
    }
    // Final "settle" thud
    const settleSrc = ctx.createBufferSource()
    const settleBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.07), ctx.sampleRate)
    const settleData = settleBuf.getChannelData(0)
    for (let j = 0; j < settleData.length; j++) {
      settleData[j] = Math.sin(2 * Math.PI * 120 * j / ctx.sampleRate) * (1 - j / settleData.length)
    }
    settleSrc.buffer = settleBuf
    const settleGain = ctx.createGain()
    settleGain.gain.setValueAtTime(0.4, now + 0.32)
    settleSrc.connect(settleGain).connect(ctx.destination)
    settleSrc.start(now + 0.32)
  })
}

/** Sharp impact (~0.3s) */
export async function generateAttackHit(): Promise<Blob> {
  return renderSound(0.3, 22050, (ctx) => {
    const now = ctx.currentTime
    // Noise burst
    const noiseLen = Math.floor(ctx.sampleRate * 0.1)
    const noiseBuffer = ctx.createBuffer(1, noiseLen, ctx.sampleRate)
    const noiseData = noiseBuffer.getChannelData(0)
    for (let j = 0; j < noiseLen; j++) {
      noiseData[j] = (Math.random() * 2 - 1) * Math.exp(-j / (ctx.sampleRate * 0.015))
    }
    const noiseSrc = ctx.createBufferSource()
    noiseSrc.buffer = noiseBuffer
    const noiseGain = ctx.createGain()
    noiseGain.gain.setValueAtTime(0.5, now)
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1)
    const noiseFilter = ctx.createBiquadFilter()
    noiseFilter.type = 'highpass'
    noiseFilter.frequency.setValueAtTime(2000, now)
    noiseSrc.connect(noiseFilter).connect(noiseGain).connect(ctx.destination)
    noiseSrc.start(now)

    // Low thump
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(80, now)
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.1)
    const oscGain = ctx.createGain()
    oscGain.gain.setValueAtTime(0.6, now)
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2)
    osc.connect(oscGain).connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.2)
  })
}

/** Whoosh (~0.3s) */
export async function generateAttackMiss(): Promise<Blob> {
  return renderSound(0.3, 22050, (ctx) => {
    const now = ctx.currentTime
    const noiseLen = Math.floor(ctx.sampleRate * 0.25)
    const noiseBuffer = ctx.createBuffer(1, noiseLen, ctx.sampleRate)
    const noiseData = noiseBuffer.getChannelData(0)
    for (let j = 0; j < noiseLen; j++) {
      noiseData[j] = (Math.random() * 2 - 1)
    }
    const src = ctx.createBufferSource()
    src.buffer = noiseBuffer
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(300, now)
    filter.frequency.exponentialRampToValueAtTime(4000, now + 0.25)
    filter.Q.setValueAtTime(2, now)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.3, now)
    gain.gain.setValueAtTime(0.3, now + 0.1)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)
    src.connect(filter).connect(gain).connect(ctx.destination)
    src.start(now)
    src.stop(now + 0.25)
  })
}

/** Rising tone (~0.5s) */
export async function generateEnemyAppear(): Promise<Blob> {
  return renderSound(0.5, 22050, (ctx) => {
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(150, now)
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.4)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.15, now)
    gain.gain.linearRampToValueAtTime(0.25, now + 0.3)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5)
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(400, now)
    filter.frequency.exponentialRampToValueAtTime(2000, now + 0.5)
    filter.Q.setValueAtTime(2, now)
    osc.connect(filter).connect(gain).connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.5)
  })
}

/** Sparkle/chime (~0.4s) */
export async function generateLootPickup(): Promise<Blob> {
  return renderSound(0.4, 22050, (ctx) => {
    const now = ctx.currentTime
    // Two chime tones
    const freqs = [880, 1320]
    for (let i = 0; i < freqs.length; i++) {
      const t = now + i * 0.12
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freqs[i], t)
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.3, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
      // Add some harmonics
      const osc2 = ctx.createOscillator()
      osc2.type = 'sine'
      osc2.frequency.setValueAtTime(freqs[i] * 2, t)
      const gain2 = ctx.createGain()
      gain2.gain.setValueAtTime(0.1, t)
      gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.2)
      osc.connect(gain).connect(ctx.destination)
      osc2.connect(gain2).connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.3)
      osc2.start(t)
      osc2.stop(t + 0.2)
    }
  })
}

/** Sliding/opening sound (~0.4s) */
export async function generateDoorOpen(): Promise<Blob> {
  return renderSound(0.4, 22050, (ctx) => {
    const now = ctx.currentTime
    // Low rumble with rising filter
    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(60, now)
    osc.frequency.linearRampToValueAtTime(80, now + 0.4)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.3, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4)
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(200, now)
    filter.frequency.exponentialRampToValueAtTime(800, now + 0.4)
    filter.Q.setValueAtTime(1, now)
    osc.connect(filter).connect(gain).connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.4)
  })
}

/** Triumphant short melody (~1s) */
export async function generateVictory(): Promise<Blob> {
  return renderSound(1.0, 22050, (ctx) => {
    const now = ctx.currentTime
    // Ascending major triad arpeggio: C5, E5, G5, C6
    const notes = [523.25, 659.25, 783.99, 1046.5]
    for (let i = 0; i < notes.length; i++) {
      const t = now + i * 0.18
      const dur = 0.35
      const osc = ctx.createOscillator()
      osc.type = 'square'
      osc.frequency.setValueAtTime(notes[i], t)
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.15, t)
      gain.gain.setValueAtTime(0.15, t + 0.1)
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur)
      // Add sub octave for richness
      const osc2 = ctx.createOscillator()
      osc2.type = 'triangle'
      osc2.frequency.setValueAtTime(notes[i] / 2, t)
      const gain2 = ctx.createGain()
      gain2.gain.setValueAtTime(0.08, t)
      gain2.gain.exponentialRampToValueAtTime(0.001, t + dur)
      osc.connect(gain).connect(ctx.destination)
      osc2.connect(gain2).connect(ctx.destination)
      osc.start(t)
      osc.stop(t + dur)
      osc2.start(t)
      osc2.stop(t + dur)
    }
  })
}

/** Sad descending tone (~1s) */
export async function generateDefeat(): Promise<Blob> {
  return renderSound(1.0, 22050, (ctx) => {
    const now = ctx.currentTime
    // Descending minor: E4, D4, C4, A3
    const notes = [329.63, 293.66, 261.63, 220.0]
    for (let i = 0; i < notes.length; i++) {
      const t = now + i * 0.2
      const dur = 0.4
      const osc = ctx.createOscillator()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(notes[i], t)
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.15, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur)
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(800, t)
      filter.frequency.exponentialRampToValueAtTime(200, t + dur)
      osc.connect(filter).connect(gain).connect(ctx.destination)
      osc.start(t)
      osc.stop(t + dur)
    }
  })
}

/** Low drone loop (~3s) */
export async function generateAmbient(dark: boolean): Promise<Blob> {
  return renderSound(3.0, 22050, (ctx) => {
    const now = ctx.currentTime
    // Multiple detuned oscillators for a rich drone
    const baseFreq = dark ? 55 : 110
    const oscCount = 3
    for (let i = 0; i < oscCount; i++) {
      const osc = ctx.createOscillator()
      osc.type = i === 0 ? 'sine' : i === 1 ? 'triangle' : 'sawtooth'
      const detune = (i - 1) * 3 // slight detuning
      osc.frequency.setValueAtTime(baseFreq + detune, now)
      // Slow modulation
      osc.frequency.setValueAtTime(baseFreq + detune + 1, now + 1.5)
      osc.frequency.setValueAtTime(baseFreq + detune - 1, now + 3)
      const gain = ctx.createGain()
      const vol = dark ? 0.04 : 0.06
      gain.gain.setValueAtTime(vol * (1 - i * 0.3), now)
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(dark ? 200 : 300, now)
      filter.Q.setValueAtTime(0.5, now)
      osc.connect(filter).connect(gain).connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 3)
    }
    // Add subtle noise for texture
    const noiseLen = Math.floor(ctx.sampleRate * 3)
    const noiseBuffer = ctx.createBuffer(1, noiseLen, ctx.sampleRate)
    const noiseData = noiseBuffer.getChannelData(0)
    for (let j = 0; j < noiseLen; j++) {
      noiseData[j] = (Math.random() * 2 - 1) * 0.02
    }
    const noiseSrc = ctx.createBufferSource()
    noiseSrc.buffer = noiseBuffer
    const noiseFilter = ctx.createBiquadFilter()
    noiseFilter.type = 'lowpass'
    noiseFilter.frequency.setValueAtTime(dark ? 150 : 250, now)
    noiseFilter.Q.setValueAtTime(0.3, now)
    noiseSrc.connect(noiseFilter).connect(ctx.destination)
    noiseSrc.start(now)
    noiseSrc.stop(now + 3)
  })
}
