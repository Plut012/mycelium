import { ModuleEngine } from '$lib/engine/Module.js';
import type { SporePayload } from '$lib/engine/Port.js';
import type { NoteSpore } from '$lib/modules/keyboard/engine.js';
import { midiToFreq, midiToName, computeIntervals, identifyChord } from '$lib/modules/keyboard/music.js';

export type BloomZone = 'drone' | 'arp' | 'wash';

// Below this the knob is a drone: notes pass through untouched
const DRONE_EDGE = 0.05;
// Above this the arp becomes a wash: rate climbs, order randomizes, notes overlap
const WASH_EDGE = 0.6;

const ARP_RATE_MIN = 0.3;   // Hz
const ARP_RATE_MAX = 4;
const WASH_RATE_MAX = 16;

export function bloomZone(time: number): BloomZone {
  if (time < DRONE_EDGE) return 'drone';
  if (time <= WASH_EDGE) return 'arp';
  return 'wash';
}

export function bloomRate(time: number): number {
  if (time < DRONE_EDGE) return 0;
  if (time <= WASH_EDGE) {
    return ARP_RATE_MIN + ((time - DRONE_EDGE) / (WASH_EDGE - DRONE_EDGE)) * (ARP_RATE_MAX - ARP_RATE_MIN);
  }
  return ARP_RATE_MAX + ((time - WASH_EDGE) / (1 - WASH_EDGE)) * (WASH_RATE_MAX - ARP_RATE_MAX);
}

/**
 * Bloom engine — the Tin's Time knob as a note-motion processor. No AudioNodes.
 *
 * Holds the chord arriving on note_in and re-emits it along the
 * drone → arpeggio → wash continuum. Drone passes through; arp cycles the held
 * notes one at a time, legato; wash randomizes order and lets notes overlap.
 */
export class BloomEngine extends ModuleEngine {
  private time = 0;
  private held: number[] = [];

  private timer: ReturnType<typeof setInterval> | null = null;
  private arpIndex = 0;
  /** Sliding window of currently-sounding wash notes */
  private washWindow: number[] = [];

  /** Last emitted notes — exposed for the UI readout */
  private lastEmitted: NoteSpore | null = null;

  private sporeUnsub: (() => void) | null = null;

  create(_ctx: AudioContext): void {
    this.sporeUnsub = this.onSpore('note_in', (data: SporePayload) => {
      if (!Array.isArray(data.activeNotes)) return;
      this.held = [...(data.activeNotes as number[])].sort((a, b) => a - b);
      this.onHeldChanged();
    });
  }

  private onHeldChanged(): void {
    if (bloomZone(this.time) === 'drone') {
      this.emitNotes(this.held);
      return;
    }
    if (this.held.length === 0) {
      // Chord released — silence downstream and go idle
      this.stopTimer();
      this.washWindow = [];
      this.emitNotes([]);
      return;
    }
    // Keep sounding notes valid against the new chord
    this.washWindow = this.washWindow.filter((n) => this.held.includes(n));
    if (!this.timer) this.startTimer(true);
  }

  // ── Scheduler ────────────────────────────────────────────────────────────

  /**
   * (Re)start the interval at the current rate. `immediate` fires a step right
   * away — used when playback begins, but NOT when retiming during a knob
   * drag, which would burst a step per drag event.
   */
  private startTimer(immediate: boolean): void {
    this.stopTimer();
    const rate = bloomRate(this.time);
    if (rate <= 0) return;
    if (immediate) this.step();
    this.timer = setInterval(() => this.step(), 1000 / rate);
  }

  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private step(): void {
    if (this.held.length === 0) {
      this.stopTimer();
      this.emitNotes([]);
      return;
    }
    if (bloomZone(this.time) === 'arp') {
      // Cycle upward, one note sounding at a time, each held until the next
      this.arpIndex = this.arpIndex % this.held.length;
      this.emitNotes([this.held[this.arpIndex]]);
      this.arpIndex++;
    } else {
      // Wash: random order, 2–3 notes overlapping for shimmer density
      const overlap = this.time < 0.8 ? 2 : 3;
      const next = this.held[Math.floor(Math.random() * this.held.length)];
      this.washWindow.push(next);
      // Dedupe (a repeated pick would end the older copy's voice) and trim
      this.washWindow = [...new Set(this.washWindow)].slice(-overlap);
      this.emitNotes(this.washWindow);
    }
  }

  // ── Emission ─────────────────────────────────────────────────────────────

  private emitNotes(midiNotes: number[]): void {
    const notes = [...new Set(midiNotes)].sort((a, b) => a - b);
    const spore: NoteSpore = {
      activeNotes: notes,
      frequencies: notes.map(midiToFreq),
      noteNames: notes.map(midiToName),
      intervals: computeIntervals(notes),
      chordName: identifyChord(notes),
    };
    this.lastEmitted = spore;
    this.emitSpore('note_out', spore as unknown as Record<string, unknown>);
  }

  // ── Parameters ───────────────────────────────────────────────────────────

  setParameter(name: string, value: number | string): void {
    if (name !== 'time') return;
    const prevZone = bloomZone(this.time);
    this.time = value as number;
    const zone = bloomZone(this.time);

    if (zone === 'drone') {
      if (prevZone !== 'drone') {
        // Collapsing back to drone: restore the full held chord
        this.stopTimer();
        this.washWindow = [];
        this.emitNotes(this.held);
      }
    } else if (this.held.length > 0 || this.timer) {
      // Entering motion fires a step now; retiming mid-motion just reschedules
      this.startTimer(prevZone === 'drone');
    }
  }

  getTime(): number {
    return this.time;
  }

  getLastEmitted(): NoteSpore | null {
    return this.lastEmitted;
  }

  getAnalyserNode(): AnalyserNode | null {
    return null;
  }

  destroy(): void {
    this.stopTimer();
    if (this.sporeUnsub) { this.sporeUnsub(); this.sporeUnsub = null; }
    // Silence anything still sounding downstream
    this.held = [];
    this.washWindow = [];
    this.emitNotes([]);
    this.inputNodes.clear();
    this.outputNodes.clear();
  }
}
