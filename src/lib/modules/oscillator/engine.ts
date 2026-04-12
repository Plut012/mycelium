import { ModuleEngine } from '$lib/engine/Module.js';

export class OscillatorEngine extends ModuleEngine {
  private oscillator: OscillatorNode | null = null;
  private analyser: AnalyserNode | null = null;

  // Track current parameter values so we can restore after recreation if needed
  private currentFrequency = 440;
  private currentWaveform: OscillatorType = 'sine';
  private currentDetune = 0;

  create(ctx: AudioContext): void {
    this.oscillator = ctx.createOscillator();
    this.analyser = ctx.createAnalyser();

    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.3;

    // Wire: oscillator -> analyser
    // The analyser acts as a tap — it passes signal through to whatever
    // connects downstream, and also lets the UI read waveform data.
    this.oscillator.connect(this.analyser);

    // Apply defaults
    this.oscillator.frequency.value = this.currentFrequency;
    this.oscillator.detune.value = this.currentDetune;
    this.oscillator.type = this.currentWaveform;

    this.oscillator.start();

    // Register ports
    // audio_out: the analyser node is the output tap (downstream connects to it)
    this.registerOutputNode('audio_out', this.analyser);

    // frequency input: modulate the oscillator's frequency AudioParam
    this.registerInputNode('frequency', this.oscillator.frequency);
  }

  setParameter(name: string, value: number | string): void {
    switch (name) {
      case 'frequency':
        this.currentFrequency = value as number;
        if (this.oscillator) this.oscillator.frequency.value = value as number;
        break;
      case 'waveform':
        this.currentWaveform = value as OscillatorType;
        if (this.oscillator) this.oscillator.type = value as OscillatorType;
        break;
      case 'detune':
        this.currentDetune = value as number;
        if (this.oscillator) this.oscillator.detune.value = value as number;
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
    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }
    this.inputNodes.clear();
    this.outputNodes.clear();
  }
}
