import { ModuleEngine } from '$lib/engine/Module.js';

/**
 * HaloEngine — the Tin's shimmer reverb.
 *
 * A single AudioWorklet: 8-line feedback delay network (Hadamard-mixed,
 * per-line damping lowpass) with a granular octave-up pitch shifter inside
 * the feedback path. Shimmer requires a pitch shifter *in a loop*, which the
 * convolution Reverb structurally can't do — that's why Halo exists.
 *
 * Stability: per-line feedback gains derive from the RT60 formula, the
 * shimmer injection is level-compensated against the direct feedback, and a
 * hard safety clamp in the loop stops any runaway before it reaches the ear.
 *
 * Fallback: if the worklet fails to load, audio passes clean.
 */

const HALO_PROCESSOR_SRC = `
class HaloProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'decay', defaultValue: 6, minValue: 1, maxValue: 20, automationRate: 'k-rate' },
      { name: 'mix', defaultValue: 0.5, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'damping', defaultValue: 0.4, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'shimmer', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'shimmerAmount', defaultValue: 0.5, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
    ];
  }
  constructor() {
    super();
    // Mutually prime delay lengths (samples at 44.1k), scaled to the real rate
    const base = [1327, 1637, 1811, 2203, 2647, 3089, 3581, 4093];
    const scale = sampleRate / 44100;
    this.N = 8;
    this.lens = base.map((n) => Math.round(n * scale));
    this.lines = this.lens.map((n) => new Float32Array(n));
    this.heads = new Array(this.N).fill(0);
    this.damps = new Float32Array(this.N);

    // Octave-up shifter state (in-loop granular, two crossfading taps)
    this.shimWin = Math.round(4096 * scale);
    this.shimBuf = new Float32Array(1 << Math.ceil(Math.log2(this.shimWin * 2)));
    this.shimMask = this.shimBuf.length - 1;
    this.shimW = 0;
    this.shimPhase = 0;
  }
  process(inputs, outputs, parameters) {
    const inp = inputs[0] && inputs[0][0];
    const out = outputs[0] && outputs[0][0];
    if (!out) return true;

    const decay = parameters.decay[0];
    const mix = parameters.mix[0];
    const damping = parameters.damping[0];
    const shimmerOn = parameters.shimmer[0] >= 0.5;
    const shimAmt = shimmerOn ? parameters.shimmerAmount[0] : 0;

    // Per-line RT60 feedback gains. No loop-gain compensation for shimmer —
    // a constant multiplier here compounds per pass and wrecks the decay
    // time; stability comes from the damping lowpass absorbing the
    // octave-climbing shimmer energy, plus the safety clamp.
    const gains = this.lens.map((n) => Math.pow(10, (-3 * (n / sampleRate)) / decay));
    const fc = 1500 + (1 - damping) * 10500;
    const dampA = 1 - Math.exp((-2 * Math.PI * fc) / sampleRate);
    const shimGain = shimAmt * 0.6;
    const W = this.shimWin;

    const v = new Float32Array(this.N);
    for (let i = 0; i < out.length; i++) {
      const dry = inp ? inp[i] : 0;

      // Read line outputs, apply damping lowpass
      let wet = 0;
      for (let k = 0; k < this.N; k++) {
        const s = this.lines[k][this.heads[k]];
        this.damps[k] += dampA * (s - this.damps[k]);
        v[k] = this.damps[k];
        wet += (k & 1 ? -v[k] : v[k]);
      }
      wet *= 0.35;

      // Octave-up shimmer: shift the wet tail, feed it back into the network
      let shim = 0;
      if (shimGain > 0) {
        this.shimBuf[this.shimW] = wet;
        // Two taps whose distance behind the write head shrinks 1 sample per
        // sample -> playback rate 2 -> octave up; triangle crossfade hides
        // the wrap
        this.shimPhase = (this.shimPhase + 1) % W;
        const p2 = (this.shimPhase + (W >> 1)) % W;
        const t1 = 1 - Math.abs((2 * this.shimPhase) / W - 1);
        const t2 = 1 - Math.abs((2 * p2) / W - 1);
        const r1 = this.shimBuf[(this.shimW - (W - this.shimPhase)) & this.shimMask];
        const r2 = this.shimBuf[(this.shimW - (W - p2)) & this.shimMask];
        shim = (r1 * t1 + r2 * t2) * shimGain;
        this.shimW = (this.shimW + 1) & this.shimMask;
      }

      // Hadamard mix (fast butterfly), write back with input + shimmer
      for (let h = 1; h < this.N; h <<= 1) {
        for (let k = 0; k < this.N; k += h << 1) {
          for (let j = k; j < k + h; j++) {
            const a = v[j], b = v[j + h];
            v[j] = a + b;
            v[j + h] = a - b;
          }
        }
      }
      // Shimmer joins at the same per-line scale as the dry send — injecting
      // it unscaled into all 8 lines would multiply its energy by the line
      // count and overwhelm the loop
      const inject = (dry + shim) * 0.25;
      for (let k = 0; k < this.N; k++) {
        // 1/sqrt(8) Hadamard normalization folded into the feedback gain
        let nv = v[k] * 0.35355339 * gains[k] + inject;
        // Safety clamp — inaudible unless something tries to run away
        if (nv > 3) nv = 3; else if (nv < -3) nv = -3;
        this.lines[k][this.heads[k]] = nv;
        this.heads[k] = this.heads[k] + 1 >= this.lens[k] ? 0 : this.heads[k] + 1;
      }

      out[i] = dry * (1 - mix) + wet * mix;
    }
    return true;
  }
}
registerProcessor('tin-halo', HaloProcessor);
`;

