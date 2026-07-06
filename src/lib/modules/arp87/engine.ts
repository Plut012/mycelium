import { ModuleEngine } from '$lib/engine/Module.js';

/**
 * Arp87Engine — Walrus ARP-87-style multi-algorithm delay.
 *
 * Wet path: in → wetSend → DelayNode → dampen LP → color stage → out tap
 * (level → wetOut) and feedback tap (fbGain → back into the delay). The
 * color stage sits INSIDE the loop, so Analog repeats darken and saturate
 * cumulatively and Lo-Fi repeats degrade further with every pass — free,
 * the topology does it.
 *
 * Color branches (one active per program):
 *  - digital: straight wire
 *  - analog:  mild tanh saturation + fixed 3.5 kHz lowpass (BBD)
 *  - lofi:    bandpass (width = X) + staircase quantizer (bitcrush via
 *             WaveShaper) — "AM radio"
 *  - slap:    straight wire, feedback forced ~0, Ratio maps time directly
 *
 * Tap tempo: tap() measures the interval; Ratio picks the subdivision.
 * Delay-time changes glide (setTargetAtTime) → tape-style pitch swoop.
 * Hold-tap = feedback past unity = self-oscillation swells.
 * Trails toggle: bypass either mutes the delay input (tail rings out) or
 * the wet output (instant cut).
 */

export type DelayProgram = 'digital' | 'analog' | 'lofi' | 'slap';

const RATIOS = [1, 0.75, 0.5, 0.375, 0.25];
export const RATIO_LABELS = ['1/4', 'D8', '1/8', 'D16', '1/16'];
const SLAP_MS = [60, 85, 110, 135, 160];

function tanhCurve(k: number): Float32Array<ArrayBuffer> {
  const n = 1024;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.tanh(k * x);
  }
  return c;
}

function staircaseCurve(steps: number): Float32Array<ArrayBuffer> {
  const n = 1024;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.round(x * steps) / steps;
  }
  return c;
}

export class Arp87Engine extends ModuleEngine {
  private ctx: AudioContext | null = null;
  private input: GainNode | null = null;
  private wetSend: GainNode | null = null;
  private delay: DelayNode | null = null;
  private dampLP: BiquadFilterNode | null = null;
  private colorIn: GainNode | null = null;
  private colorOut: GainNode | null = null;
  private branchDigital: GainNode | null = null;
  private analogShaper: WaveShaperNode | null = null;
  private analogLP: BiquadFilterNode | null = null;
  private branchAnalog: GainNode | null = null;
  private lofiBP: BiquadFilterNode | null = null;
  private lofiCrush: WaveShaperNode | null = null;
  private branchLofi: GainNode | null = null;
  private fbGain: GainNode | null = null;
  private levelGain: GainNode | null = null;
  private wetOut: GainNode | null = null;
  private modOsc: OscillatorNode | null = null;
  private modDepth: GainNode | null = null;
  private output: GainNode | null = null;
  private timeCv: GainNode | null = null;
  private repeatsCv: GainNode | null = null;
  private xCvEntry: GainNode | null = null;
  private xCvMod: GainNode | null = null;
  private xCvWidth: GainNode | null = null;

  private level = 0.5;
  private dampen = 0.5;
  private repeats = 0.4;
  private ratioIdx = 2;
  private x = 0.2;
  private program: DelayProgram = 'digital';
  private trails = true;
  private engaged = true;
  private oscillating = false;

  private baseIntervalMs = 500;
  private lastTapAt = 0;

