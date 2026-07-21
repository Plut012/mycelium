import { ModuleEngine } from '$lib/engine/Module.js';

/**
 * FreezeEngine — one infinite-sustain buffer; the Tin has three of these.
 *
 * The worklet keeps a 2 s rolling capture of the input. Engaging freeze
 * snapshots that window and loops it as overlapping Hann-windowed grains at
 * randomized offsets — a static *texture*, not an audible loop. Dry input
 * always passes; the bed is added on top, so chained Freezes stack beds
 * naturally. Disengaging fades the bed out over ~0.5 s.
 *
 * Audio-domain by design: freeze a chord, turn the Compass, freeze another —
 * beds layer across keys.
 *
 * Fallback: if the worklet fails to load, audio passes clean and the toggle
 * does nothing.
 */

const FREEZE_PROCESSOR_SRC = `
class FreezeProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'freeze', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'bedLevel', defaultValue: 0.7, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
    ];
  }
  constructor() {
    super();
    this.capLen = Math.floor(sampleRate * 2);
    this.ring = new Float32Array(this.capLen);
    this.w = 0;
    this.frozen = null;      // snapshot taken at engage
    this.wasFrozen = false;
    this.bedEnv = 0;         // smoothed bed gain
    this.grains = [];
    this.rand = 123456789;   // LCG — deterministic, cheap
  }
  nextRand() {
    this.rand = (this.rand * 1664525 + 1013904223) >>> 0;
    return this.rand / 4294967296;
  }
  spawnGrain() {
    const dur = Math.floor((0.25 + this.nextRand() * 0.2) * sampleRate);
    const start = Math.floor(this.nextRand() * (this.capLen - dur));
    return { pos: start, age: 0, dur };
  }
  process(inputs, outputs, parameters) {
    const inp = inputs[0] && inputs[0][0];
    const out = outputs[0] && outputs[0][0];
    if (!out) return true;

    const engaged = parameters.freeze[0] >= 0.5;
    if (engaged && !this.wasFrozen) {
      // Snapshot the capture window, unrolled so index 0 = oldest sample
      const snap = new Float32Array(this.capLen);
      snap.set(this.ring.subarray(this.w));
      snap.set(this.ring.subarray(0, this.w), this.capLen - this.w);
      this.frozen = snap;
      this.grains = [this.spawnGrain(), this.spawnGrain(), this.spawnGrain()];
      // Stagger ages so the three grains don't breathe in unison
      this.grains[1].age = Math.floor(this.grains[1].dur / 3);
      this.grains[2].age = Math.floor((this.grains[2].dur * 2) / 3);
    }
    this.wasFrozen = engaged;

    const bedTarget = engaged ? parameters.bedLevel[0] : 0;
    const alpha = 1 - Math.exp(-1 / (sampleRate * 0.15)); // ~0.5 s fade
    const hasBed = this.frozen && (engaged || this.bedEnv > 0.0005);

    for (let i = 0; i < out.length; i++) {
      const dry = inp ? inp[i] : 0;
      this.ring[this.w] = dry;
      this.w = this.w + 1 >= this.capLen ? 0 : this.w + 1;

      this.bedEnv += alpha * (bedTarget - this.bedEnv);

      let bed = 0;
      if (hasBed) {
        for (const g of this.grains) {
          const win = Math.sin((Math.PI * g.age) / g.dur);
          bed += this.frozen[g.pos + g.age] * win * win;
          g.age++;
        }
        bed *= 0.75; // overlap compensation for 3 Hann grains
        for (let k = 0; k < this.grains.length; k++) {
          if (this.grains[k].age >= this.grains[k].dur) this.grains[k] = this.spawnGrain();
        }
      }

      out[i] = dry + bed * this.bedEnv;
    }
    return true;
  }
}
registerProcessor('tin-freeze', FreezeProcessor);
`;

const workletLoads = new WeakMap<AudioContext, Promise<void>>();

function loadFreezeWorklet(ctx: AudioContext): Promise<void> {
  let p = workletLoads.get(ctx);
  if (!p) {
    const url = URL.createObjectURL(new Blob([FREEZE_PROCESSOR_SRC], { type: 'application/javascript' }));
    p = ctx.audioWorklet.addModule(url).finally(() => URL.revokeObjectURL(url));
    workletLoads.set(ctx, p);
  }
  return p;
}

export class FreezeEngine extends ModuleEngine {
  private ctx: AudioContext | null = null;
  private input: GainNode | null = null;
  private output: GainNode | null = null;
  private worklet: AudioWorkletNode | null = null;

  private frozen = false;
  private bedLevel = 0.7;
  private destroyed = false;

  create(ctx: AudioContext): void {
    this.ctx = ctx;

    this.input = ctx.createGain();
    this.output = ctx.createGain();

    // Clean pass-through until the worklet arrives
    this.input.connect(this.output);

    loadFreezeWorklet(ctx)
      .then(() => {
        if (this.destroyed || !this.input || !this.output) return;
        this.worklet = new AudioWorkletNode(ctx, 'tin-freeze', {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          outputChannelCount: [1],
        });
        const p = this.worklet.parameters;
        p.get('freeze')!.value = this.frozen ? 1 : 0;
        p.get('bedLevel')!.value = this.bedLevel;
        this.input.disconnect(this.output);
        this.input.connect(this.worklet);
        this.worklet.connect(this.output);
      })
      .catch((e) => console.warn('freeze worklet failed to load, passing clean:', e));

    this.registerInputNode('audio_in', this.input);
    this.registerOutputNode('audio_out', this.output);
  }

  setParameter(name: string, value: number | string): void {
    switch (name) {
      case 'freeze':
        this.frozen = Boolean(typeof value === 'number' ? value : value === 'true');
        if (this.worklet && this.ctx) {
          // Snap, don't ramp — the processor edge-detects the transition
          this.worklet.parameters.get('freeze')?.setValueAtTime(this.frozen ? 1 : 0, this.ctx.currentTime);
        }
        break;
      case 'bed_level':
        this.bedLevel = value as number;
        if (this.worklet && this.ctx) {
          this.worklet.parameters.get('bedLevel')?.setTargetAtTime(this.bedLevel, this.ctx.currentTime, 0.03);
        }
        break;
    }
  }

  isFrozen(): boolean {
    return this.frozen;
  }

  getAnalyserNode(): AnalyserNode | null {
    return null;
  }

  destroy(): void {
    this.destroyed = true;
    if (this.worklet) { this.worklet.disconnect(); this.worklet = null; }
    if (this.input) { this.input.disconnect(); this.input = null; }
    if (this.output) { this.output.disconnect(); this.output = null; }
    this.ctx = null;
    this.inputNodes.clear();
    this.outputNodes.clear();
  }
}
