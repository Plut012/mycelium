import { ModuleEngine } from '$lib/engine/Module.js';

/**
 * EnvelopeEngine — ADSR envelope generator.
 *
 * Signal graph:
 *   [gate source] ──► gateInput (GainNode) ──► gateAnalyser (AnalyserNode)
 *                                                      (polled for gate level)
 *
 *   envelopeOutput (ConstantSourceNode) ──► cvAnalyser (AnalyserNode) ──► [cv_out]
 *                offset.value shaped by ADSR ramps
 *
 * The polling loop reads a single sample from gateAnalyser ~60fps.
 * When the gate transitions low→high it schedules attack→decay→sustain.
 * When the gate transitions high→low it schedules the release stage.
 */
export class EnvelopeEngine extends ModuleEngine {
  // Gate path
  private gateInput: GainNode | null = null;
  private gateAnalyser: AnalyserNode | null = null;
  private gateSampleBuf: Float32Array = new Float32Array(1);

  // Envelope output
  private envelopeOutput: ConstantSourceNode | null = null;
  private cvAnalyser: AnalyserNode | null = null;

  // ADSR parameter values (seconds / linear)
  private attack = 0.01;
  private decay = 0.2;
  private sustain = 0.7;
  private release = 0.3;

  // Gate state tracking
  private gateHigh = false;
  private rafId: number | null = null;
  private ctx: AudioContext | null = null;

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  create(ctx: AudioContext): void {
    this.ctx = ctx;

    // Gate input path: incoming gate signal → gain node → analyser for polling
    this.gateInput = ctx.createGain();
    this.gateInput.gain.value = 1;

    this.gateAnalyser = ctx.createAnalyser();
    this.gateAnalyser.fftSize = 256;
    this.gateAnalyser.smoothingTimeConstant = 0; // no smoothing — we want snappy transitions
    this.gateSampleBuf = new Float32Array(this.gateAnalyser.fftSize);

    this.gateInput.connect(this.gateAnalyser);

    // Envelope output: ConstantSourceNode whose offset is shaped by ADSR ramps
    this.envelopeOutput = ctx.createConstantSource();
    this.envelopeOutput.offset.value = 0;
    this.envelopeOutput.start();

    // CV analyser: tap on the envelope output for the SignalDisplay
    this.cvAnalyser = ctx.createAnalyser();
    this.cvAnalyser.fftSize = 2048;
    this.cvAnalyser.smoothingTimeConstant = 0.1;
    this.envelopeOutput.connect(this.cvAnalyser);

    // Register ports
    this.registerInputNode('gate_in', this.gateInput);
    this.registerOutputNode('cv_out', this.cvAnalyser);

    // Start gate polling loop
    this.startPolling();
  }

  destroy(): void {
    this.stopPolling();

    if (this.gateInput) {
      this.gateInput.disconnect();
      this.gateInput = null;
    }
    if (this.gateAnalyser) {
      this.gateAnalyser.disconnect();
      this.gateAnalyser = null;
    }
    if (this.envelopeOutput) {
      this.envelopeOutput.offset.cancelScheduledValues(0);
      try { this.envelopeOutput.stop(); } catch { /* already stopped */ }
      this.envelopeOutput.disconnect();
      this.envelopeOutput = null;
    }
    if (this.cvAnalyser) {
      this.cvAnalyser.disconnect();
      this.cvAnalyser = null;
    }

    this.inputNodes.clear();
    this.outputNodes.clear();
    this.ctx = null;
  }

  // ── Parameters ─────────────────────────────────────────────────────────────

  setParameter(name: string, value: number | string): void {
    switch (name) {
      case 'attack':  this.attack  = value as number; break;
      case 'decay':   this.decay   = value as number; break;
      case 'sustain': this.sustain = value as number; break;
      case 'release': this.release = value as number; break;
    }
  }

  // ── Visualisation ──────────────────────────────────────────────────────────

  getAnalyserNode(): AnalyserNode | null {
    return this.cvAnalyser;
  }

  // ── Gate polling ───────────────────────────────────────────────────────────

  private startPolling(): void {
    if (typeof requestAnimationFrame === 'undefined') return;

    const poll = () => {
      this.checkGate();
      this.rafId = requestAnimationFrame(poll);
    };
    this.rafId = requestAnimationFrame(poll);
  }

  private stopPolling(): void {
    if (this.rafId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /**
   * Read the current gate signal level from the analyser.
   * Returns the peak absolute value in the most recent buffer — effectively
   * the current gate level since the gate is a DC signal (ConstantSourceNode).
   */
  private readGateLevel(): number {
    if (!this.gateAnalyser) return 0;
    this.gateAnalyser.getFloatTimeDomainData(this.gateSampleBuf);
    let peak = 0;
    for (let i = 0; i < this.gateSampleBuf.length; i++) {
      const abs = Math.abs(this.gateSampleBuf[i]);
      if (abs > peak) peak = abs;
    }
    return peak;
  }

  private checkGate(): void {
    if (!this.ctx || !this.envelopeOutput) return;

    const level = this.readGateLevel();
    const isHigh = level > 0.01; // threshold for "gate on"

    if (isHigh && !this.gateHigh) {
      // Gate went low → high: trigger attack
      this.gateHigh = true;
      this.triggerAttack();
    } else if (!isHigh && this.gateHigh) {
      // Gate went high → low: trigger release
      this.gateHigh = false;
      this.triggerRelease();
    }
  }

  // ── ADSR scheduling ────────────────────────────────────────────────────────

  private triggerAttack(): void {
    if (!this.ctx || !this.envelopeOutput) return;

    const now = this.ctx.currentTime;
    const param = this.envelopeOutput.offset;

    // Cancel any in-flight ramps (e.g. mid-release retrigger)
    param.cancelScheduledValues(now);

    // Anchor the current value so the ramp starts from where we actually are
    param.setValueAtTime(param.value, now);

    // Attack: ramp to 1 over attack time
    param.linearRampToValueAtTime(1, now + this.attack);

    // Decay: ramp from 1 to sustain level over decay time
    param.linearRampToValueAtTime(this.sustain, now + this.attack + this.decay);

    // Sustain: hold at sustain level until release() is called — no further scheduling needed
  }

  private triggerRelease(): void {
    if (!this.ctx || !this.envelopeOutput) return;

    const now = this.ctx.currentTime;
    const param = this.envelopeOutput.offset;

    // Cancel any pending attack/decay that hasn't fired yet
    param.cancelScheduledValues(now);

    // Anchor from the current instantaneous value (wherever the envelope is right now)
    param.setValueAtTime(param.value, now);

    // Release: ramp from current level to 0 over release time
    param.linearRampToValueAtTime(0, now + this.release);
  }
}