  create(ctx: AudioContext): void {
    this.ctx = ctx;

    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.wetSend = ctx.createGain();
    this.delay = ctx.createDelay(2);
    this.dampLP = ctx.createBiquadFilter();
    this.dampLP.type = 'lowpass';
    this.dampLP.Q.value = 0.4;
    this.colorIn = ctx.createGain();
    this.colorOut = ctx.createGain();

    this.branchDigital = ctx.createGain();

    this.analogShaper = ctx.createWaveShaper();
    this.analogShaper.curve = tanhCurve(1.5);
    this.analogLP = ctx.createBiquadFilter();
    this.analogLP.type = 'lowpass';
    this.analogLP.frequency.value = 3500;
    this.branchAnalog = ctx.createGain();

    this.lofiBP = ctx.createBiquadFilter();
    this.lofiBP.type = 'bandpass';
    this.lofiBP.frequency.value = 1200;
    this.lofiCrush = ctx.createWaveShaper();
    this.lofiCrush.curve = staircaseCurve(12);
    this.branchLofi = ctx.createGain();

    this.fbGain = ctx.createGain();
    this.levelGain = ctx.createGain();
    this.wetOut = ctx.createGain();

    // Dry through at unity
    this.input.connect(this.output);

    // Wet chain
    this.input.connect(this.wetSend);
    this.wetSend.connect(this.delay);
    this.delay.connect(this.dampLP);
    this.dampLP.connect(this.colorIn);

    this.colorIn.connect(this.branchDigital);
    this.branchDigital.connect(this.colorOut);
    this.colorIn.connect(this.analogShaper);
    this.analogShaper.connect(this.analogLP);
    this.analogLP.connect(this.branchAnalog);
    this.branchAnalog.connect(this.colorOut);
    this.colorIn.connect(this.lofiBP);
    this.lofiBP.connect(this.lofiCrush);
    this.lofiCrush.connect(this.branchLofi);
    this.branchLofi.connect(this.colorOut);

    this.colorOut.connect(this.fbGain);
    this.fbGain.connect(this.delay);
    this.colorOut.connect(this.levelGain);
    this.levelGain.connect(this.wetOut);
    this.wetOut.connect(this.output);

    // Modulation LFO on delay time
    this.modOsc = ctx.createOscillator();
    this.modOsc.type = 'sine';
    this.modOsc.frequency.value = 0.45;
    this.modDepth = ctx.createGain();
    this.modOsc.connect(this.modDepth);
    this.modDepth.connect(this.delay.delayTime);
    this.modOsc.start();

    this.applyProgram();
    this.applyTime();
    this.applyLevel();
    this.applyDampen();
    this.applyRepeats();
    this.applyX();
    this.applyEngaged();

    // CV extensions: time CV bends the delay line (tape swoop), repeats CV
    // pushes feedback (past unity with a hot CV = runaway), X CV drives both
    // mod depth and Lo-Fi width — only the active program's target matters
    this.timeCv = ctx.createGain();
    this.timeCv.gain.value = 0.25; // ±1 CV = ±250 ms
    this.timeCv.connect(this.delay.delayTime);
    this.repeatsCv = ctx.createGain();
    this.repeatsCv.gain.value = 0.5;
    this.repeatsCv.connect(this.fbGain.gain);
    this.xCvEntry = ctx.createGain(); // unity fan-out to both meanings of X
    this.xCvMod = ctx.createGain();
    this.xCvMod.gain.value = 0.004;
    this.xCvWidth = ctx.createGain();
    this.xCvWidth.gain.value = 3;
    this.xCvEntry.connect(this.xCvMod);
    this.xCvMod.connect(this.modDepth.gain);
    this.xCvEntry.connect(this.xCvWidth);
    this.xCvWidth.connect(this.lofiBP.Q);

    this.registerInputNode('audio_in', this.input);
    this.registerInputNode('time_cv', this.timeCv);
    this.registerInputNode('repeats_cv', this.repeatsCv);
    this.registerInputNode('x_cv', this.xCvEntry);
    this.registerOutputNode('audio_out', this.output);
  }

  // ── Tap tempo / oscillation gate (called by the UI) ──────────────────────

  tap(): void {
    const now = performance.now();
    const delta = now - this.lastTapAt;
    this.lastTapAt = now;
    if (delta >= 100 && delta <= 2000) {
      this.baseIntervalMs = delta;
      this.applyTime();
    }
  }

  setOscillate(on: boolean): void {
    this.oscillating = on;
    this.applyRepeats();
  }

  getDelayMs(): number {
    if (this.program === 'slap') return SLAP_MS[this.ratioIdx];
    return Math.min(1000, Math.max(20, this.baseIntervalMs * RATIOS[this.ratioIdx]));
  }

  isOscillating(): boolean {
    return this.oscillating;
  }

  // ── Internal appliers ─────────────────────────────────────────────────────

  private applyTime(): void {
    if (!this.ctx || !this.delay) return;
    // Glide — retiming swoops pitch like a tape machine
    this.delay.delayTime.setTargetAtTime(this.getDelayMs() / 1000, this.ctx.currentTime, 0.03);
  }

  private applyProgram(): void {
    if (!this.branchDigital || !this.branchAnalog || !this.branchLofi) return;
    const p = this.program;
    this.branchDigital.gain.value = p === 'digital' || p === 'slap' ? 1 : 0;
    this.branchAnalog.gain.value = p === 'analog' ? 1 : 0;
    this.branchLofi.gain.value = p === 'lofi' ? 1 : 0;
    this.applyRepeats(); // slap forces feedback ~0
    this.applyX();       // X meaning changes per program
    this.applyTime();    // slap maps ratio to time directly
  }

