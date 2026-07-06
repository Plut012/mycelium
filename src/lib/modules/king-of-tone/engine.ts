import { ModuleEngine } from '$lib/engine/Module.js';

/**
 * ToTDriveEngine — shared core for both sides of the Throne of Tone.
 *
 * Chain: in → tightening highpass → [mid-push peaking, voicing-dependent] →
 * drive gain → WaveShaper (asymmetric soft clip, 4× oversampled; Mode swaps
 * curves) → post-clip lowpass ("passive tone") → presence peaking →
 * [gentle compressor, Bluesbreaker only] → volume → out. True-bypass
 * dry/wet crossfade in parallel.
 *
 * Touch sensitivity is inherent: the shaper curve is level-dependent, so
 * backing off upstream level cleans the drive up like a guitar volume knob.
 *
 * The two module dirs (king-of-tone, bluesbreaker) share this class,
 * differing only in the voicing constants below.
 */

export type DriveMode = 'boost' | 'od' | 'dist';
export type GainLevel = 'low' | 'high';

export interface ToTVoicing {
  /** Pre-clip mid emphasis in dB (0 = King's flat openness) */
  midPushDb: number;
  midPushFreq: number;
  /** Clip curve steepness [positive half, negative half] per mode */
  clipK: Record<DriveMode, [number, number]>;
  /** Post-clip tone lowpass sweep range (Hz) */
  toneLo: number;
  toneHi: number;
  /** Max pre-gain for Low / High gain-level ranges */
  driveMaxLow: number;
  driveMaxHigh: number;
  /** Post-clip 2:1-ish squish for the spongier Bluesbreaker feel */
  postCompress: boolean;
}

export const KING_VOICING: ToTVoicing = {
  midPushDb: 0,
  midPushFreq: 650,
  clipK: { boost: [1.15, 1.0], od: [2.4, 1.7], dist: [4.5, 3.4] },
  toneLo: 800,
  toneHi: 8000,
  driveMaxLow: 8,
  driveMaxHigh: 30,
  postCompress: false,
};

export const BLUES_VOICING: ToTVoicing = {
  midPushDb: 3,
  midPushFreq: 650,
  clipK: { boost: [1.1, 1.0], od: [2.0, 1.5], dist: [3.8, 3.0] },
  toneLo: 650,
  toneHi: 6500,
  driveMaxLow: 6,
  driveMaxHigh: 22,
  postCompress: true,
};

function makeClipCurve(kPos: number, kNeg: number): Float32Array<ArrayBuffer> {
  const n = 2048;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = x >= 0 ? Math.tanh(kPos * x) : Math.tanh(kNeg * x);
  }
  return curve;
}

export class ToTDriveEngine extends ModuleEngine {
  private ctx: AudioContext | null = null;
  private input: GainNode | null = null;
  private tighten: BiquadFilterNode | null = null;
  private midPush: BiquadFilterNode | null = null;
  private driveGain: GainNode | null = null;
  private shaper: WaveShaperNode | null = null;
  private toneLP: BiquadFilterNode | null = null;
  private presenceEQ: BiquadFilterNode | null = null;
  private postComp: DynamicsCompressorNode | null = null;
  private volGain: GainNode | null = null;
  private wetGain: GainNode | null = null;
  private dryGain: GainNode | null = null;
  private output: GainNode | null = null;
  private gainCv: GainNode | null = null;
  private volCv: GainNode | null = null;

  private volume = 0.6;
  private gain = 0.4;
  private tone = 0.5;
  private presence = 0.3;
  private mode: DriveMode = 'od';
  private gainLevel: GainLevel = 'low';
  private engaged = true;

  constructor(private voicing: ToTVoicing) {
    super();
  }

