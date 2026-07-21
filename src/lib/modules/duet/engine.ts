import { ModuleEngine } from '$lib/engine/Module.js';
import { midiToFreq, NOTE_NAMES } from '$lib/modules/keyboard/music.js';

/**
 * DuetEngine — two violin-inspired touch strings with a built-in vocal voice.
 *
 * Continuous pitch cannot ride the discrete spore protocol, so the module IS
 * the instrument: finger position flows straight into AudioParams via short
 * exponential ramps (setTargetAtTime, ~15 ms) — connected glissando, no
 * zipper, no note events.
 *
 * Per string: 2 detuned saws → parallel 3-band formant stack (ooh↔ahh vowel
 * morph) → bowed envelope → master. Sideways finger drift is a gentle guitar
 * bend: ≤ ~40 cents of pitch rise (direction-agnostic) plus a subtle vowel
 * opening. Intonation assist blends toward the nearest semitone, weakened by
 * finger velocity so slides and vibrato pass through. Auto-vibrato fades in
 * when a finger holds still.
 */

const PITCH_RANGE_SEMITONES = 24; // 2 octaves along a string
const STRING_INTERVAL = 7;        // strings a fifth apart
const BEND_SEMITONES = 0.4;       // ~40 cents at full sideways drift
const VOWEL_MAX = 0.7;            // bend never fully reaches "ahh" — subtle
const VIBRATO_HZ = 5;
const VIBRATO_MAX_CENTS = 18;
const STILL_MS = 350;             // stillness before auto-vibrato fades in
const MOVE_EPSILON = 0.02;        // semitones — smaller motion counts as "still"
const RAMP = 0.015;               // s — pitch ramp time constant

// Formant tables: frequency (Hz), gain, Q per band
const VOWEL_OOH = { freqs: [350, 800, 2400], gains: [1.0, 0.3, 0.08] };
const VOWEL_AHH = { freqs: [650, 1080, 2650], gains: [1.0, 0.5, 0.15] };
const FORMANT_Q = [9, 11, 12];

interface StringVoice {
  osc1: OscillatorNode;
  osc2: OscillatorNode;
  preGain: GainNode;
  filters: BiquadFilterNode[];
  bandGains: GainNode[];
  envelope: GainNode;
  vibrato: OscillatorNode;
  vibDepth: GainNode;
  active: boolean;
  /** Current position along the string, 0..1 (for the UI preview) */
  pos: number;
  /** Displayed pitch after assist+bend, as MIDI float */
  midi: number;
  lastMoveTime: number;
  lastSemis: number;
}

