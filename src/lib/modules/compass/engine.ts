import { ModuleEngine } from '$lib/engine/Module.js';
import type { SporePayload } from '$lib/engine/Port.js';
import type { NoteSpore } from '$lib/modules/keyboard/engine.js';
import { midiToFreq, midiToName, computeIntervals, identifyChord } from '$lib/modules/keyboard/music.js';
import type { DegreeSpore } from '$lib/modules/tin-keys/engine.js';
import { degreeToMidi, type RootName, type ModeName } from './theory.js';

/**
 * Compass engine — degree-spores in, note-spores out. No AudioNodes.
 *
 * Emits the same NoteSpore shape as the Keyboard module, so anything that
 * plays notes (Tin Voice, Sampler, ...) works downstream unchanged.
 */
export class CompassEngine extends ModuleEngine {
  private root: RootName = 'C';
  private mode: ModeName = 'Ionian';
  private baseOctave = 4;

  /** Last degrees received — kept so a root/mode turn re-pitches held notes */
  private heldDegrees: DegreeSpore['active'] = [];

  private sporeUnsub: (() => void) | null = null;

  create(_ctx: AudioContext): void {
    this.sporeUnsub = this.onSpore('degree_in', (data: SporePayload) => {
      if (data.kind !== 'degree') return;
      this.heldDegrees = (data as unknown as DegreeSpore).active;
      this.emit();
    });
  }

  private emit(): void {
    const notes = [
      ...new Set(
        this.heldDegrees.map((d) =>
          degreeToMidi(d.degree, d.octave, this.root, this.mode, this.baseOctave)
        )
      ),
    ].sort((a, b) => a - b);

    const spore: NoteSpore = {
      activeNotes: notes,
      frequencies: notes.map(midiToFreq),
      noteNames: notes.map(midiToName),
      intervals: computeIntervals(notes),
      chordName: identifyChord(notes),
    };
    this.emitSpore('note_out', spore as unknown as Record<string, unknown>);
  }

  setParameter(name: string, value: number | string): void {
    switch (name) {
      case 'root':
        this.root = value as RootName;
        break;
      case 'mode':
        this.mode = value as ModeName;
        break;
      case 'octave':
        this.baseOctave = Math.round(value as number);
        break;
      default:
        return;
    }
    // Live key-change is a core Tin gesture — re-pitch anything held
    if (this.heldDegrees.length > 0) this.emit();
  }

  getRoot(): RootName {
    return this.root;
  }

  getMode(): ModeName {
    return this.mode;
  }

  getAnalyserNode(): AnalyserNode | null {
    return null;
  }

  destroy(): void {
    if (this.sporeUnsub) { this.sporeUnsub(); this.sporeUnsub = null; }
    // Silence anything still sounding downstream
    this.heldDegrees = [];
    this.emit();
    this.inputNodes.clear();
    this.outputNodes.clear();
  }
}
