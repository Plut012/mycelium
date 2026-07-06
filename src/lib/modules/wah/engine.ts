import { ModuleEngine } from '$lib/engine/Module.js';

/**
 * WahEngine — parked resonant filter (Cry Baby-style inductor wah).
 *
 * Wet path: peaking filter (+14 dB, Q≈5) for the resonant bump, followed by
 * a gentle lowpass tracking ~2.5× the peak (the inductor "skirt" — keeps the
 * peak vocal instead of a textbook bandpass).
 *
 * Bypass pattern (shared by all pedal modules): parallel dry/wet GainNodes
 * crossfaded with a short ramp — true bypass without clicks.
 *
 * position_cv input is a scaling GainNode (×900 Hz) into the peak frequency,
 * so a ±depth LFO or envelope sweeps the treadle meaningfully.
 */

const F_LO = 400;
const F_HI = 2200;

export function positionToFreq(position: number): number {
  return F_LO * Math.pow(F_HI / F_LO, Math.min(1, Math.max(0, position)));
}

export class WahEngine extends ModuleEngine {
  private ctx: AudioContext | null = null;
  private input: GainNode | null = null;
  private peak: BiquadFilterNode | null = null;
  private skirt: BiquadFilterNode | null = null;
  private cvScale: GainNode | null = null;
  private wetGain: GainNode | null = null;
  private dryGain: GainNode | null = null;
  private output: GainNode | null = null;

  private position = 0.45; // parked at the vocal formant spot
  private engaged = true;

  create(ctx: AudioContext): void {
    this.ctx = ctx;

    this.input = ctx.createGain();
    this.output = ctx.createGain();

    this.peak = ctx.createBiquadFilter();
    this.peak.type = 'peaking';
    this.peak.gain.value = 14;
    this.peak.Q.value = 5;

    this.skirt = ctx.createBiquadFilter();
    this.skirt.type = 'lowpass';
    this.skirt.Q.value = 0.7;

    this.wetGain = ctx.createGain();
    this.dryGain = ctx.createGain();
    this.wetGain.gain.value = this.engaged ? 1 : 0;
    this.dryGain.gain.value = this.engaged ? 0 : 1;

    // Wet: in → peak → skirt → wet → out; Dry: in → dry → out
    this.input.connect(this.peak);
    this.peak.connect(this.skirt);
    this.skirt.connect(this.wetGain);
    this.wetGain.connect(this.output);
    this.input.connect(this.dryGain);
    this.dryGain.connect(this.output);

    // CV: ±1 in → ±900 Hz onto the peak center
    this.cvScale = ctx.createGain();
    this.cvScale.gain.value = 900;
    this.cvScale.connect(this.peak.frequency);

    this.applyPosition();

    this.registerInputNode('audio_in', this.input);
    this.registerInputNode('position_cv', this.cvScale);
    this.registerOutputNode('audio_out', this.output);
  }

  private applyPosition(): void {
    if (!this.ctx || !this.peak || !this.skirt) return;
    const f = positionToFreq(this.position);
    const t = this.ctx.currentTime;
    // Glide — hand motion should sound like a foot, not a zipper
    this.peak.frequency.setTargetAtTime(f, t, 0.025);
    this.skirt.frequency.setTargetAtTime(Math.min(f * 2.5, 11000), t, 0.025);
  }

  setParameter(name: string, value: number | string): void {
    switch (name) {
      case 'position':
        this.position = value as number;
        this.applyPosition();
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

  getPosition(): number {
    return this.position;
  }

  getAnalyserNode(): AnalyserNode | null {
    return null;
  }

  destroy(): void {
    for (const n of [this.input, this.peak, this.skirt, this.cvScale, this.wetGain, this.dryGain, this.output]) {
      n?.disconnect();
    }
    this.input = this.peak = this.skirt = null;
    this.cvScale = this.wetGain = this.dryGain = this.output = null;
    this.ctx = null;
    this.inputNodes.clear();
    this.outputNodes.clear();
  }
}
