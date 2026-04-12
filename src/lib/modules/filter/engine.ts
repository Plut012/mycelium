import { ModuleEngine } from '$lib/engine/Module.js';

export class FilterEngine extends ModuleEngine {
  private filter: BiquadFilterNode | null = null;
  private currentFrequency = 1000;
  private currentQ = 1;
  private currentType: BiquadFilterType = 'lowpass';

  create(ctx: AudioContext): void {
    this.filter = ctx.createBiquadFilter();
    this.filter.frequency.value = this.currentFrequency;
    this.filter.Q.value = this.currentQ;
    this.filter.type = this.currentType;

    this.registerInputNode('audio_in', this.filter);
    this.registerInputNode('cutoff_cv', this.filter.frequency);
    this.registerOutputNode('audio_out', this.filter);
  }

  setParameter(name: string, value: number | string): void {
    switch (name) {
      case 'frequency':
        this.currentFrequency = value as number;
        if (this.filter) this.filter.frequency.value = value as number;
        break;
      case 'Q':
        this.currentQ = value as number;
        if (this.filter) this.filter.Q.value = value as number;
        break;
      case 'type':
        this.currentType = value as BiquadFilterType;
        if (this.filter) this.filter.type = value as BiquadFilterType;
        break;
    }
  }

  getAnalyserNode(): AnalyserNode | null {
    return null;
  }

  destroy(): void {
    if (this.filter) {
      this.filter.disconnect();
      this.filter = null;
    }
    this.inputNodes.clear();
    this.outputNodes.clear();
  }
}