const workletLoads = new WeakMap<AudioContext, Promise<void>>();

function loadHaloWorklet(ctx: AudioContext): Promise<void> {
  let p = workletLoads.get(ctx);
  if (!p) {
    const url = URL.createObjectURL(new Blob([HALO_PROCESSOR_SRC], { type: 'application/javascript' }));
    p = ctx.audioWorklet.addModule(url).finally(() => URL.revokeObjectURL(url));
    workletLoads.set(ctx, p);
  }
  return p;
}

export class HaloEngine extends ModuleEngine {
  private ctx: AudioContext | null = null;
  private input: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private worklet: AudioWorkletNode | null = null;

  private params: Record<string, number> = {
    decay: 6,
    mix: 0.5,
    damping: 0.4,
    shimmer: 0,
    shimmer_amount: 0.5,
  };

  private destroyed = false;

  create(ctx: AudioContext): void {
    this.ctx = ctx;

    this.input = ctx.createGain();
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.4;

    // Clean pass-through until the worklet arrives
    this.input.connect(this.analyser);

    loadHaloWorklet(ctx)
      .then(() => {
        if (this.destroyed || !this.input || !this.analyser) return;
        this.worklet = new AudioWorkletNode(ctx, 'tin-halo', {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          outputChannelCount: [1],
        });
        const p = this.worklet.parameters;
        p.get('decay')!.value = this.params.decay;
        p.get('mix')!.value = this.params.mix;
        p.get('damping')!.value = this.params.damping;
        p.get('shimmer')!.value = this.params.shimmer;
        p.get('shimmerAmount')!.value = this.params.shimmer_amount;
        this.input.disconnect(this.analyser);
        this.input.connect(this.worklet);
        this.worklet.connect(this.analyser);
      })
      .catch((e) => console.warn('halo worklet failed to load, passing clean:', e));

    this.registerInputNode('audio_in', this.input);
    this.registerOutputNode('audio_out', this.analyser);
  }

  setParameter(name: string, value: number | string): void {
    if (!(name in this.params)) return;
    const num = typeof value === 'number' ? value : value === 'true' ? 1 : 0;
    this.params[name] = num;
    if (!this.worklet || !this.ctx) return;
    const workletName = name === 'shimmer_amount' ? 'shimmerAmount' : name;
    const param = this.worklet.parameters.get(workletName);
    if (!param) return;
    if (name === 'shimmer') {
      param.setValueAtTime(num, this.ctx.currentTime);
    } else {
      param.setTargetAtTime(num, this.ctx.currentTime, 0.03);
    }
  }

  getAnalyserNode(): AnalyserNode | null {
    return this.analyser;
  }

  destroy(): void {
    this.destroyed = true;
    if (this.worklet) { this.worklet.disconnect(); this.worklet = null; }
    if (this.input) { this.input.disconnect(); this.input = null; }
    if (this.analyser) { this.analyser.disconnect(); this.analyser = null; }
    this.ctx = null;
    this.inputNodes.clear();
    this.outputNodes.clear();
  }
}