export class DuetEngine extends ModuleEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private strings: StringVoice[] = [];
  private stillTimer: ReturnType<typeof setInterval> | null = null;

  private root = 2;      // D
  private octave = 3;
  private intonation = 0.5;
  private vibratoAmt = 0.4;
  private level = 0.8;

  create(ctx: AudioContext): void {
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = this.level;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.4;
    this.master.connect(this.analyser);

    this.strings = [this.buildString(ctx), this.buildString(ctx)];

    // Stillness detector: fade auto-vibrato in on held positions, out on motion
    this.stillTimer = setInterval(() => {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const t = performance.now();
      for (const s of this.strings) {
        const target =
          s.active && t - s.lastMoveTime > STILL_MS
            ? this.vibratoAmt * VIBRATO_MAX_CENTS
            : 0;
        s.vibDepth.gain.setTargetAtTime(target, now, target > 0 ? 0.25 : 0.08);
      }
    }, 80);

    this.registerOutputNode('audio_out', this.analyser);
  }

  private buildString(ctx: AudioContext): StringVoice {
    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.detune.value = 4;
    const osc2 = ctx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.detune.value = -4;

    const preGain = ctx.createGain();
    preGain.gain.value = 0.5;
    osc1.connect(preGain);
    osc2.connect(preGain);

    const envelope = ctx.createGain();
    envelope.gain.value = 0;

    const filters: BiquadFilterNode[] = [];
    const bandGains: GainNode[] = [];
    for (let b = 0; b < 3; b++) {
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = VOWEL_OOH.freqs[b];
      f.Q.value = FORMANT_Q[b];
      const g = ctx.createGain();
      g.gain.value = VOWEL_OOH.gains[b];
      preGain.connect(f);
      f.connect(g);
      g.connect(envelope);
      filters.push(f);
      bandGains.push(g);
    }
    envelope.connect(this.master!);

    const vibrato = ctx.createOscillator();
    vibrato.type = 'sine';
    vibrato.frequency.value = VIBRATO_HZ;
    const vibDepth = ctx.createGain();
    vibDepth.gain.value = 0;
    vibrato.connect(vibDepth);
    vibDepth.connect(osc1.detune);
    vibDepth.connect(osc2.detune);

    osc1.start();
    osc2.start();
    vibrato.start();

    return {
      osc1, osc2, preGain, filters, bandGains, envelope, vibrato, vibDepth,
      active: false, pos: 0, midi: 0, lastMoveTime: 0, lastSemis: 0,
    };
  }

  // ── Playing surface API (called by the UI) ───────────────────────────────

  /**
   * @param index string 0 (lower) or 1 (a fifth up)
   * @param pos 0..1 along the string, 1 = highest pitch
   * @param bend 0..1 sideways drift (already direction-folded by the UI)
   */
  stringOn(index: number, pos: number, bend: number): void {
    const s = this.strings[index];
    if (!s || !this.ctx) return;
    s.active = true;
    s.lastSemis = this.rawSemis(index, pos);
    s.lastMoveTime = performance.now();
    this.applyPosition(index, pos, bend, true);
    // Bowed swell, not a pluck
    s.envelope.gain.setTargetAtTime(0.9, this.ctx.currentTime, 0.03);
  }

  stringMove(index: number, pos: number, bend: number): void {
    const s = this.strings[index];
    if (!s || !s.active) return;
    this.applyPosition(index, pos, bend, false);
  }

  stringOff(index: number): void {
    const s = this.strings[index];
    if (!s || !this.ctx) return;
    s.active = false;
    s.envelope.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
  }

  releaseAll(): void {
    for (let i = 0; i < this.strings.length; i++) this.stringOff(i);
  }

  private rawSemis(index: number, pos: number): number {
    return index * STRING_INTERVAL + pos * PITCH_RANGE_SEMITONES;
  }

  private applyPosition(index: number, pos: number, bend: number, isAttack: boolean): void {
    const s = this.strings[index];
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const t = performance.now();

    const raw = this.rawSemis(index, pos);

    // Finger velocity in semitones/ms — fast motion weakens the assist so
    // slides and manual vibrato pass through untouched
    const dt = Math.max(1, t - s.lastMoveTime);
    const speed = Math.abs(raw - s.lastSemis) / dt;
    if (Math.abs(raw - s.lastSemis) > MOVE_EPSILON) s.lastMoveTime = t;
    s.lastSemis = raw;

    const assist = isAttack
      ? this.intonation
      : this.intonation * Math.max(0, 1 - speed / 0.02);
    const nearest = Math.round(raw);
    const assisted = raw + (nearest - raw) * assist;

    // Sideways drift: gentle bend up (direction-agnostic, like a real bend)
    const semis = assisted + bend * BEND_SEMITONES;

    const rootMidi = 12 * (this.octave + 1) + this.root;
    const midi = rootMidi + semis;
    const freq = midiToFreq(midi);
    s.pos = pos;
    s.midi = midi;

    // On attack, land on the pitch immediately — no glide from the last note
    if (isAttack) {
      s.osc1.frequency.setValueAtTime(freq, now);
      s.osc2.frequency.setValueAtTime(freq, now);
    } else {
      s.osc1.frequency.setTargetAtTime(freq, now, RAMP);
      s.osc2.frequency.setTargetAtTime(freq, now, RAMP);
    }

    // Vowel opens subtly with the bend
    const vowel = bend * VOWEL_MAX;
    for (let b = 0; b < 3; b++) {
      const f0 = VOWEL_OOH.freqs[b];
      const f1 = VOWEL_AHH.freqs[b];
      const g0 = VOWEL_OOH.gains[b];
      const g1 = VOWEL_AHH.gains[b];
      s.filters[b].frequency.setTargetAtTime(f0 * Math.pow(f1 / f0, vowel), now, 0.03);
      s.bandGains[b].gain.setTargetAtTime(g0 + (g1 - g0) * vowel, now, 0.03);
    }
  }

  // ── UI state ─────────────────────────────────────────────────────────────

  /** Live string state for panel preview + fullscreen readouts. */
  getStringStates(): { active: boolean; pos: number; noteName: string; cents: number }[] {
    return this.strings.map((s) => {
      const nearest = Math.round(s.midi);
      const pc = ((nearest % 12) + 12) % 12;
      return {
        active: s.active,
        pos: s.pos,
        noteName: `${NOTE_NAMES[pc]}${Math.floor(nearest / 12) - 1}`,
        cents: Math.round((s.midi - nearest) * 100),
      };
    });
  }

  /** Open-string note names for labels, e.g. ["D3", "A3"]. */
  getOpenStrings(): string[] {
    const rootMidi = 12 * (this.octave + 1) + this.root;
    return [0, 1].map((i) => {
      const m = rootMidi + i * STRING_INTERVAL;
      return `${NOTE_NAMES[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`;
    });
  }

  // ── Parameters ───────────────────────────────────────────────────────────

  setParameter(name: string, value: number | string): void {
    const num = value as number;
    switch (name) {
      case 'root': this.root = Math.round(num); break;
      case 'octave': this.octave = Math.round(num); break;
      case 'intonation': this.intonation = num; break;
      case 'vibrato': this.vibratoAmt = num; break;
      case 'level':
        this.level = num;
        if (this.master && this.ctx) {
          this.master.gain.setTargetAtTime(num, this.ctx.currentTime, 0.02);
        }
        break;
    }
  }

  getAnalyserNode(): AnalyserNode | null {
    return this.analyser;
  }

  destroy(): void {
    if (this.stillTimer) { clearInterval(this.stillTimer); this.stillTimer = null; }
    for (const s of this.strings) {
      for (const osc of [s.osc1, s.osc2, s.vibrato]) {
        try { osc.stop(); } catch { /* already stopped */ }
        osc.disconnect();
      }
      s.preGain.disconnect();
      for (const f of s.filters) f.disconnect();
      for (const g of s.bandGains) g.disconnect();
      s.vibDepth.disconnect();
      s.envelope.disconnect();
    }
    this.strings = [];
    if (this.master) { this.master.disconnect(); this.master = null; }
    if (this.analyser) { this.analyser.disconnect(); this.analyser = null; }
    this.ctx = null;
    this.inputNodes.clear();
    this.outputNodes.clear();
  }
}