  private applyLevel(): void {
    if (!this.ctx || !this.levelGain) return;
    this.levelGain.gain.setTargetAtTime(this.level, this.ctx.currentTime, 0.02);
  }

  private applyDampen(): void {
    if (!this.ctx || !this.dampLP) return;
    // CW = brighter: 800 Hz → 8 kHz
    this.dampLP.frequency.setTargetAtTime(800 * Math.pow(10, this.dampen), this.ctx.currentTime, 0.02);
  }

  private applyRepeats(): void {
    if (!this.ctx || !this.fbGain) return;
    let fb: number;
    if (this.oscillating) {
      fb = 1.08; // past unity — runaway swell
    } else if (this.program === 'slap') {
      fb = 0.02; // single slapback
    } else {
      fb = this.repeats * 1.05; // self-oscillation reachable near max
    }
    this.fbGain.gain.setTargetAtTime(fb, this.ctx.currentTime, 0.05);
  }

  private applyX(): void {
    if (!this.ctx || !this.modDepth || !this.lofiBP) return;
    const t = this.ctx.currentTime;
    if (this.program === 'lofi') {
      // X = filter width; modulation off
      this.modDepth.gain.setTargetAtTime(0, t, 0.02);
      this.lofiBP.Q.setTargetAtTime(0.4 + (1 - this.x) * 5, t, 0.02);
    } else {
      // X = modulation depth (up to ±6 ms — chorus-y wobble)
      this.modDepth.gain.setTargetAtTime(this.x * 0.006, t, 0.02);
    }
  }

  private applyEngaged(): void {
    if (!this.ctx || !this.wetSend || !this.wetOut) return;
    const t = this.ctx.currentTime;
    if (this.engaged) {
      this.wetSend.gain.setTargetAtTime(1, t, 0.005);
      this.wetOut.gain.setTargetAtTime(1, t, 0.005);
    } else if (this.trails) {
      // Stop feeding the line; the tail rings out
      this.wetSend.gain.setTargetAtTime(0, t, 0.005);
    } else {
      this.wetSend.gain.setTargetAtTime(0, t, 0.005);
      this.wetOut.gain.setTargetAtTime(0, t, 0.005);
    }
  }

  setParameter(name: string, value: number | string): void {
    switch (name) {
      case 'level':   this.level = value as number;   this.applyLevel();   break;
      case 'dampen':  this.dampen = value as number;  this.applyDampen();  break;
      case 'repeats': this.repeats = value as number; this.applyRepeats(); break;
      case 'ratio':
        this.ratioIdx = Math.min(RATIOS.length - 1, Math.max(0, Math.round(value as number)));
        this.applyTime();
        break;
      case 'x':       this.x = value as number;       this.applyX();       break;
      case 'program':
        this.program = value as DelayProgram;
        this.applyProgram();
        break;
      case 'trails':
        this.trails = (value as number) > 0.5;
        this.applyEngaged();
        break;
      case 'engaged':
        this.engaged = (value as number) > 0.5;
        this.applyEngaged();
        break;
    }
  }

  getAnalyserNode(): AnalyserNode | null {
    return null;
  }

  destroy(): void {
    if (this.modOsc) {
      try { this.modOsc.stop(); } catch { /* already stopped */ }
    }
    for (const n of [
      this.input, this.wetSend, this.delay, this.dampLP, this.colorIn, this.colorOut,
      this.branchDigital, this.analogShaper, this.analogLP, this.branchAnalog,
      this.lofiBP, this.lofiCrush, this.branchLofi, this.fbGain, this.levelGain,
      this.wetOut, this.modOsc, this.modDepth, this.output,
      this.timeCv, this.repeatsCv, this.xCvEntry, this.xCvMod, this.xCvWidth,
    ]) {
      n?.disconnect();
    }
    this.timeCv = this.repeatsCv = this.xCvEntry = this.xCvMod = this.xCvWidth = null;
    this.input = this.wetSend = this.colorIn = this.colorOut = null;
    this.branchDigital = this.branchAnalog = this.branchLofi = null;
    this.fbGain = this.levelGain = this.wetOut = this.modDepth = this.output = null;
    this.delay = null;
    this.dampLP = this.analogLP = this.lofiBP = null;
    this.analogShaper = this.lofiCrush = null;
    this.modOsc = null;
    this.ctx = null;
    this.inputNodes.clear();
    this.outputNodes.clear();
  }
}
