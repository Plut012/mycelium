import { ModuleEngine } from '$lib/engine/Module.js';

/**
 * XFactorEngine — the Tin's personality knob.
 *
 * One continuous control (x) scales every leg of "broken 1970s tape" at once:
 *
 *  - Audio path (AudioWorklet "x-factor-tape"): gentle tanh saturation,
 *    wow/flutter via a modulated fractional delay, tape hiss, and a high-end
 *    rolloff walking 18 kHz → 7 kHz. At x = 0 the wet legs all collapse to
 *    zero — the signal passes with only the worklet's fixed 6 ms tape gap.
 *  - Drift output (control): a ConstantSource random-walked on the main
 *    thread, amplitude scaled by x. Patch into Tin Voice's drift input to
 *    make the oscillators themselves wander — the hardware's "voice
 *    imperfection" leg of the macro.
 *
 * Fallback: if the worklet fails to load, audio passes clean (true bypass)
 * and only the drift output keeps working.
 */

// ── Worklet: loaded once per AudioContext from an inline Blob ───────────────

const TAPE_PROCESSOR_SRC = `
class XFactorTapeProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{ name: 'x', defaultValue: 0.3, minValue: 0, maxValue: 1, automationRate: 'k-rate' }];
  }
  constructor() {
    super();
    this.buf = new Float32Array(16384);
    this.w = 0;
    this.wowPhase = 0;
    this.flutterPhase = 0;
    this.lp = 0;
    this.xs = 0;          // smoothed x — prevents zipper on knob sweeps
    this.noise = 22222;   // LCG state for hiss
  }
  process(inputs, outputs, parameters) {
    const inp = inputs[0] && inputs[0][0];
    const out = outputs[0] && outputs[0][0];
    if (!out) return true;

    this.xs += 0.15 * (parameters.x[0] - this.xs);
    const xs = this.xs;

    // Per-block coefficients
    const base = 0.006 * sampleRate;                 // fixed 6 ms tape gap
    const wowInc = (2 * Math.PI * 0.5) / sampleRate; // slow wobble
    const flutInc = (2 * Math.PI * 6.3) / sampleRate;// fast wobble
    const wowDepth = xs * 0.0025 * sampleRate;
    const flutDepth = xs * 0.00035 * sampleRate;
    const wsat = xs * 0.85;                          // saturation crossfade
    const hiss = xs * xs * 0.004;                    // ~-48 dB at full x
    const fc = 18000 * Math.pow(7000 / 18000, xs);   // rolloff 18k -> 7k
    const a = 1 - Math.exp((-2 * Math.PI * fc) / sampleRate);

    for (let i = 0; i < out.length; i++) {
      this.buf[this.w] = inp ? inp[i] : 0;

      this.wowPhase += wowInc;
      this.flutterPhase += flutInc;
      const mod = wowDepth * Math.sin(this.wowPhase) + flutDepth * Math.sin(this.flutterPhase);

      // Fractional-delay read with linear interpolation
      let rp = this.w - base - mod;
      if (rp < 0) rp += 16384;
      const i0 = rp | 0;
      const frac = rp - i0;
      const s = this.buf[i0 & 16383] * (1 - frac) + this.buf[(i0 + 1) & 16383] * frac;

      // Gentle saturation, dry/wet so x=0 is exact
      let y = (1 - wsat) * s + wsat * Math.tanh(2.5 * s) * 1.1;

      // Tape hiss
      this.noise = (this.noise * 1664525 + 1013904223) >>> 0;
      y += (this.noise / 4294967296 - 0.5) * 2 * hiss;

      // High-end rolloff (one-pole)
      this.lp += a * (y - this.lp);
      out[i] = this.lp;

      this.w = (this.w + 1) & 16383;
    }
    if (this.wowPhase > 2 * Math.PI) this.wowPhase -= 2 * Math.PI;
    if (this.flutterPhase > 2 * Math.PI) this.flutterPhase -= 2 * Math.PI;
    return true;
  }
}
registerProcessor('x-factor-tape', XFactorTapeProcessor);
`;

