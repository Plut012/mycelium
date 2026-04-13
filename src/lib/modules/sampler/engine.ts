import { ModuleEngine } from '$lib/engine/Module.js';
import type { SporePayload } from '$lib/engine/Port.js';
import type { NoteSpore } from '$lib/modules/keyboard/engine.js';
import type { InstrumentPack } from '$lib/instruments/types.js';
import { loadSample, findBestSample, selectVelocityLayer, preloadInstrument, getCachedBuffer } from '$lib/instruments/loader.js';

export type TonePreset = 'warm-pad' | 'nylon' | 'bell' | 'soft-keys';

/** Combined tone type: synthesized presets or instrument pack id */
export type ToneSource = TonePreset | string;

interface SynthVoice {
  kind: 'synth';
  oscillators: OscillatorNode[];
  gains: GainNode[];
  filter: BiquadFilterNode | null;
  envelope: GainNode;
  startedAt: number;
}

interface SampleVoice {
  kind: 'sample';
  source: AudioBufferSourceNode;
  envelope: GainNode;
  startedAt: number;
}

type Voice = SynthVoice | SampleVoice;

const MAX_POLYPHONY = 10;

export class SamplerEngine extends ModuleEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;

  private activeVoices = new Map<number, Voice>();
  private voiceOrder: number[] = [];

  // Parameters
  private tone: ToneSource = 'warm-pad';
  private attack = 0.02;
  private release = 0.8;
  private brightness = 0.3;
  private volume = 0.6;

  // Instrument packs — keyed by pack id so we can switch between them
  private loadedInstruments = new Map<string, InstrumentPack>();
  private activeInstrumentId: string | null = null;
  private instrumentLoading = false;
  private instrumentLoadProgress = 0;

  // Cleanup
  private sporeUnsub: (() => void) | null = null;

  create(ctx: AudioContext): void {
    this.ctx = ctx;

    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = this.volume;

    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.4;

    this.masterGain.connect(this.analyser);

    this.registerOutputNode('audio_out', this.analyser);

    this.sporeUnsub = this.onSpore('note_data', (data: SporePayload) => {
      this.handleNoteData(data as unknown as NoteSpore);
    });
  }

  // ── Instrument pack loading ─────────────────────────────────────────────

  async loadInstrument(pack: InstrumentPack): Promise<void> {
    if (!this.ctx) return;
    this.instrumentLoading = true;
    this.instrumentLoadProgress = 0;

    try {
      await preloadInstrument(this.ctx, pack, (loaded, total) => {
        this.instrumentLoadProgress = loaded / total;
      });
      this.loadedInstruments.set(pack.id, pack);
      this.activeInstrumentId = pack.id;
      this.tone = pack.id;
    } finally {
      this.instrumentLoading = false;
    }
  }

  isInstrumentLoading(): boolean {
    return this.instrumentLoading;
  }

  getLoadProgress(): number {
    return this.instrumentLoadProgress;
  }

  getLoadedInstrumentId(): string | null {
    return this.activeInstrumentId;
  }

  getLoadedInstrumentIds(): string[] {
    return [...this.loadedInstruments.keys()];
  }

  // ── Note handling ───────────────────────────────────────────────────────

  private handleNoteData(data: NoteSpore): void {
    const incoming = new Set(data.activeNotes);
    const playing = new Set(this.activeVoices.keys());

    for (const midi of playing) {
      if (!incoming.has(midi)) {
        this.releaseVoice(midi);
      }
    }

    for (const midi of data.activeNotes) {
      if (!playing.has(midi)) {
        this.startVoice(midi);
      }
    }
  }

  private isSynthPreset(tone: ToneSource): tone is TonePreset {
    return ['warm-pad', 'nylon', 'bell', 'soft-keys'].includes(tone);
  }

  // ── Voice management ────────────────────────────────────────────────────

  private startVoice(midi: number): void {
    if (!this.ctx || !this.masterGain) return;

    if (this.activeVoices.size >= MAX_POLYPHONY) {
      const oldest = this.voiceOrder[0];
      if (oldest !== undefined) this.killVoice(oldest);
    }

    const now = this.ctx.currentTime;
    let voice: Voice;

    if (this.isSynthPreset(this.tone)) {
      const freq = 440 * Math.pow(2, (midi - 69) / 12);
      voice = this.buildSynthVoice(freq, now);
    } else {
      const pack = this.loadedInstruments.get(this.tone);
      if (!pack) return;
      const sampleVoice = this.buildSampleVoice(midi, now, pack);
      if (!sampleVoice) return;
      voice = sampleVoice;
    }

    voice.envelope.connect(this.masterGain);
    this.activeVoices.set(midi, voice);
    this.voiceOrder.push(midi);
  }

  // ── Sample-based voice ──────────────────────────────────────────────────

  private buildSampleVoice(midi: number, now: number, pack: InstrumentPack): SampleVoice | null {
    if (!this.ctx) return null;

    // Check range
    if (midi < pack.range.low || midi > pack.range.high) return null;

    // Select velocity layer (use brightness as velocity proxy for now)
    const layer = selectVelocityLayer(pack, 0.3 + this.brightness * 0.7);
    const match = findBestSample(midi, layer);
    if (!match) return null;

    // Get cached buffer
    const buffer = this.getCachedBufferSync(match.mapping.url);
    if (!buffer) {
      // Buffer not loaded yet — load it async (note may be missed)
      loadSample(this.ctx, match.mapping.url).catch(() => {});
      return null;
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = match.playbackRate;

    const envelope = this.ctx.createGain();
    envelope.gain.value = 0;

    source.connect(envelope);
    source.start(now);

    // Smooth attack
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.setTargetAtTime(1, now, Math.max(this.attack / 3, 0.001));

    return { kind: 'sample', source, envelope, startedAt: now };
  }

  private getCachedBufferSync(url: string): AudioBuffer | null {
    return getCachedBuffer(url) ?? null;
  }

  // ── Synth voice builders (unchanged) ────────────────────────────────────

  private brightnessToFreq(preset: TonePreset): number {
    const b = this.brightness;
    switch (preset) {
      case 'warm-pad':  return 400  + b * (2000 - 400);
      case 'nylon':     return 800  + b * (3000 - 800);
      case 'bell':      return 2000 + b * (8000 - 2000);
      case 'soft-keys': return 600  + b * (2500 - 600);
    }
  }

  private buildSynthVoice(freq: number, now: number): SynthVoice {
    switch (this.tone as TonePreset) {
      case 'warm-pad':   return this.buildWarmPad(this.ctx!, freq, now);
      case 'nylon':      return this.buildNylon(this.ctx!, freq, now);
      case 'bell':       return this.buildBell(this.ctx!, freq, now);
      case 'soft-keys':  return this.buildSoftKeys(this.ctx!, freq, now);
    }
  }

  private buildWarmPad(ctx: AudioContext, freq: number, now: number): SynthVoice {
    const envelope = ctx.createGain();
    envelope.gain.value = 0;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = this.brightnessToFreq('warm-pad');
    filter.Q.value = 1.2;

    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.value = freq;
    osc1.detune.value = 5;

    const osc2 = ctx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.value = freq;
    osc2.detune.value = -5;

    const g1 = ctx.createGain(); g1.gain.value = 0.5;
    const g2 = ctx.createGain(); g2.gain.value = 0.5;

    osc1.connect(g1); osc2.connect(g2);
    g1.connect(filter); g2.connect(filter);
    filter.connect(envelope);

    osc1.start(); osc2.start();

    envelope.gain.setValueAtTime(0, now);
    envelope.gain.setTargetAtTime(1, now, this.attack / 3);

    return { kind: 'synth', oscillators: [osc1, osc2], gains: [g1, g2], filter, envelope, startedAt: now };
  }

  private buildNylon(ctx: AudioContext, freq: number, now: number): SynthVoice {
    const envelope = ctx.createGain();
    envelope.gain.value = 0;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = this.brightnessToFreq('nylon');
    filter.Q.value = 0.8;

    const osc1 = ctx.createOscillator();
    osc1.type = 'triangle';
    osc1.frequency.value = freq;

    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = freq * 2;

    const g1 = ctx.createGain(); g1.gain.value = 0.7;
    const g2 = ctx.createGain(); g2.gain.value = 0.3;

    osc1.connect(g1); osc2.connect(g2);
    g1.connect(filter); g2.connect(filter);
    filter.connect(envelope);

    osc1.start(); osc2.start();

    envelope.gain.setValueAtTime(0, now);
    envelope.gain.setTargetAtTime(1, now, 0.001);
    envelope.gain.setTargetAtTime(0.3, now + 0.005, 0.05);

    return { kind: 'synth', oscillators: [osc1, osc2], gains: [g1, g2], filter, envelope, startedAt: now };
  }

  private buildBell(ctx: AudioContext, freq: number, now: number): SynthVoice {
    const envelope = ctx.createGain();
    envelope.gain.value = 0;

    const osc1 = ctx.createOscillator(); osc1.type = 'sine'; osc1.frequency.value = freq;
    const osc2 = ctx.createOscillator(); osc2.type = 'sine'; osc2.frequency.value = freq * 2.76;
    const osc3 = ctx.createOscillator(); osc3.type = 'sine'; osc3.frequency.value = freq * 5.4;

    const g1 = ctx.createGain(); g1.gain.value = 0.6;
    const g2 = ctx.createGain(); g2.gain.value = 0.3;
    const g3 = ctx.createGain(); g3.gain.value = 0.1;

    osc1.connect(g1); osc2.connect(g2); osc3.connect(g3);
    g1.connect(envelope); g2.connect(envelope); g3.connect(envelope);

    osc1.start(); osc2.start(); osc3.start();

    envelope.gain.setValueAtTime(1, now);
    envelope.gain.setTargetAtTime(0.001, now, this.release / 3);

    return { kind: 'synth', oscillators: [osc1, osc2, osc3], gains: [g1, g2, g3], filter: null, envelope, startedAt: now };
  }

  private buildSoftKeys(ctx: AudioContext, freq: number, now: number): SynthVoice {
    const envelope = ctx.createGain();
    envelope.gain.value = 0;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = this.brightnessToFreq('soft-keys');
    filter.Q.value = 0.7;

    const osc1 = ctx.createOscillator(); osc1.type = 'sine'; osc1.frequency.value = freq;
    const osc2 = ctx.createOscillator(); osc2.type = 'sine'; osc2.frequency.value = freq * 2;
    const osc3 = ctx.createOscillator(); osc3.type = 'sine'; osc3.frequency.value = freq * 3;

    const g1 = ctx.createGain(); g1.gain.value = 0.6;
    const g2 = ctx.createGain(); g2.gain.value = 0.3;
    const g3 = ctx.createGain(); g3.gain.value = 0.05;

    osc1.connect(g1); osc2.connect(g2); osc3.connect(g3);
    g1.connect(filter); g2.connect(filter); g3.connect(filter);
    filter.connect(envelope);

    osc1.start(); osc2.start(); osc3.start();

    envelope.gain.setValueAtTime(0, now);
    envelope.gain.setTargetAtTime(1, now, this.attack / 3);

    return { kind: 'synth', oscillators: [osc1, osc2, osc3], gains: [g1, g2, g3], filter, envelope, startedAt: now };
  }

  // ── Voice lifecycle ─────────────────────────────────────────────────────

  private releaseVoice(midi: number): void {
    const voice = this.activeVoices.get(midi);
    if (!voice || !this.ctx) return;

    const now = this.ctx.currentTime;
    const env = voice.envelope;

    env.gain.cancelScheduledValues(now);
    env.gain.setTargetAtTime(0, now, this.release / 3);

    const cleanupDelay = this.release * 3 * 1000 + 100;
    setTimeout(() => this.disposeVoice(voice), cleanupDelay);

    this.activeVoices.delete(midi);
    this.voiceOrder = this.voiceOrder.filter(n => n !== midi);
  }

  private killVoice(midi: number): void {
    const voice = this.activeVoices.get(midi);
    if (!voice) return;
    this.disposeVoice(voice);
    this.activeVoices.delete(midi);
    this.voiceOrder = this.voiceOrder.filter(n => n !== midi);
  }

  private disposeVoice(voice: Voice): void {
    if (voice.kind === 'synth') {
      for (const osc of voice.oscillators) {
        try { osc.stop(); } catch { /* already stopped */ }
        osc.disconnect();
      }
      for (const g of voice.gains) g.disconnect();
      if (voice.filter) voice.filter.disconnect();
    } else {
      try { voice.source.stop(); } catch { /* already stopped */ }
      voice.source.disconnect();
    }
    voice.envelope.disconnect();
  }

  // ── Parameters ──────────────────────────────────────────────────────────

  setParameter(name: string, value: number | string): void {
    switch (name) {
      case 'tone':
        this.tone = value as ToneSource;
        if (!this.isSynthPreset(this.tone)) {
          this.activeInstrumentId = this.tone;
        }
        break;
      case 'attack':
        this.attack = value as number;
        break;
      case 'release':
        this.release = value as number;
        break;
      case 'brightness':
        this.brightness = value as number;
        for (const voice of this.activeVoices.values()) {
          if (voice.kind === 'synth' && voice.filter) {
            voice.filter.frequency.setTargetAtTime(
              this.brightnessToFreq(this.tone as TonePreset),
              this.ctx?.currentTime ?? 0,
              0.02
            );
          }
        }
        break;
      case 'volume':
        this.volume = value as number;
        if (this.masterGain) {
          this.masterGain.gain.setTargetAtTime(this.volume, this.ctx?.currentTime ?? 0, 0.02);
        }
        break;
    }
  }

  getAnalyserNode(): AnalyserNode | null {
    return this.analyser;
  }

  getActiveNoteCount(): number {
    return this.activeVoices.size;
  }

  getCurrentTone(): ToneSource {
    return this.tone;
  }

  destroy(): void {
    if (this.sporeUnsub) { this.sporeUnsub(); this.sporeUnsub = null; }
    for (const midi of [...this.activeVoices.keys()]) this.killVoice(midi);
    if (this.masterGain) { this.masterGain.disconnect(); this.masterGain = null; }
    if (this.analyser) { this.analyser.disconnect(); this.analyser = null; }
    this.ctx = null;
    this.inputNodes.clear();
    this.outputNodes.clear();
  }
}
