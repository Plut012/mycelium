import { ModuleEngine } from '$lib/engine/Module.js';

/**
 * Delay with feedback loop.
 *
 * Signal path:
 *   input -> dryGain  ──────────────────────────── outputGain -> out
 *         -> delayNode -> wetGain -> outputGain
 *                 ↑       feedbackGain ─────┘
 */
export class DelayEngine extends ModuleEngine {
  private inputGain: GainNode | null = null;
  private delayNode: DelayNode | null = null;
  private feedbackGain: GainNode | null = null;
  private wetGain: GainNode | null = null;
  private dryGain: GainNode | null = null;
  private outputGain: GainNode | null = null;

  private currentDelay = 0.5;
  private currentFeedback = 0.3;
  private currentMix = 0.5;

  create(ctx: AudioContext): void {
    this.inputGain = ctx.createGain();
    this.delayNode = ctx.createDelay(2.0);
    this.feedbackGain = ctx.createGain();
    this.wetGain = ctx.createGain();
    this.dryGain = ctx.createGain();
    this.outputGain = ctx.createGain();

    this.delayNode.delayTime.value = this.currentDelay;
    this.feedbackGain.gain.value = this.currentFeedback;
    this.wetGain.gain.value = this.currentMix;
    this.dryGain.gain.value = 1 - this.currentMix;

    // input -> delay and input -> dry
    this.inputGain.connect(this.delayNode);
    this.inputGain.connect(this.dryGain);

    // delay -> feedback loop
    this.delayNode.connect(this.feedbackGain);
    this.feedbackGain.connect(this.delayNode);

    // delay -> wet mix
    this.delayNode.connect(this.wetGain);

    // dry + wet -> output
    this.dryGain.connect(this.outputGain);
    this.wetGain.connect(this.outputGain);

    this.registerInputNode('audio_in', this.inputGain);
    this.registerOutputNode('audio_out', this.outputGain);
  }

  setParameter(name: string, value: number | string): void {
    switch (name) {
      case 'delayTime':
        this.currentDelay = value as number;
        if (this.delayNode) this.delayNode.delayTime.value = value as number;
        break;
      case 'feedback':
        this.currentFeedback = value as number;
        if (this.feedbackGain) this.feedbackGain.gain.value = value as number;
        break;
      case 'mix':
        this.currentMix = value as number;
        if (this.wetGain) this.wetGain.gain.value = value as number;
        if (this.dryGain) this.dryGain.gain.value = 1 - (value as number);
        break;
    }
  }

  getAnalyserNode(): AnalyserNode | null {
    return null;
  }

  destroy(): void {
    for (const node of [
      this.inputGain,
      this.delayNode,
      this.feedbackGain,
      this.wetGain,
      this.dryGain,
      this.outputGain,
    ]) {
      try {
        node?.disconnect();
      } catch {
        // ignore
      }
    }
    this.inputGain = null;
    this.delayNode = null;
    this.feedbackGain = null;
    this.wetGain = null;
    this.dryGain = null;
    this.outputGain = null;
    this.inputNodes.clear();
    this.outputNodes.clear();
  }
}
