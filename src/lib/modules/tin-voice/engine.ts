import { ModuleEngine } from '$lib/engine/Module.js';
import type { SporePayload } from '$lib/engine/Port.js';
import type { NoteSpore } from '$lib/modules/keyboard/engine.js';
import { midiToFreq } from '$lib/modules/keyboard/music.js';

export type TinVoiceName = 'sine-pad' | 'kalimba' | 'flute' | 'saw' | 'bell';

interface Voice {
  /** Oscillators whose detune the drift bus modulates */
  pitched: OscillatorNode[];
  /** LFOs and other non-pitch oscillators */
  others: OscillatorNode[];
  sources: AudioBufferSourceNode[];
  gains: GainNode[];
  filters: BiquadFilterNode[];
  envelope: GainNode;
  /** Envelope fade time constant on note-off */
  release: number;
}

// Generous — Bloom's wash overlaps notes
const MAX_POLYPHONY = 12;

// Full-scale drift input (±1) swings oscillator detune ±25 cents
const DRIFT_DEPTH_CENTS = 25;

/**
 * Tin Voice engine — 5 timbres from stock AudioNodes, polyphonic.
 *
 * Consumes NoteSpore (from Compass, Keyboard, Bloom, ...). The drift_in
 * control port fans out to every sounding oscillator's detune — unpatched
 * the voice is pristine; warmth arrives by cable from X-Factor.
 */