  create(ctx: AudioContext): void {
    this.ctx = ctx;

    this.input = ctx.createGain();
    this.output = ctx.createGain();

    this.tighten = ctx.createBiquadFilter();
    this.tighten.type = 'highpass';
    this.tighten.frequency.value = 90;
    this.tighten.Q.value = 0.7;

    this.midPush = ctx.createBiquadFilter();
    this.midPush.type = 'peaking';
    this.midPush.frequency.value = this.voicing.midPushFreq;
    this.midPush.Q.value = 1;
    this.midPush.gain.value = this.voicing.midPushDb;

    this.driveGain = ctx.createGain();

    this.shaper = ctx.createWaveShaper();
    this.shaper.oversample = '4x';

    this.toneLP = ctx.createBiquadFilter();
    this.toneLP.type = 'lowpass';
    this.toneLP.Q.value = 0.6;

    this.presenceEQ = ctx.createBiquadFilter();
    this.presenceEQ.type = 'peaking';
    this.presenceEQ.frequency.value = 1100;
    this.presenceEQ.Q.value = 0.9;

    this.volGain = ctx.createGain();

    this.wetGain = ctx.createGain();
    this.dryGain = ctx.createGain();
    this.wetGain.gain.value = this.engaged ? 1 : 0;
    this.dryGain.gain.value = this.engaged ? 0 : 1;

    // Wet chain
    this.input.connect(this.tighten);
    this.tighten.connect(this.midPush);
    this.midPush.connect(this.driveGain);
    this.driveGain.connect(this.shaper);
    this.shaper.connect(this.toneLP);
    this.toneLP.connect(this.presenceEQ);

    let tail: AudioNode = this.presenceEQ;
    if (this.voicing.postCompress) {
      this.postComp = ctx.createDynamicsCompressor();
      this.postComp.ratio.value = 2;
      this.postComp.threshold.value = -30;
      this.postComp.knee.value = 15;
      this.postComp.attack.value = 0.01;
      this.postComp.release.value = 0.15;
      tail.connect(this.postComp);
      tail = this.postComp;
    }
    tail.connect(this.volGain);
    this.volGain.connect(this.wetGain);
    this.wetGain.connect(this.output);

    // Dry bypass
    this.input.connect(this.dryGain);
    this.dryGain.connect(this.output);

    this.applyMode();
    this.applyGain();
    this.applyTone();
    this.applyPresence();
    this.applyVolume();

    // CV extensions: ±1 CV sums onto the knob settings
    this.gainCv = ctx.createGain();
    this.gainCv.gain.value = 8; // ±1 CV swings ±8× drive
    this.gainCv.connect(this.driveGain.gain);
    this.volCv = ctx.createGain();
    this.volCv.gain.value = 0.4;
    this.volCv.connect(this.volGain.gain);

    this.registerInputNode('audio_in', this.input);
    this.registerInputNode('gain_cv', this.gainCv);
    this.registerInputNode('volume_cv', this.volCv);
    this.registerOutputNode('audio_out', this.output);
  }

  private applyMode(): void {
    if (!this.shaper) return;
    const [kPos, kNeg] = this.voicing.clipK[this.mode];
    this.shaper.curve = makeClipCurve(kPos, kNeg);
  }

  private applyGain(): void {
    if (!this.ctx || !this.driveGain) return;
    const max = this.gainLevel === 'high' ? this.voicing.driveMaxHigh : this.voicing.driveMaxLow;
    const drive = 1 + this.gain * (max - 1);
    this.driveGain.gain.setTargetAtTime(drive, this.ctx.currentTime, 0.02);
  }

  private applyTone(): void {
    if (!this.ctx || !this.toneLP) return;
    const f = this.voicing.toneLo * Math.pow(this.voicing.toneHi / this.voicing.toneLo, this.tone);
    this.toneLP.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.02);
  }

  private applyPresence(): void {
    if (!this.ctx || !this.presenceEQ) return;
    this.presenceEQ.gain.setTargetAtTime(this.presence * 7, this.ctx.currentTime, 0.02);
  }

  private applyVolume(): void {
    if (!this.ctx || !this.volGain) return;
    // Compensate the shaper's makeup: high drive is inherently louder
    this.volGain.gain.setTargetAtTime(this.volume * 0.9, this.ctx.currentTime, 0.02);
  }

  setParameter(name: string, value: number | string): void {
    switch (name) {
      case 'volume':
        this.volume = value as number;
        this.applyVolume();
        break;
      case 'gain':
        this.gain = value as number;
        this.applyGain();
        break;
      case 'tone':
        this.tone = value as number;
        this.applyTone();
        break;
      case 'presence':
        this.presence = value as number;
        this.applyPresence();
        break;
      case 'mode':
        this.mode = value as DriveMode;
        this.applyMode();
        break;
      case 'gainLevel':
        this.gainLevel = value as GainLevel;
        this.applyGain();
        break;
      case 'engaged': {
        this.engaged = (value as number) > 0.5;
        if (this.ctx && this.wetGain && this.dryGain) {
          const t = this.ctx.currentTime;
          this.wetGain.gain.setTargetAtTime(this.engaged ? 1 : 0, t, 0.005);
          this.dryGain.gain.setTargetAtTime(this.engaged ? 0 : 1, t, 0.005);
        }
        break;
      }
    }
  }

  getAnalyserNode(): AnalyserNode | null {
    return null;
  }

  destroy(): void {
    for (const n of [
      this.input, this.tighten, this.midPush, this.driveGain, this.shaper,
      this.toneLP, this.presenceEQ, this.postComp, this.volGain,
      this.wetGain, this.dryGain, this.output, this.gainCv, this.volCv,
    ]) {
      n?.disconnect();
    }
    this.gainCv = this.volCv = null;
    this.input = this.driveGain = this.volGain = this.wetGain = this.dryGain = this.output = null;
    this.tighten = this.midPush = this.toneLP = this.presenceEQ = null;
    this.shaper = null;
    this.postComp = null;
    this.ctx = null;
    this.inputNodes.clear();
    this.outputNodes.clear();
  }
}

/** King voicing — open, transparent, more headroom. The octave-feeder. */
export class KingOfToneEngine extends ToTDriveEngine {
  constructor() {
    super(KING_VOICING);
  }
}
