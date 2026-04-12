import { ModuleEngine } from '$lib/engine/Module.js';

export class OutputEngine extends ModuleEngine {
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  // Default low — protect ears
  private currentVolume = 0.3;

  create(ctx: AudioContext): void {
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = this.currentVolume;

    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.3;

    // Signal path: input -> masterGain -> analyser -> destination
    // The analyser lets us visualize what is actually going to speakers.
    this.masterGain.connect(this.analyser);
    this.analyser.connect(ctx.destination);

    this.registerInputNode('audio_in', this.masterGain);
  }

  setParameter(name: string, value: number | string): void {
    if (name === 'volume') {
      this.currentVolume = value as number;
      if (this.masterGain) this.masterGain.gain.value = value as number;
    }
  }

  getAnalyserNode(): AnalyserNode | null {
    return this.analyser;
  }

  destroy(): void {
    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }
    if (this.masterGain) {
      this.masterGain.disconnect();
      this.masterGain = null;
    }
    this.inputNodes.clear();
    this.outputNodes.clear();
  }
}