export class TinVoiceEngine extends ModuleEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private driftGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private activeVoices = new Map<number, Voice>();
  private voiceOrder: number[] = [];

  private voiceName: TinVoiceName = 'sine-pad';
  private sub = false;
  private level = 0.8;

  private sporeUnsub: (() => void) | null = null;

  create(ctx: AudioContext): void {
    this.ctx = ctx;

    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = this.level;

    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.4;
    this.masterGain.connect(this.analyser);

    // Drift bus: incoming control signal (±1) scaled to cents, fanned out
    // to each sounding oscillator's detune param as voices are built
    this.driftGain = ctx.createGain();
    this.driftGain.gain.value = DRIFT_DEPTH_CENTS;

    // Breath noise for the flute attack
    const len = Math.floor(ctx.sampleRate * 0.5);
    this.noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    this.registerInputNode('drift_in', this.driftGain);
    this.registerOutputNode('audio_out', this.analyser);

    this.sporeUnsub = this.onSpore('note_in', (data: SporePayload) => {
      // Ignore non-note payloads (e.g. a DegreeSpore patched here by mistake)
      if (!Array.isArray(data.activeNotes)) return;
      this.handleNoteData(data as unknown as NoteSpore);
    });
  }

  // ── Note handling ────────────────────────────────────────────────────────

  private handleNoteData(data: NoteSpore): void {
    const incoming = new Set(data.activeNotes);
    const playing = new Set(this.activeVoices.keys());

    for (const midi of playing) {
      if (!incoming.has(midi)) this.releaseVoice(midi);
    }
    for (const midi of data.activeNotes) {
      if (!playing.has(midi)) this.startVoice(midi);
    }
  }

  private startVoice(midi: number): void {
    if (!this.ctx || !this.masterGain) return;

    if (this.activeVoices.size >= MAX_POLYPHONY) {
      const oldest = this.voiceOrder[0];
      if (oldest !== undefined) this.killVoice(oldest);
    }

    const freq = midiToFreq(midi);
    const now = this.ctx.currentTime;
    let voice: Voice;
    switch (this.voiceName) {
      case 'sine-pad': voice = this.buildSinePad(this.ctx, freq, now); break;
      case 'kalimba':  voice = this.buildKalimba(this.ctx, freq, now); break;
      case 'flute':    voice = this.buildFlute(this.ctx, freq, now); break;
      case 'saw':      voice = this.buildSaw(this.ctx, freq, now); break;
      case 'bell':     voice = this.buildBell(this.ctx, freq, now); break;
    }

    if (this.sub) this.addSubOctave(this.ctx, voice, freq, now);

    for (const osc of voice.pitched) this.driftGain?.connect(osc.detune);

    voice.envelope.connect(this.masterGain);
    this.activeVoices.set(midi, voice);
    this.voiceOrder.push(midi);
  }

  // ── Voice recipes ────────────────────────────────────────────────────────

  private buildSinePad(ctx: AudioContext, freq: number, now: number): Voice {
    const envelope = ctx.createGain();
    envelope.gain.value = 0;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2200;
    filter.Q.value = 0.8;

    const osc1 = ctx.createOscillator();
    osc1.type = 'sine'; osc1.frequency.value = freq; osc1.detune.value = 4;
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine'; osc2.frequency.value = freq; osc2.detune.value = -4;

    const g1 = ctx.createGain(); g1.gain.value = 0.5;
    const g2 = ctx.createGain(); g2.gain.value = 0.5;

    osc1.connect(g1); osc2.connect(g2);
    g1.connect(filter); g2.connect(filter);
    filter.connect(envelope);
    osc1.start(now); osc2.start(now);

    // Slow bloom
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.setTargetAtTime(0.8, now, 0.13);

    return { pitched: [osc1, osc2], others: [], sources: [], gains: [g1, g2], filters: [filter], envelope, release: 0.6 };
  }

  private buildKalimba(ctx: AudioContext, freq: number, now: number): Voice {
    const envelope = ctx.createGain();
    envelope.gain.value = 0;

    const carrier = ctx.createOscillator();
    carrier.type = 'sine'; carrier.frequency.value = freq;

    // 2-op FM: inharmonic-ish modulator with a fast-dying index = tine "plink"
    const mod = ctx.createOscillator();
    mod.type = 'sine'; mod.frequency.value = freq * 3.4;
    const modIndex = ctx.createGain();
    modIndex.gain.setValueAtTime(freq * 2, now);
    modIndex.gain.setTargetAtTime(0, now, 0.04);
    mod.connect(modIndex);
    modIndex.connect(carrier.frequency);

    const g1 = ctx.createGain(); g1.gain.value = 0.85;
    carrier.connect(g1);
    g1.connect(envelope);
    carrier.start(now); mod.start(now);

    // Percussive: instant attack, self-decaying even while held
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.setTargetAtTime(1, now, 0.002);
    envelope.gain.setTargetAtTime(0.0001, now + 0.015, 0.4);

    return { pitched: [carrier], others: [mod], sources: [], gains: [g1, modIndex], filters: [], envelope, release: 0.4 };
  }

  private buildFlute(ctx: AudioContext, freq: number, now: number): Voice {
    const envelope = ctx.createGain();
    envelope.gain.value = 0;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 3200;
    filter.Q.value = 0.7;

    const body = ctx.createOscillator();
    body.type = 'sine'; body.frequency.value = freq;
    const upper = ctx.createOscillator();
    upper.type = 'triangle'; upper.frequency.value = freq * 2;

    const g1 = ctx.createGain(); g1.gain.value = 0.7;
    const g2 = ctx.createGain(); g2.gain.value = 0.12;

    // Gentle 5 Hz vibrato on both partials
    const vibrato = ctx.createOscillator();
    vibrato.type = 'sine'; vibrato.frequency.value = 5;
    const vibDepth = ctx.createGain();
    vibDepth.gain.value = 6; // cents
    vibrato.connect(vibDepth);
    vibDepth.connect(body.detune);
    vibDepth.connect(upper.detune);

    // Breath chiff on the attack
    const breath = ctx.createBufferSource();
    breath.buffer = this.noiseBuffer;
    const breathFilter = ctx.createBiquadFilter();
    breathFilter.type = 'bandpass';
    breathFilter.frequency.value = 1800;
    breathFilter.Q.value = 1;
    const breathGain = ctx.createGain();
    breathGain.gain.setValueAtTime(0.12, now);
    breathGain.gain.setTargetAtTime(0.015, now, 0.08);
    breath.connect(breathFilter);
    breathFilter.connect(breathGain);
    breathGain.connect(filter);

    body.connect(g1); upper.connect(g2);
    g1.connect(filter); g2.connect(filter);
    filter.connect(envelope);
    body.start(now); upper.start(now); vibrato.start(now); breath.start(now);

    envelope.gain.setValueAtTime(0, now);
    envelope.gain.setTargetAtTime(0.85, now, 0.05);

    return {
      pitched: [body, upper],
      others: [vibrato],
      sources: [breath],
      gains: [g1, g2, vibDepth, breathGain],
      filters: [filter, breathFilter],
      envelope,
      release: 0.3,
    };
  }

  private buildSaw(ctx: AudioContext, freq: number, now: number): Voice {
    const envelope = ctx.createGain();
    envelope.gain.value = 0;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2500;
    filter.Q.value = 1;

    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth'; osc1.frequency.value = freq; osc1.detune.value = 7;
    const osc2 = ctx.createOscillator();
    osc2.type = 'sawtooth'; osc2.frequency.value = freq; osc2.detune.value = -7;

    const g1 = ctx.createGain(); g1.gain.value = 0.4;
    const g2 = ctx.createGain(); g2.gain.value = 0.4;

    osc1.connect(g1); osc2.connect(g2);
    g1.connect(filter); g2.connect(filter);
    filter.connect(envelope);
    osc1.start(now); osc2.start(now);

    envelope.gain.setValueAtTime(0, now);
    envelope.gain.setTargetAtTime(0.7, now, 0.03);

    return { pitched: [osc1, osc2], others: [], sources: [], gains: [g1, g2], filters: [filter], envelope, release: 0.4 };
  }

  private buildBell(ctx: AudioContext, freq: number, now: number): Voice {
    const envelope = ctx.createGain();
    envelope.gain.value = 0;

    const carrier = ctx.createOscillator();
    carrier.type = 'sine'; carrier.frequency.value = freq;

    // Inharmonic FM ratio = bell shimmer; index dies slower than the kalimba's
    const mod = ctx.createOscillator();
    mod.type = 'sine'; mod.frequency.value = freq * 2.76;
    const modIndex = ctx.createGain();
    modIndex.gain.setValueAtTime(freq * 1.5, now);
    modIndex.gain.setTargetAtTime(0, now, 0.5);
    mod.connect(modIndex);
    modIndex.connect(carrier.frequency);

    const g1 = ctx.createGain(); g1.gain.value = 0.75;
    carrier.connect(g1);
    g1.connect(envelope);
    carrier.start(now); mod.start(now);

    // Long exponential decay, self-sounding even while held
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.setTargetAtTime(1, now, 0.002);
    envelope.gain.setTargetAtTime(0.0001, now + 0.02, 1.2);

    return { pitched: [carrier], others: [mod], sources: [], gains: [g1, modIndex], filters: [], envelope, release: 0.8 };
  }

  private addSubOctave(ctx: AudioContext, voice: Voice, freq: number, now: number): void {
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = freq / 2;
    const g = ctx.createGain();
    g.gain.value = 0.35;
    sub.connect(g);
    // Join the voice at its filter when it has one, else straight into the envelope
    g.connect(voice.filters[0] ?? voice.envelope);
    sub.start(now);
    voice.pitched.push(sub);
    voice.gains.push(g);
  }

  // ── Voice lifecycle ──────────────────────────────────────────────────────

  private releaseVoice(midi: number): void {
    const voice = this.activeVoices.get(midi);
    if (!voice || !this.ctx) return;

    const now = this.ctx.currentTime;
    voice.envelope.gain.cancelScheduledValues(now);
    voice.envelope.gain.setTargetAtTime(0, now, voice.release / 3);

    const cleanupDelay = voice.release * 3 * 1000 + 100;
    setTimeout(() => this.disposeVoice(voice), cleanupDelay);

    this.activeVoices.delete(midi);
    this.voiceOrder = this.voiceOrder.filter((n) => n !== midi);
  }

  private killVoice(midi: number): void {
    const voice = this.activeVoices.get(midi);
    if (!voice) return;
    this.disposeVoice(voice);
    this.activeVoices.delete(midi);
    this.voiceOrder = this.voiceOrder.filter((n) => n !== midi);
  }

  private disposeVoice(voice: Voice): void {
    for (const osc of voice.pitched) {
      try { this.driftGain?.disconnect(osc.detune); } catch { /* not connected */ }
      try { osc.stop(); } catch { /* already stopped */ }
      osc.disconnect();
    }
    for (const osc of voice.others) {
      try { osc.stop(); } catch { /* already stopped */ }
      osc.disconnect();
    }
    for (const src of voice.sources) {
      try { src.stop(); } catch { /* already stopped */ }
      src.disconnect();
    }
    for (const g of voice.gains) g.disconnect();
    for (const f of voice.filters) f.disconnect();
    voice.envelope.disconnect();
  }

  // ── Parameters ───────────────────────────────────────────────────────────

  setParameter(name: string, value: number | string): void {
    switch (name) {
      case 'voice':
        this.voiceName = value as TinVoiceName;
        break;
      case 'sub':
        // Applies to newly started notes
        this.sub = Boolean(typeof value === 'number' ? value : value === 'true');
        break;
      case 'level':
        this.level = value as number;
        if (this.masterGain) {
          this.masterGain.gain.setTargetAtTime(this.level, this.ctx?.currentTime ?? 0, 0.02);
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

  destroy(): void {
    if (this.sporeUnsub) { this.sporeUnsub(); this.sporeUnsub = null; }
    for (const midi of [...this.activeVoices.keys()]) this.killVoice(midi);
    if (this.driftGain) { this.driftGain.disconnect(); this.driftGain = null; }
    if (this.masterGain) { this.masterGain.disconnect(); this.masterGain = null; }
    if (this.analyser) { this.analyser.disconnect(); this.analyser = null; }
    this.noiseBuffer = null;
    this.ctx = null;
    this.inputNodes.clear();
    this.outputNodes.clear();
  }
}
