/**
 * Scroll engine — jukebox MIDI player with look-ahead scheduling.
 *
 * Outputs CV (pitch frequency), Gate (note on/off), and Clock (beat pulse)
 * via ConstantSourceNodes. Uses the standard Web Audio look-ahead scheduler
 * pattern: a setInterval loop runs every 25ms and schedules events 100ms ahead
 * for sample-accurate timing.
 */

import { ModuleEngine } from '$lib/engine/Module.js';
import { midiToFreq, midiToName } from '$lib/modules/keyboard/music.js';
import type { NoteSpore } from '$lib/modules/keyboard/engine.js';
import type { ScrollSong } from './types.js';
import { BUILT_IN_SONGS } from './songs.js';
import { loadAllUserSongs, saveSong } from './song-store.js';
import { parseMidi } from './midi-parser.js';

const SCHEDULE_INTERVAL = 25;   // ms between scheduler ticks
const SCHEDULE_AHEAD = 0.1;     // seconds to look ahead
const CLOCK_PULSE_WIDTH = 0.02; // seconds — clock pulse duration

export class ScrollEngine extends ModuleEngine {
  private ctx: AudioContext | null = null;

  // Audio nodes
  private cvNode: ConstantSourceNode | null = null;
  private gateNode: ConstantSourceNode | null = null;
  private clockNode: ConstantSourceNode | null = null;
  private analyser: AnalyserNode | null = null;

  // Song library
  private songs: ScrollSong[] = [...BUILT_IN_SONGS];
  private selectedIndex = 0;
  private userSongsLoaded = false;

  // Playback state
  private playing = false;
  private looping = true;
  private tempo = 120;
  private transpose = 0;
  private startTime = 0;
  private lastScheduledTime = 0;
  private schedulerInterval: ReturnType<typeof setInterval> | null = null;
  private activeNotesMidi: Set<number> = new Set();

  // Clock tracking
  private lastScheduledBeat = -1;

  // Callbacks for UI updates
  private onStateChange: (() => void) | null = null;

  create(ctx: AudioContext): void {
    this.ctx = ctx;

    this.cvNode = ctx.createConstantSource();
    this.cvNode.offset.value = 0;
    this.cvNode.start();

    this.gateNode = ctx.createConstantSource();
    this.gateNode.offset.value = 0;
    this.gateNode.start();

    this.clockNode = ctx.createConstantSource();
    this.clockNode.offset.value = 0;
    this.clockNode.start();

    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.cvNode.connect(this.analyser);

    this.registerOutputNode('cv_out', this.cvNode);
    this.registerOutputNode('gate_out', this.gateNode);
    this.registerOutputNode('clock_out', this.clockNode);

    // Load user songs from IndexedDB
    this.loadUserSongs();
  }

  destroy(): void {
    this.stop();
    if (this.cvNode) { this.cvNode.stop(); this.cvNode.disconnect(); this.cvNode = null; }
    if (this.gateNode) { this.gateNode.stop(); this.gateNode.disconnect(); this.gateNode = null; }
    if (this.clockNode) { this.clockNode.stop(); this.clockNode.disconnect(); this.clockNode = null; }
    if (this.analyser) { this.analyser.disconnect(); this.analyser = null; }
    this.inputNodes.clear();
    this.outputNodes.clear();
  }

  setParameter(name: string, value: number | string): void {
    switch (name) {
      case 'tempo':
        this.tempo = value as number;
        break;
      case 'transpose':
        this.transpose = Math.round(value as number);
        break;
      case 'loop':
        this.looping = value === 1;
        break;
    }
  }

  getAnalyserNode(): AnalyserNode | null {
    return this.analyser;
  }

  // ── Public API ──────────────────────────────────────────────────────────

  play(): void {
    if (this.playing || !this.ctx) return;
    const song = this.currentSong();
    if (!song || song.notes.length === 0) return;

    this.playing = true;
    this.startTime = this.ctx.currentTime;
    this.lastScheduledTime = 0;
    this.lastScheduledBeat = -1;
    this.activeNotesMidi.clear();

    this.schedulerInterval = setInterval(() => this.scheduleTick(), SCHEDULE_INTERVAL);
    this.notifyStateChange();
  }

  stop(): void {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
    }
    this.playing = false;
    this.activeNotesMidi.clear();

    // Silence outputs immediately
    if (this.ctx && this.gateNode) {
      const now = this.ctx.currentTime;
      this.gateNode.offset.cancelScheduledValues(now);
      this.gateNode.offset.setValueAtTime(0, now);
    }
    if (this.ctx && this.clockNode) {
      const now = this.ctx.currentTime;
      this.clockNode.offset.cancelScheduledValues(now);
      this.clockNode.offset.setValueAtTime(0, now);
    }

    this.emitSpore('note_data', {
      activeNotes: [],
      frequencies: [],
      noteNames: [],
      intervals: [],
      chordName: null,
    } satisfies NoteSpore);

