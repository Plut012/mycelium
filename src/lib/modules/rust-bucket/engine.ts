import { ModuleEngine } from '$lib/engine/Module.js';

/**
 * RustBucketEngine — "3 Way" boost + fuzz + octave dirt box.
 *
 * Three cascaded stages (Boost → Fuzz → Octave), each with its own
 * engage crossfade, sharing one master Volume:
 *
 *  - Boost:  ×4 gain + barely-soft clip. Its job is pushing the fuzz.
 *  - Fuzz:   AudioWorklet ("rust-fuzz") — per-sample envelope follower
 *            driving a steep downward expander (velcro gate/sputter) and a
 *            starved-voltage bias that shifts as notes decay. This is the
 *            project's first worklet — custom analog misbehavior that stock
 *            nodes can't express. Fallback: plain hard-clip WaveShaper
 *            (no gate) if the worklet fails to load.
 *  - Octave: WaveShaper with an |x| curve — full-wave rectification IS the
 *            Octavia trick. Highpass clears the rectifier DC. Only reads as
 *            an octave on saturated input, which is the point: the coupling
 *            with upstream drive comes from the math, not special cases.
 */

// ── Worklet: loaded once per AudioContext from an inline Blob ───────────────

const FUZZ_PROCESSOR_SRC = `
class RustFuzzProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.env = 0;
    this.dc = 0;
  }
  process(inputs, outputs) {
    const inp = inputs[0] && inputs[0][0];
    const out = outputs[0] && outputs[0][0];
    if (!out) return true;
    if (!inp) { out.fill(0); return true; }

    const aAtk = 1 - Math.exp(-1 / (sampleRate * 0.002));
    const aRel = 1 - Math.exp(-1 / (sampleRate * 0.06));
    const GATE = 0.012;

    for (let i = 0; i < out.length; i++) {
      const s = inp[i];
      const ax = Math.abs(s);
      this.env += (ax > this.env ? aAtk : aRel) * (ax - this.env);

      // Steep downward expander below the gate point — the velcro sputter
      let g = 1;
      if (this.env < GATE) {
        const r = this.env / GATE;
        g = r * r * r;
      }

      // Starved-voltage bias: clipping goes lopsided as the note dies
      const bias = 0.3 * (1 - Math.min(1, this.env * 10));
      let y = s * 30 + bias;
      y = Math.max(-1, Math.min(1, y));

      // DC blocker (the bias and asymmetry leave offset behind)
      this.dc += 0.002 * (y - this.dc);
      y -= this.dc;

      out[i] = y * g * 0.7;
    }
    return true;
  }
}
registerProcessor('rust-fuzz', RustFuzzProcessor);
`;

const workletLoads = new WeakMap<AudioContext, Promise<void>>();

function loadFuzzWorklet(ctx: AudioContext): Promise<void> {
  let p = workletLoads.get(ctx);
  if (!p) {
    const url = URL.createObjectURL(new Blob([FUZZ_PROCESSOR_SRC], { type: 'application/javascript' }));
    p = ctx.audioWorklet.addModule(url).finally(() => URL.revokeObjectURL(url));
    workletLoads.set(ctx, p);
  }
  return p;
}

// ── Curves ───────────────────────────────────────────────────────────────────

function makeCurve(fn: (x: number) => number): Float32Array<ArrayBuffer> {
  const n = 2048;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = fn(x);
  }
  return c;
}

interface Stage {
  input: GainNode;
  wet: GainNode;
  dry: GainNode;
  out: GainNode;
}

export class RustBucketEngine extends ModuleEngine {
  private ctx: AudioContext | null = null;
  private input: GainNode | null = null;
  private output: GainNode | null = null;
  private volGain: GainNode | null = null;

  private stages: Stage[] = [];
  private boostGain: GainNode | null = null;
  private boostShaper: WaveShaperNode | null = null;
  private fuzzFallback: WaveShaperNode | null = null;
  private fuzzWorklet: AudioWorkletNode | null = null;
  private fuzzEntry: GainNode | null = null;
  private octaveRectifier: WaveShaperNode | null = null;
  private octaveHP: BiquadFilterNode | null = null;
  private octaveMakeup: GainNode | null = null;

  private volume = 0.7;
  private boostOn = true;
  private fuzzOn = false;
  private octaveOn = false;
  private usingWorklet = false;
  private destroyed = false;

  private makeStage(ctx: AudioContext, on: boolean): Stage {
    const input = ctx.createGain();
    const wet = ctx.createGain();
    const dry = ctx.createGain();
    const out = ctx.createGain();
    wet.gain.value = on ? 1 : 0;
    dry.gain.value = on ? 0 : 1;
    input.connect(dry);
    dry.connect(out);
    wet.connect(out);
    return { input, wet, dry, out };
  }

