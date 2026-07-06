import { ModuleEngine } from '$lib/engine/Module.js';

/**
 * SqueezerEngine — Ross/Dyna-style two-knob compressor.
 *
 * Wet path: DynamicsCompressor (high ratio, soft knee, fast attack so the
 * pick "pluck" passes through) → makeup gain → gentle high-shelf cut (the
 * Dyna darkening) → level.
 *
 * The single Sustain knob drives three things at once, like the real
 * circuit: threshold down, release faster, makeup gain up. More sustain =
 * more squish + higher noise floor, exactly the hardware trade.
 */
export class SqueezerEngine extends ModuleEngine {
  private ctx: AudioContext | null = null;
  private input: GainNode | null = null;
  private comp: DynamicsCompressorNode | null = null;
  private makeup: GainNode | null = null;
  private darken: BiquadFilterNode | null = null;
  private levelGain: GainNode | null = null;
  private wetGain: GainNode | null = null;
  private dryGain: GainNode | null = null;
  private output: GainNode | null = null;
  private sustainCv: GainNode | null = null;
  private levelCv: GainNode | null = null;

  private sustain = 0.5;
  private level = 0.7;
  private engaged = true;

  create(ctx: AudioContext): void {
    this.ctx = ctx;

    this.input = ctx.createGain();
    this.output = ctx.createGain();

    this.comp = ctx.createDynamicsCompressor();
    this.comp.ratio.value = 10;
    this.comp.knee.value = 12;
    this.comp.attack.value = 0.004;

    this.makeup = ctx.createGain();

    this.darken = ctx.createBiquadFilter();
    this.darken.type = 'highshelf';
    this.darken.frequency.value = 6000;
    this.darken.gain.value = -2;

    this.levelGain = ctx.createGain();

    this.wetGain = ctx.createGain();
    this.dryGain = ctx.createGain();
    this.wetGain.gain.value = this.engaged ? 1 : 0;
    this.dryGain.gain.value = this.engaged ? 0 : 1;

    this.input.connect(this.comp);
    this.comp.connect(this.makeup);
    this.makeup.connect(this.darken);
    this.darken.connect(this.levelGain);
    this.levelGain.connect(this.wetGain);
    this.wetGain.connect(this.output);
    this.input.connect(this.dryGain);
    this.dryGain.connect(this.output);

    this.applySustain();
    this.applyLevel();

    // CV extensions: +1 CV drives the threshold 12 dB deeper (more squish);
    // level CV sums onto the output gain
    this.sustainCv = ctx.createGain();
    this.sustainCv.gain.value = -12;
    this.sustainCv.connect(this.comp.threshold);
    this.levelCv = ctx.createGain();
    this.levelCv.gain.value = 0.5;
    this.levelCv.connect(this.levelGain.gain);

    this.registerInputNode('audio_in', this.input);
    this.registerInputNode('sustain_cv', this.sustainCv);
    this.registerInputNode('level_cv', this.levelCv);
    this.registerOutputNode('audio_out', this.output);
  }

  private applySustain(): void {
    if (!this.ctx || !this.comp || !this.makeup) return;
    const s = this.sustain;
    const t = this.ctx.currentTime;
    this.comp.threshold.setTargetAtTime(-24 - 21 * s, t, 0.02);   // -24 → -45 dB
    this.comp.release.setTargetAtTime(0.3 - 0.18 * s, t, 0.02);   // 300 → 120 ms
    const makeupDb = 18 * s;                                       // 0 → +18 dB
    this.makeup.gain.setTargetAtTime(Math.pow(10, makeupDb / 20), t, 0.02);
  }

  private applyLevel(): void {
    if (!this.ctx || !this.levelGain) return;
    this.levelGain.gain.setTargetAtTime(this.level, this.ctx.currentTime, 0.02);
  }

  setParameter(name: string, value: number | string): void {
    switch (name) {
      case 'sustain':
        this.sustain = value as number;
        this.applySustain();
        break;
      case 'level':
        this.level = value as number;
        this.applyLevel();
        break;
      case 'engaged': {
        this.engaged = (value as number) > 0.5;
        if (this.ctx && this.wetGain && this.dryGain) {
          const t = this.ctx.currentTime;
          this.wetGain.gain.setTargetAtTime(this.engaged ? 1 : 0, t, 0.005);
          this.dryGain.gain.setTargetAtTime(this.engaged ? 0 : 1, t, 0.005);
        }
        break;
      }
    }
  }

  /** Current gain reduction in dB (negative while compressing) — for the UI meter. */
  getReduction(): number {
    return this.comp?.reduction ?? 0;
  }

  getAnalyserNode(): AnalyserNode | null {
    return null;
  }

  destroy(): void {
    for (const n of [this.input, this.comp, this.makeup, this.darken, this.levelGain, this.wetGain, this.dryGain, this.output, this.sustainCv, this.levelCv]) {
      n?.disconnect();
    }
    this.sustainCv = this.levelCv = null;
    this.input = this.makeup = this.levelGain = null;
    this.wetGain = this.dryGain = this.output = null;
    this.comp = null;
    this.darken = null;
    this.ctx = null;
    this.inputNodes.clear();
    this.outputNodes.clear();
  }
}
