import { ModuleEngine } from '$lib/engine/Module.js';

/**
 * EuclidEngine — Euclidean rhythm gate sequencer.
 *
 * Distributes `fills` hits as evenly as possible across `steps` steps
 * (E(3,8) = tresillo, E(5,8) = cinquillo, ...) and pulses the gate output
 * on each hit. Steps are sixteenth notes at the tempo.
 *
 * Timing is sample-accurate: a 25ms lookahead loop schedules gate
 * transitions ahead of time on the audio clock with setValueAtTime, so UI
 * jank never smears the groove. Pulses are kept >= 40ms so the envelope's
 * ~60fps gate polling always catches them.
 */

/** Bresenham formulation — identical output to the Bjorklund algorithm. */
export function euclideanPattern(steps: number, fills: number, rotate: number): boolean[] {
  const f = Math.min(fills, steps);
  const pattern: boolean[] = [];
  for (let i = 0; i < steps; i++) {
    const j = (((i - rotate) % steps) + steps) % steps;
    pattern.push(((j * f) % steps) < f && f > 0);
  }
  return pattern;
}

interface ScheduledStep {
  index: number;
  time: number;
}

export class EuclidEngine extends ModuleEngine {
  private ctx: AudioContext | null = null;
  private gateNode: ConstantSourceNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  private tempo = 120;
  private steps = 8;
  private fills = 3;
  private rotate = 0;
  private running = true;

  private stepIndex = 0;
  private nextStepTime = 0;
  /** Recently scheduled steps, kept so the UI can derive the playhead position */
  private scheduled: ScheduledStep[] = [];

  create(ctx: AudioContext): void {
    this.ctx = ctx;

    this.gateNode = ctx.createConstantSource();
    this.gateNode.offset.value = 0;
    this.gateNode.start();
    this.registerOutputNode('gate_out', this.gateNode);

    this.nextStepTime = ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 25);
  }

  /** One step = a sixteenth note. */
  private stepDur(): number {
    return 60 / this.tempo / 4;
  }

  private schedule(): void {
    if (!this.ctx || !this.gateNode || !this.running) return;

    const ahead = this.ctx.currentTime + 0.12;
    while (this.nextStepTime < ahead) {
      const pattern = euclideanPattern(this.steps, this.fills, this.rotate);
      const idx = this.stepIndex % this.steps;

      if (pattern[idx]) {
        const dur = Math.min(Math.max(this.stepDur() * 0.5, 0.04), this.stepDur() * 0.85);
        this.gateNode.offset.setValueAtTime(1, this.nextStepTime);
        this.gateNode.offset.setValueAtTime(0, this.nextStepTime + dur);
      }

      this.scheduled.push({ index: idx, time: this.nextStepTime });
      if (this.scheduled.length > 64) this.scheduled.splice(0, 32);

      this.stepIndex = (idx + 1) % this.steps;
      this.nextStepTime += this.stepDur();
    }
  }

  // ── Parameters ────────────────────────────────────────────────────────────

  setParameter(name: string, value: number | string): void {
    switch (name) {
      case 'tempo':
        this.tempo = value as number;
        break;
      case 'steps':
        this.steps = Math.max(1, Math.round(value as number));
        this.stepIndex = this.stepIndex % this.steps;
        break;
      case 'fills':
        this.fills = Math.max(0, Math.round(value as number));
        break;
      case 'rotate':
        this.rotate = Math.round(value as number);
        break;
      case 'running': {
        const run = (value as number) > 0.5;
        if (run && !this.running && this.ctx) {
          // Resume cleanly just ahead of the audio clock
          this.nextStepTime = this.ctx.currentTime + 0.05;
        }
        this.running = run;
        if (!run && this.gateNode && this.ctx) {
          this.gateNode.offset.cancelScheduledValues(this.ctx.currentTime);
          this.gateNode.offset.setValueAtTime(0, this.ctx.currentTime);
        }
        break;
      }
    }
  }

  // ── UI accessors ──────────────────────────────────────────────────────────

  getAnalyserNode(): AnalyserNode | null {
    return null; // the ring display is the visualization
  }

  getPattern(): boolean[] {
    return euclideanPattern(this.steps, this.fills, this.rotate);
  }

  isRunning(): boolean {
    return this.running;
  }

  /**
   * Continuous playhead position in [0, 1) over the whole pattern,
   * derived from the audio clock — smooth and in sync with the sound.
   */
  getPlayhead(): number {
    if (!this.ctx || this.scheduled.length === 0) return 0;
    const now = this.ctx.currentTime;

    let last: ScheduledStep | null = null;
    for (const s of this.scheduled) {
      if (s.time <= now) last = s;
      else break;
    }
    if (!last) return this.scheduled[0].index / this.steps;

    const frac = this.running
      ? Math.min((now - last.time) / this.stepDur(), 1)
      : 0;
    return ((last.index + frac) % this.steps) / this.steps;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  destroy(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.gateNode) {
      this.gateNode.stop();
      this.gateNode.disconnect();
      this.gateNode = null;
    }
    this.ctx = null;
    this.scheduled = [];
    this.inputNodes.clear();
    this.outputNodes.clear();
  }
}
