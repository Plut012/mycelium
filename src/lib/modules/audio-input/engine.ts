import { ModuleEngine } from '$lib/engine/Module.js';

/**
 * Captures microphone/line input via getUserMedia.
 * Requesting mic permission happens on create(); the user may deny it.
 * If denied, the output is silent — no crash.
 */
export class AudioInputEngine extends ModuleEngine {
  private gainNode: GainNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  private currentGain = 1;

  create(ctx: AudioContext): void {
    this.gainNode = ctx.createGain();
    this.gainNode.gain.value = this.currentGain;

    this.registerOutputNode('audio_out', this.gainNode);

    // Request mic permission asynchronously — output stays silent until granted
    navigator.mediaDevices
      .getUserMedia({ audio: true, video: false })
      .then((stream) => {
        this.stream = stream;
        if (!this.gainNode) return; // destroyed before permission was granted
        this.sourceNode = ctx.createMediaStreamSource(stream);
        this.sourceNode.connect(this.gainNode);
      })
      .catch(() => {
        // Permission denied or not available — silent output
      });
  }

  setParameter(name: string, value: number | string): void {
    if (name === 'gain') {
      this.currentGain = value as number;
      if (this.gainNode) this.gainNode.gain.value = value as number;
    }
  }

  getAnalyserNode(): AnalyserNode | null {
    return null;
  }

  destroy(): void {
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }
    this.inputNodes.clear();
    this.outputNodes.clear();
  }
}