    this.notifyStateChange();
  }

  nextSong(): void {
    const wasPlaying = this.playing;
    if (wasPlaying) this.stop();
    this.selectedIndex = (this.selectedIndex + 1) % this.songs.length;
    this.notifyStateChange();
    if (wasPlaying) this.play();
  }

  prevSong(): void {
    const wasPlaying = this.playing;
    if (wasPlaying) this.stop();
    this.selectedIndex = (this.selectedIndex - 1 + this.songs.length) % this.songs.length;
    this.notifyStateChange();
    if (wasPlaying) this.play();
  }

  selectSong(index: number): void {
    if (index < 0 || index >= this.songs.length) return;
    const wasPlaying = this.playing;
    if (wasPlaying) this.stop();
    this.selectedIndex = index;
    this.notifyStateChange();
    if (wasPlaying) this.play();
  }

  async importMidi(buffer: ArrayBuffer, filename: string): Promise<void> {
    const title = filename.replace(/\.midi?$/i, '');
    const song = parseMidi(buffer, title);
    await saveSong(song);
    this.songs.push(song);
    this.selectedIndex = this.songs.length - 1;
    this.notifyStateChange();
  }

  currentSong(): ScrollSong | null {
    return this.songs[this.selectedIndex] ?? null;
  }

  getSongList(): ScrollSong[] {
    return this.songs;
  }

  getSelectedIndex(): number {
    return this.selectedIndex;
  }

  isPlaying(): boolean {
    return this.playing;
  }

  getPlaybackPosition(): number {
    if (!this.playing || !this.ctx) return 0;
    const song = this.currentSong();
    if (!song || song.durationTicks === 0) return 0;
    const elapsed = this.ctx.currentTime - this.startTime;
    const elapsedTicks = this.secondsToTicks(elapsed, song);
    return Math.min(1, elapsedTicks / song.durationTicks);
  }

  getCurrentNotes(): number[] {
    return [...this.activeNotesMidi];
  }

  setStateChangeCallback(cb: () => void): void {
    this.onStateChange = cb;
  }

  // ── Scheduler ───────────────────────────────────────────────────────────

  private scheduleTick(): void {
    if (!this.ctx || !this.cvNode || !this.gateNode || !this.clockNode) return;
    const song = this.currentSong();
    if (!song) return;

    const now = this.ctx.currentTime;
    const scheduleEnd = now + SCHEDULE_AHEAD;
    const elapsed = scheduleEnd - this.startTime;
    const elapsedTicks = this.secondsToTicks(elapsed, song);

    const lastElapsed = this.lastScheduledTime - this.startTime;
    const lastTicks = Math.max(0, this.secondsToTicks(lastElapsed, song));

    // Check if song ended
    if (lastTicks >= song.durationTicks) {
      if (this.looping) {
        // Reset for loop
        this.startTime = now;
        this.lastScheduledTime = now;
        this.lastScheduledBeat = -1;
        this.activeNotesMidi.clear();
        return;
      } else {
        this.stop();
        return;
      }
    }

    // Schedule notes in the look-ahead window
    const notesChanged = this.scheduleNotes(song, lastTicks, elapsedTicks);

    // Schedule clock pulses
    this.scheduleClockPulses(song, lastTicks, elapsedTicks);

    // Emit spore data if notes changed
    if (notesChanged) {
      const activeArray = [...this.activeNotesMidi];
      this.emitSpore('note_data', {
        activeNotes: activeArray,
        frequencies: activeArray.map(m => midiToFreq(m + this.transpose)),
        noteNames: activeArray.map(m => midiToName(m + this.transpose)),
        intervals: [],
        chordName: null,
      } satisfies NoteSpore);
    }

    this.lastScheduledTime = scheduleEnd;
  }

  private scheduleNotes(song: ScrollSong, fromTick: number, toTick: number): boolean {
    if (!this.cvNode || !this.gateNode || !this.ctx) return false;

    let changed = false;
    const cv = this.cvNode.offset;
    const gate = this.gateNode.offset;

    for (const note of song.notes) {
      // Note start in window
      if (note.tick >= fromTick && note.tick < toTick) {
        const noteTime = this.startTime + this.ticksToSeconds(note.tick, song);
        const freq = midiToFreq(note.midi + this.transpose);

        cv.setValueAtTime(freq, noteTime);
        gate.setValueAtTime(note.velocity, noteTime);

        this.activeNotesMidi.add(note.midi);
        changed = true;
      }

      // Note end in window
      const noteEnd = note.tick + note.duration;
      if (noteEnd >= fromTick && noteEnd < toTick) {
        const endTime = this.startTime + this.ticksToSeconds(noteEnd, song);
        gate.setValueAtTime(0, endTime);

        this.activeNotesMidi.delete(note.midi);
        changed = true;
      }
    }

    return changed;
  }

  private scheduleClockPulses(song: ScrollSong, fromTick: number, toTick: number): void {
    if (!this.clockNode || !this.ctx) return;

    const clock = this.clockNode.offset;
    const ppq = song.ticksPerBeat;

    // Find beat boundaries in the tick window
    const firstBeat = Math.ceil(fromTick / ppq);
    const lastBeat = Math.floor(toTick / ppq);

    for (let beat = firstBeat; beat <= lastBeat; beat++) {
      if (beat <= this.lastScheduledBeat) continue;

      const beatTick = beat * ppq;
      const beatTime = this.startTime + this.ticksToSeconds(beatTick, song);

      clock.setValueAtTime(1, beatTime);
      clock.setValueAtTime(0, beatTime + CLOCK_PULSE_WIDTH);

      this.lastScheduledBeat = beat;
    }
  }

  // ── Timing conversion ──────────────────────────────────────────────────

  private ticksToSeconds(ticks: number, song: ScrollSong): number {
    return (ticks / song.ticksPerBeat) * (60 / this.tempo);
  }

  private secondsToTicks(seconds: number, song: ScrollSong): number {
    return (seconds * this.tempo * song.ticksPerBeat) / 60;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private async loadUserSongs(): Promise<void> {
    if (this.userSongsLoaded) return;
    try {
      const userSongs = await loadAllUserSongs();
      this.songs.push(...userSongs);
      this.userSongsLoaded = true;
      this.notifyStateChange();
    } catch {
      // IndexedDB may not be available — continue with built-in songs only
    }
  }

  private notifyStateChange(): void {
    this.onStateChange?.();
  }
}