const workletLoads = new WeakMap<AudioContext, Promise<void>>();

function loadTapeWorklet(ctx: AudioContext): Promise<void> {
  let p = workletLoads.get(ctx);
  if (!p) {
    const url = URL.createObjectURL(new Blob([TAPE_PROCESSOR_SRC], { type: 'application/javascript' }));
    p = ctx.audioWorklet.addModule(url).finally(() => URL.revokeObjectURL(url));
    workletLoads.set(ctx, p);
  }
  return p;
}

export class XFactorEngine extends ModuleEngine {
  private ctx: AudioContext | null = null;
  private input: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private worklet: AudioWorkletNode | null = null;

  private driftSource: ConstantSourceNode | null = null;
  private driftTimer: ReturnType<typeof setTimeout> | null = null;
  private driftTarget = 0;

  private x = 0.3;
  private destroyed = false;

  create(ctx: AudioContext): void {
    this.ctx = ctx;

    this.input = ctx.createGain();
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.4;

    // Fallback wiring first: clean pass-through until the worklet arrives
    this.input.connect(this.analyser);

    loadTapeWorklet(ctx)
      .then(() => {
        if (this.destroyed || !this.input || !this.analyser) return;
        this.worklet = new AudioWorkletNode(ctx, 'x-factor-tape', {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          outputChannelCount: [1],
        });
        const xParam = this.worklet.parameters.get('x');
        if (xParam) xParam.value = this.x;
        this.input.disconnect(this.analyser);
        this.input.connect(this.worklet);
        this.worklet.connect(this.analyser);
      })
      .catch((e) => console.warn('x-factor worklet failed to load, passing clean:', e));

    // Drift: unit-scale control signal, randomly wandering, amplitude = x.
    // Tin Voice scales it to cents on its side.
    this.driftSource = ctx.createConstantSource();
    this.driftSource.offset.value = 0;
    this.driftSource.start();
    this.scheduleDrift();

    this.registerInputNode('audio_in', this.input);
    this.registerOutputNode('audio_out', this.analyser);
    this.registerOutputNode('drift_out', this.driftSource);
  }

  private scheduleDrift(): void {
    if (!this.ctx || !this.driftSource) return;
    const interval = 0.5 + Math.random() * 1.5; // seconds to next wander
    this.driftTarget = (Math.random() * 2 - 1) * this.x;
    this.driftSource.offset.setTargetAtTime(this.driftTarget, this.ctx.currentTime, interval / 3);
    this.driftTimer = setTimeout(() => this.scheduleDrift(), interval * 1000);
  }

  setParameter(name: string, value: number | string): void {
    if (name !== 'x') return;
    this.x = value as number;
    if (this.worklet && this.ctx) {
      this.worklet.parameters.get('x')?.setTargetAtTime(this.x, this.ctx.currentTime, 0.03);
    }
    // Make the knob feel immediate: re-aim the drift walk at the new amplitude
    if (this.driftTimer) clearTimeout(this.driftTimer);
    this.scheduleDrift();
  }

  /** Current drift walk target — for the UI's wandering needle. */
  getDriftTarget(): number {
    return this.driftTarget;
  }

  getAnalyserNode(): AnalyserNode | null {
    return this.analyser;
  }

  destroy(): void {
    this.destroyed = true;
    if (this.driftTimer) { clearTimeout(this.driftTimer); this.driftTimer = null; }
    if (this.driftSource) {
      try { this.driftSource.stop(); } catch { /* already stopped */ }
      this.driftSource.disconnect();
      this.driftSource = null;
    }
    if (this.worklet) { this.worklet.disconnect(); this.worklet = null; }
    if (this.input) { this.input.disconnect(); this.input = null; }
    if (this.analyser) { this.analyser.disconnect(); this.analyser = null; }
    this.ctx = null;
    this.inputNodes.clear();
    this.outputNodes.clear();
  }
}
