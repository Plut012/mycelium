import { ModuleEngine } from '$lib/engine/Module.js';
import { midiToFreq, midiToName, computeIntervals, identifyChord } from '../keyboard/music.js';
import type { NoteSpore } from '../keyboard/engine.js';

/**
 * HexKeyboardEngine — touch-driven isomorphic keyboard engine.
 *
 * No physical keyboard listeners. The UI component calls noteOn/noteOff
 * directly. Everything else mirrors KeyboardEngine: CV output tracks the
 * highest active note, gate output signals velocity while any note is held,
 * and a NoteSpore is emitted on every state change.
 */
export class HexKeyboardEngine extends ModuleEngine {
  private cvNode: ConstantSourceNode | null = null;
  private gateNode: ConstantSourceNode | null = null;
  private analyser: AnalyserNode | null = null;

  private activeNotes = new Set<number>();
  private baseOctave = 3;
  private velocity = 0.8;

  create(ctx: AudioContext): void {
    // CV output — frequency of the highest active note
    this.cvNode = ctx.createConstantSource();
    this.cvNode.offset.value = 0;
    this.cvNode.start();

    // Gate output — velocity while any note is held, 0 when silent
    this.gateNode = ctx.createConstantSource();
    this.gateNode.offset.value = 0;
    this.gateNode.start();

    // Analyser taps the CV for any visualisation consumers
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.cvNode.connect(this.analyser);

    this.registerOutputNode('cv_out',   this.cvNode);
    this.registerOutputNode('gate_out', this.gateNode);
  }

  // ── Touch API — called by Module.svelte ──────────────────────────────────

  noteOn(midi: number): void {
    this.activeNotes.add(midi);
    this.updateOutputs();
  }

  noteOff(midi: number): void {
    this.activeNotes.delete(midi);
    this.updateOutputs();
  }

  // ── Internal ─────────────────────────────────────────────────────────────

  private updateOutputs(): void {
    const notes = [...this.activeNotes].sort((a, b) => a - b);

    if (notes.length > 0) {
      const highest = notes[notes.length - 1];
      if (this.cvNode)   this.cvNode.offset.value   = midiToFreq(highest);
      if (this.gateNode) this.gateNode.offset.value = this.velocity;
    } else {
      if (this.cvNode)   this.cvNode.offset.value   = 0;
      if (this.gateNode) this.gateNode.offset.value = 0;
    }

    const intervals = computeIntervals(notes);
    const sporeData: NoteSpore = {
      activeNotes:  notes,
      frequencies:  notes.map(midiToFreq),
      noteNames:    notes.map(midiToName),
      intervals,
      chordName:    identifyChord(notes),
    };
    this.emitSpore('note_data', sporeData);
  }

  // ── Parameters ───────────────────────────────────────────────────────────

  setParameter(name: string, value: number | string): void {
    switch (name) {
      case 'octave':
        this.baseOctave = value as number;
        // Release all active notes — octave shift would change their MIDI values
        this.activeNotes.clear();
        this.updateOutputs();
        break;
      case 'velocity':
        this.velocity = value as number;
        if (this.activeNotes.size > 0) this.updateOutputs();
        break;
    }
  }

  // ── UI accessors ─────────────────────────────────────────────────────────

  getActiveNotes(): number[] {
    return [...this.activeNotes].sort((a, b) => a - b);
  }

  getBaseOctave(): number {
    return this.baseOctave;
  }

  getAnalyserNode(): AnalyserNode | null {
    return this.analyser;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  destroy(): void {
    if (this.cvNode)   { this.cvNode.stop();   this.cvNode.disconnect();   this.cvNode   = null; }
    if (this.gateNode) { this.gateNode.stop();  this.gateNode.disconnect(); this.gateNode = null; }
    if (this.analyser) { this.analyser.disconnect(); this.analyser = null; }

    this.inputNodes.clear();
    this.outputNodes.clear();
    this.activeNotes.clear();
  }
}
