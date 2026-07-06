import { ModuleEngine } from '$lib/engine/Module.js';
import { midiToFreq, midiToName, computeIntervals, identifyChord, keyToMidi } from './music.js';

export interface NoteSpore {
  activeNotes: number[];
  frequencies: number[];
  noteNames: string[];
  intervals: number[];
  chordName: string | null;
}

/**
 * Keyboard engine — maps laptop keyboard to CV/Gate outputs + spore note data.
 *
 * CV output: constant signal at the frequency of the most recently pressed note.
 * Gate output: 1.0 while any key is held, 0.0 when all released.
 * Spore output: structured NoteSpore data with all active notes and theory info.
 */
export class KeyboardEngine extends ModuleEngine {
  private cvNode: ConstantSourceNode | null = null;
  private gateNode: ConstantSourceNode | null = null;
  private analyser: AnalyserNode | null = null;

  private activeNotes = new Set<number>();
  private baseOctave = 3;
  private velocity = 0.8;

  // Bound handlers for cleanup
  private boundKeyDown: ((e: KeyboardEvent) => void) | null = null;
  private boundKeyUp: ((e: KeyboardEvent) => void) | null = null;
  private boundBlur: (() => void) | null = null;

  create(ctx: AudioContext): void {
    // CV output: ConstantSourceNode whose value = frequency of current note
    this.cvNode = ctx.createConstantSource();
    this.cvNode.offset.value = 0;
    this.cvNode.start();

    // Gate output: ConstantSourceNode whose value = 0 or 1
    this.gateNode = ctx.createConstantSource();
    this.gateNode.offset.value = 0;
    this.gateNode.start();

    // Analyser for visualization (taps the CV for display purposes)
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.cvNode.connect(this.analyser);

    // Register ports
    this.registerOutputNode('cv_out', this.cvNode);
    this.registerOutputNode('gate_out', this.gateNode);
    // Note: cv_out actually emits the ConstantSourceNode, which downstream
    // modules connect to their frequency AudioParam via control port wiring.

    // Set up keyboard listeners
    this.boundKeyDown = (e) => this.handleKeyDown(e);
    this.boundKeyUp = (e) => this.handleKeyUp(e);
    // Focus can be stolen mid-hold (e.g. Firefox quick-find on ' or /) —
    // the keyup then lands in browser chrome and never reaches the page.
    // Releasing everything on blur guarantees no stuck notes.
    this.boundBlur = () => {
      this.activeNotes.clear();
      this.updateOutputs();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.boundKeyDown);
      window.addEventListener('keyup', this.boundKeyUp);
      window.addEventListener('blur', this.boundBlur);
    }
  }

  private handleKeyDown(e: KeyboardEvent): void {
    // Don't capture when typing in inputs
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;

    const midi = keyToMidi(e.key, this.baseOctave);
    if (midi === null) return;

    // preventDefault even on auto-repeat — an unprevented repeat can still
    // trigger browser find-as-you-type and steal focus mid-note
    e.preventDefault();
    if (e.repeat) return;

    this.activeNotes.add(midi);
    this.updateOutputs();
  }

  private handleKeyUp(e: KeyboardEvent): void {
    const midi = keyToMidi(e.key, this.baseOctave);
    if (midi === null) return;

    this.activeNotes.delete(midi);
    this.updateOutputs();
  }

  private updateOutputs(): void {
    const notes = [...this.activeNotes].sort((a, b) => a - b);

    if (notes.length > 0) {
      // CV = frequency of the highest note (last pressed, monophonic priority)
      const highestNote = notes[notes.length - 1];
      if (this.cvNode) {
        this.cvNode.offset.value = midiToFreq(highestNote);
      }
      // Gate = velocity level
      if (this.gateNode) {
        this.gateNode.offset.value = this.velocity;
      }
    } else {
      // No notes held
      if (this.cvNode) this.cvNode.offset.value = 0;
      if (this.gateNode) this.gateNode.offset.value = 0;
    }

    // Emit spore data
    const intervals = computeIntervals(notes);
    const sporeData: NoteSpore = {
      activeNotes: notes,
      frequencies: notes.map(midiToFreq),
      noteNames: notes.map(midiToName),
      intervals,
      chordName: identifyChord(notes),
    };
    this.emitSpore('note_data', sporeData);
  }

  setParameter(name: string, value: number | string): void {
    switch (name) {
      case 'octave':
        this.baseOctave = value as number;
        // Re-evaluate active notes at new octave
        this.activeNotes.clear();
        this.updateOutputs();
        break;
      case 'velocity':
        this.velocity = value as number;
        if (this.activeNotes.size > 0) {
          this.updateOutputs();
        }
        break;
    }
  }

  getAnalyserNode(): AnalyserNode | null {
    return this.analyser;
  }

  /** Expose active notes for the UI component to read directly. */
  getActiveNotes(): number[] {
    return [...this.activeNotes].sort((a, b) => a - b);
  }

  getBaseOctave(): number {
    return this.baseOctave;
  }

  destroy(): void {
    if (typeof window !== 'undefined') {
      if (this.boundKeyDown) window.removeEventListener('keydown', this.boundKeyDown);
      if (this.boundKeyUp) window.removeEventListener('keyup', this.boundKeyUp);
      if (this.boundBlur) window.removeEventListener('blur', this.boundBlur);
    }

    if (this.cvNode) { this.cvNode.stop(); this.cvNode.disconnect(); this.cvNode = null; }
    if (this.gateNode) { this.gateNode.stop(); this.gateNode.disconnect(); this.gateNode = null; }
    if (this.analyser) { this.analyser.disconnect(); this.analyser = null; }

    this.inputNodes.clear();
    this.outputNodes.clear();
    this.activeNotes.clear();
  }
}
