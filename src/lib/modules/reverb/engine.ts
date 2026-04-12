import { ModuleEngine } from '$lib/engine/Module.js';

type RoomSize = 'small' | 'medium' | 'large' | 'hall';

const SIZE_DURATIONS: Record<RoomSize, number> = {
  small: 0.8,
  medium: 1.5,
  large: 3,
  hall: 5,
};

/**
 * Reverb using ConvolverNode with a procedurally generated impulse response.
 *
 * Signal path:
 *   audio_in -> inputGain -+-> dryGain ----+-> outputMixer -> analyser -> audio_out
 *                          +-> convolver -> wetGain -+
 */
export class ReverbEngine extends ModuleEngine {
  private ctx: AudioContext | null = null;

  private inputGain: GainNode | null = null;
  private dryGain: GainNode | null = null;
  private convolver: ConvolverNode | null = null;
  private wetGain: GainNode | null = null;
  private outputMixer: GainNode | null = null;
  private analyser: AnalyserNode | null = null;

  private currentSize: RoomSize = 'medium';
  private currentDecay = 2;
  private currentMix = 0.35;
  private currentDamping = 0.5;

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  create(ctx: AudioContext): void {
    this.ctx = ctx;

    this.inputGain = ctx.createGain();
    this.dryGain = ctx.createGain();
    this.convolver = ctx.createConvolver();
    this.wetGain = ctx.createGain();
    this.outputMixer = ctx.createGain();
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 1024;

    this.applyMix(this.currentMix);

    // Wire the graph
    this.inputGain.connect(this.dryGain);
    this.inputGain.connect(this.convolver);
    this.convolver.connect(this.wetGain);
    this.dryGain.connect(this.outputMixer);
    this.wetGain.connect(this.outputMixer);
    this.outputMixer.connect(this.analyser);

    this.registerInputNode('audio_in', this.inputGain);
    this.registerOutputNode('audio_out', this.analyser);

    // Generate initial IR
    this.regenerateIR();
  }

  destroy(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    for (const node of [
      this.inputGain,
      this.dryGain,
      this.convolver,
      this.wetGain,
      this.outputMixer,
      this.analyser,
    ]) {
      try {
        node?.disconnect();
      } catch {
        // ignore
      }
    }

    this.inputGain = null;
    this.dryGain = null;
    this.convolver = null;
    this.wetGain = null;
    this.outputMixer = null;
    this.analyser = null;
    this.ctx = null;

    this.inputNodes.clear();
    this.outputNodes.clear();
  }

  // ── Parameters ─────────────────────────────────────────────────────────────

  setParameter(name: string, value: number | string): void {
    switch (name) {
      case 'size':
        this.currentSize = value as RoomSize;
        this.scheduleIRRegeneration();
        break;

      case 'decay':
        this.currentDecay = value as number;
        this.scheduleIRRegeneration();
        break;

      case 'mix':
        this.currentMix = value as number;
        this.applyMix(this.currentMix);
        break;

      case 'damping':
        this.currentDamping = value as number;
        this.scheduleIRRegeneration();
        break;
    }
  }

  // ── Visualisation ──────────────────────────────────────────────────────────

  getAnalyserNode(): AnalyserNode | null {
    return this.analyser;
  }

  // ── Internal helpers ───────────────────────────────────────────────────────

  private applyMix(mix: number): void {
    if (this.dryGain) this.dryGain.gain.value = 1 - mix;
    if (this.wetGain) this.wetGain.gain.value = mix;
  }

  private scheduleIRRegeneration(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.regenerateIR();
    }, 100);
  }

  private regenerateIR(): void {
    if (!this.ctx || !this.convolver) return;

    const buffer = generateIR(
      this.ctx,
      SIZE_DURATIONS[this.currentSize],
      this.currentDecay,
      this.currentDamping,
    );

    this.convolver.buffer = buffer;
  }
}

// ── Impulse response generation ────────────────────────────────────────────

function generateIR(
  ctx: AudioContext,
  duration: number,
  decay: number,
  damping: number,
): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * duration);
  const buffer = ctx.createBuffer(2, length, sampleRate);

  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      // Exponential decay envelope
      const envelope = Math.exp(-t * (6 / decay));
      // Damping: low-pass effect by mixing current noise with previous sample
      const noise = Math.random() * 2 - 1;
      if (i > 0 && damping > 0) {
        data[i] = (noise * (1 - damping) + data[i - 1] * damping) * envelope;
      } else {
        data[i] = noise * envelope;
      }
    }
  }

  return buffer;
}
