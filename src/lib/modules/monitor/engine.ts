import { ModuleEngine } from '$lib/engine/Module.js';

/**
 * MonitorEngine — audio analysis tap with passthrough.
 *
 * Signal path: audio_in → GainNode (unity) → audio_out, with an
 * AnalyserNode tapped off the gain. All visualization (waveform,
 * log-frequency spectrogram, chroma ring, level meter) is derived in the
 * UI from this single analyser. Large fftSize gives the low-frequency
 * resolution the musical spectrogram needs.
 */
export class MonitorEngine extends ModuleEngine {
  private thru: GainNode | null = null;
  private analyser: AnalyserNode | null = null;

  create(ctx: AudioContext): void {
    this.thru = ctx.createGain();
    this.thru.gain.value = 1;

    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 4096;
    this.analyser.smoothingTimeConstant = 0.6;
    this.thru.connect(this.analyser);

    this.registerInputNode('audio_in', this.thru);
    this.registerOutputNode('audio_out', this.thru);
  }

  getAnalyserNode(): AnalyserNode | null {
    return this.analyser;
  }

  getSampleRate(): number {
    return this.analyser?.context.sampleRate ?? 44100;
  }

  setParameter(): void {
    // No parameters — the monitor only listens
  }

  destroy(): void {
    if (this.thru) { this.thru.disconnect(); this.thru = null; }
    if (this.analyser) { this.analyser.disconnect(); this.analyser = null; }
    this.inputNodes.clear();
    this.outputNodes.clear();
  }
}
