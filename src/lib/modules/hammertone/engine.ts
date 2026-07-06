import { ModuleEngine } from '$lib/engine/Module.js';

/**
 * HammertoneEngine — Fender Hammertone-style digital reverb.
 *
 * Wet path: ConvolverNode with a procedurally generated IR (per-type
 * character below) → tone-switch lowpass → level. Dry passes through at
 * unity always (analog dry-through feel); Level is wet-only.
 *
 * Types:
 *  - hall:  smooth long decay, slight pre-delay bloom
 *  - room:  short, early-reflection cluster, gentle low thump, mid clarity
 *  - plate: bright noise, and a low cut that deepens as Time increases
 *           (the "lows diminish with Time" hardware quirk)
 *
 * Damp = frequency-dependent decay baked into the IR: a one-pole lowpass
 * whose strength grows along the tail, so highs die first (CW = brighter).
 *
 * No trails, like the pedal: bypass cuts the wet path instantly.
 */

type RevType = 'hall' | 'room' | 'plate';

const TYPE_DURATION: Record<RevType, [number, number]> = {
  hall: [0.6, 6],
  room: [0.3, 2.5],
  plate: [0.4, 4],
};

export class HammertoneEngine extends ModuleEngine {
  private ctx: AudioContext | null = null;
  private input: GainNode | null = null;
  private convolver: ConvolverNode | null = null;
  private toneLP: BiquadFilterNode | null = null;
  private levelGain: GainNode | null = null;
  private wetGain: GainNode | null = null;
  private output: GainNode | null = null;
  private levelCv: GainNode | null = null;

  private time = 0.4;
  private damp = 0.5;
  private level = 0.35;
  private revType: RevType = 'hall';
  private toneCut = false;
  private engaged = true;

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  create(ctx: AudioContext): void {
    this.ctx = ctx;

    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.convolver = ctx.createConvolver();

    this.toneLP = ctx.createBiquadFilter();
    this.toneLP.type = 'lowpass';
    this.toneLP.Q.value = 0.5;

    this.levelGain = ctx.createGain();
    this.wetGain = ctx.createGain();
    this.wetGain.gain.value = this.engaged ? 1 : 0;

    // Dry through at unity, always (the amp side of the pedal)
    this.input.connect(this.output);
    // Wet: in → convolver → tone → level → engage → out
    this.input.connect(this.convolver);
    this.convolver.connect(this.toneLP);
    this.toneLP.connect(this.levelGain);
    this.levelGain.connect(this.wetGain);
    this.wetGain.connect(this.output);

    this.applyLevel();
    this.applyToneCut();
    this.regenerateIR();

    // CV extension: level CV sums onto the wet gain (Time CV is omitted —
    // Time regenerates the IR, which can't be modulated continuously)
    this.levelCv = ctx.createGain();
    this.levelCv.gain.value = 0.6;
    this.levelCv.connect(this.levelGain.gain);

    this.registerInputNode('audio_in', this.input);
    this.registerInputNode('level_cv', this.levelCv);
    this.registerOutputNode('audio_out', this.output);
  }

  private applyLevel(): void {
    if (!this.ctx || !this.levelGain) return;
    this.levelGain.gain.setTargetAtTime(this.level * 1.4, this.ctx.currentTime, 0.02);
  }

  private applyToneCut(): void {
    if (!this.toneLP) return;
    this.toneLP.frequency.value = this.toneCut ? 2800 : 12000;
  }

  private scheduleIRRegeneration(): void {
    if (this.debounceTimer !== null) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.regenerateIR();
    }, 120);
  }

  private regenerateIR(): void {
    if (!this.ctx || !this.convolver) return;
    this.convolver.buffer = generateHammertoneIR(this.ctx, this.revType, this.time, this.damp);
  }

  setParameter(name: string, value: number | string): void {
    switch (name) {
      case 'time':
        this.time = value as number;
        this.scheduleIRRegeneration();
        break;
      case 'damp':
        this.damp = value as number;
        this.scheduleIRRegeneration();
        break;
      case 'level':
        this.level = value as number;
        this.applyLevel();
        break;
      case 'type':
        this.revType = value as RevType;
        this.scheduleIRRegeneration();
        break;
      case 'tone':
        this.toneCut = (value as number) > 0.5;
        this.applyToneCut();
        break;
      case 'engaged': {
        this.engaged = (value as number) > 0.5;
        if (this.ctx && this.wetGain) {
          // No trails: the tail cuts on bypass, like the hardware
          this.wetGain.gain.setTargetAtTime(this.engaged ? 1 : 0, this.ctx.currentTime, 0.005);
        }
        break;
      }
    }
  }

  getAnalyserNode(): AnalyserNode | null {
    return null;
  }

  destroy(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    for (const n of [this.input, this.convolver, this.toneLP, this.levelGain, this.wetGain, this.output, this.levelCv]) {
      n?.disconnect();
    }
    this.levelCv = null;
    this.input = this.levelGain = this.wetGain = this.output = null;
    this.convolver = null;
    this.toneLP = null;
    this.ctx = null;
    this.inputNodes.clear();
    this.outputNodes.clear();
  }
}

// ── IR generation ────────────────────────────────────────────────────────────

function generateHammertoneIR(
  ctx: AudioContext,
  type: RevType,
  time: number,
  damp: number,
): AudioBuffer {
  const sr = ctx.sampleRate;
  const [dMin, dMax] = TYPE_DURATION[type];
  const duration = dMin + (dMax - dMin) * time;
  const length = Math.max(1, Math.floor(sr * duration));
  const buffer = ctx.createBuffer(2, length, sr);

  // Damp knob: CW (1) = bright/open tail, CCW (0) = highs die fast
  const dampAmount = 0.85 * (1 - damp);

  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    let lp = 0;       // one-pole state for frequency-dependent decay
    let prevNoise = 0;
    let hpState = 0;  // one-pole highpass state (plate low-cut)

    // Plate: low cut deepens with Time — stays clean on big chords
    const plateHp = type === 'plate' ? 0.02 + 0.12 * time : 0;

    for (let i = 0; i < length; i++) {
      const t = i / sr;
      const norm = t / duration;

      let envelope: number;
      let noise = Math.random() * 2 - 1;

      if (type === 'hall') {
        // Slight bloom: fade in over 25 ms, then smooth exponential decay
        const bloom = Math.min(1, t / 0.025);
        envelope = bloom * Math.exp(-6 * norm);
      } else if (type === 'room') {
        envelope = Math.exp(-8 * norm);
        // Early reflection cluster in the first 45 ms
        if (t < 0.045 && Math.random() < 0.004) noise *= 6;
        // Gentle low thump
        noise += 0.15 * Math.sin(2 * Math.PI * 90 * t) * Math.exp(-20 * t);
      } else {
        // Plate: high-frequency-weighted noise (differentiated) = chime
        const bright = noise - prevNoise * 0.6;
        prevNoise = noise;
        noise = bright * 1.4;
        envelope = Math.exp(-5.5 * norm);
      }

      let sample = noise * envelope;

      // Frequency-dependent decay: lowpass tightens along the tail
      const d = dampAmount * Math.min(1, 0.35 + norm * 1.3);
      lp = sample * (1 - d) + lp * d;
      sample = lp;

      // Plate low cut (one-pole highpass)
      if (plateHp > 0) {
        hpState += plateHp * (sample - hpState);
        sample = sample - hpState;
      }

      data[i] = sample;
    }
  }

  return buffer;
}