  create(ctx: AudioContext): void {
    this.ctx = ctx;

    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.volGain = ctx.createGain();
    this.volGain.gain.value = this.volume;

    const boost = this.makeStage(ctx, this.boostOn);
    const fuzz = this.makeStage(ctx, this.fuzzOn);
    const octave = this.makeStage(ctx, this.octaveOn);
    this.stages = [boost, fuzz, octave];

    // Boost internals: ×4 into a barely-soft clip
    this.boostGain = ctx.createGain();
    this.boostGain.gain.value = 4;
    this.boostShaper = ctx.createWaveShaper();
    this.boostShaper.oversample = '2x';
    this.boostShaper.curve = makeCurve((x) => Math.tanh(1.1 * x));
    boost.input.connect(this.boostGain);
    this.boostGain.connect(this.boostShaper);
    this.boostShaper.connect(boost.wet);

    // Fuzz internals: fallback hard clip now; worklet swaps in when loaded
    this.fuzzEntry = ctx.createGain();
    fuzz.input.connect(this.fuzzEntry);
    this.fuzzFallback = ctx.createWaveShaper();
    this.fuzzFallback.oversample = '4x';
    this.fuzzFallback.curve = makeCurve((x) => Math.max(-1, Math.min(1, x * 30)) * 0.7);
    this.fuzzEntry.connect(this.fuzzFallback);
    this.fuzzFallback.connect(fuzz.wet);

    loadFuzzWorklet(ctx)
      .then(() => {
        if (this.destroyed || !this.fuzzEntry || !this.fuzzFallback) return;
        this.fuzzWorklet = new AudioWorkletNode(ctx, 'rust-fuzz', {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          outputChannelCount: [1],
        });
        this.fuzzEntry.disconnect(this.fuzzFallback);
        this.fuzzFallback.disconnect();
        this.fuzzEntry.connect(this.fuzzWorklet);
        this.fuzzWorklet.connect(fuzz.wet);
        this.usingWorklet = true;
      })
      .catch((e) => console.warn('rust-fuzz worklet failed to load, using fallback clip:', e));

    // Octave internals: |x| rectifier → DC/flub highpass → makeup
    this.octaveRectifier = ctx.createWaveShaper();
    this.octaveRectifier.oversample = '4x';
    this.octaveRectifier.curve = makeCurve((x) => Math.abs(x));
    this.octaveHP = ctx.createBiquadFilter();
    this.octaveHP.type = 'highpass';
    this.octaveHP.frequency.value = 120;
    this.octaveHP.Q.value = 0.7;
    this.octaveMakeup = ctx.createGain();
    this.octaveMakeup.gain.value = 2;
    octave.input.connect(this.octaveRectifier);
    this.octaveRectifier.connect(this.octaveHP);
    this.octaveHP.connect(this.octaveMakeup);
    this.octaveMakeup.connect(octave.wet);

    // Cascade: in → boost → fuzz → octave → volume → out
    this.input.connect(boost.input);
    boost.out.connect(fuzz.input);
    fuzz.out.connect(octave.input);
    octave.out.connect(this.volGain);
    this.volGain.connect(this.output);

    this.registerInputNode('audio_in', this.input);
    this.registerOutputNode('audio_out', this.output);
  }

  private setStage(idx: number, on: boolean): void {
    const stage = this.stages[idx];
    if (!this.ctx || !stage) return;
    const t = this.ctx.currentTime;
    stage.wet.gain.setTargetAtTime(on ? 1 : 0, t, 0.005);
    stage.dry.gain.setTargetAtTime(on ? 0 : 1, t, 0.005);
  }

  setParameter(name: string, value: number | string): void {
    switch (name) {
      case 'volume':
        this.volume = value as number;
        if (this.ctx && this.volGain) {
          this.volGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.02);
        }
        break;
      case 'boost':
        this.boostOn = (value as number) > 0.5;
        this.setStage(0, this.boostOn);
        break;
      case 'fuzz':
        this.fuzzOn = (value as number) > 0.5;
        this.setStage(1, this.fuzzOn);
        break;
      case 'octave':
        this.octaveOn = (value as number) > 0.5;
        this.setStage(2, this.octaveOn);
        break;
    }
  }

  isUsingWorklet(): boolean {
    return this.usingWorklet;
  }

  getAnalyserNode(): AnalyserNode | null {
    return null;
  }

  destroy(): void {
    this.destroyed = true;
    const stageNodes = this.stages.flatMap((s) => [s.input, s.wet, s.dry, s.out]);
    for (const n of [
      this.input, this.output, this.volGain,
      this.boostGain, this.boostShaper, this.fuzzEntry, this.fuzzFallback,
      this.fuzzWorklet, this.octaveRectifier, this.octaveHP, this.octaveMakeup,
      ...stageNodes,
    ]) {
      try { n?.disconnect(); } catch { /* already disconnected */ }
    }
    this.stages = [];
    this.input = this.output = this.volGain = null;
    this.boostGain = this.fuzzEntry = this.octaveMakeup = null;
    this.boostShaper = this.fuzzFallback = this.octaveRectifier = null;
    this.fuzzWorklet = null;
    this.octaveHP = null;
    this.ctx = null;
    this.inputNodes.clear();
    this.outputNodes.clear();
  }
}
