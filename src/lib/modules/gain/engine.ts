import { ModuleEngine } from '$lib/engine/Module.js';

export class GainEngine extends ModuleEngine {
  private gainNode: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private currentGain = 0.5;

  create(ctx: AudioContext): void {
    this.gainNode = ctx.createGain();
    this.gainNode.gain.value = this.currentGain;

    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.3;

    // Wire: gain -> analyser (tap on output)
    this.gainNode.connect(this.analyser);

    // audio_in: the gain node itself receives incoming audio
    this.registerInputNode('audio_in', this.gainNode);
    // gain CV: modulate the gain AudioParam
    this.registerInputNode('gain', this.gainNode.gain);
    // audio_out: the analyser passes signal downstream
    this.registerOutputNode('audio_out', this.analyser);
  }

  setParameter(name: string, value: number | string): void {
    if (name === 'gain') {
      this.currentGain = value as number;
      if (this.gainNode) this.gainNode.gain.value = value as number;
    }
  }

  getAnalyserNode(): AnalyserNode | null {
    return this.analyser;
  }

  destroy(): void {
    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }
    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }
    this.inputNodes.clear();
    this.outputNodes.clear();
  }
}
