import { ModuleEngine } from '$lib/engine/Module.js';

export class LFOEngine extends ModuleEngine {
  private oscillator: OscillatorNode | null = null;
  private gain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;

  // Track current values to survive potential recreation
  private currentRate = 1;
  private currentDepth = 0.5;
  private currentWaveform: OscillatorType = 'sine';

  create(ctx: AudioContext): void {
    this.oscillator = ctx.createOscillator();
    this.gain = ctx.createGain();
    this.analyser = ctx.createAnalyser();

    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.3;

    // Apply defaults
    this.oscillator.frequency.value = this.currentRate;
    this.oscillator.type = this.currentWaveform;
    this.gain.gain.value = this.currentDepth;

    // Wire: oscillator -> gain -> analyser
    // Output is bipolar: oscillator swings -1..+1, scaled by gain to -depth..+depth
    this.oscillator.connect(this.gain);
    this.gain.connect(this.analyser);

    this.oscillator.start();

    // The analyser is the output tap — downstream AudioParams receive the LFO signal
    this.registerOutputNode('cv_out', this.analyser);
  }

  setParameter(name: string, value: number | string): void {
    switch (name) {
      case 'rate':
        this.currentRate = value as number;
        if (this.oscillator) this.oscillator.frequency.value = value as number;
        break;
      case 'depth':
        this.currentDepth = value as number;
        if (this.gain) this.gain.gain.value = value as number;
        break;
      case 'waveform':
        this.currentWaveform = value as OscillatorType;
        if (this.oscillator) this.oscillator.type = value as OscillatorType;
        break;
    }
  }

  getAnalyserNode(): AnalyserNode | null {
    return this.analyser;
  }

  destroy(): void {
    if (this.oscillator) {
      try {
        this.oscillator.stop();
      } catch {
        // already stopped
      }
      this.oscillator.disconnect();
      this.oscillator = null;
    }
    if (this.gain) {
      this.gain.disconnect();
      this.gain = null;
    }
    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }
    this.inputNodes.clear();
    this.outputNodes.clear();
  }
}
