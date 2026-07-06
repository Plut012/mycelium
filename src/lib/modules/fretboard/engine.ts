import { HexKeyboardEngine } from '../hex-keyboard/engine.js';

/**
 * FretboardEngine — four virtual strings in all-fourths tuning, played on
 * the physical keyboard. Each QWERTY row is a string (Z-row = lowest, E),
 * each key to the right is one fret higher; the leftmost key is the open
 * string. Rows are tuned a fourth apart (+5 semitones), like a bass.
 *
 * The rule that makes it feel like a guitar: each string is monophonic.
 * The highest held fret on a row sounds; pressing a higher fret takes over
 * (hammer-on) and releasing it falls back to the next held fret below
 * (pull-off). Keys are matched by KeyboardEvent.code (physical position).
 */

export interface FretPosition {
  /** KeyboardEvent.code for the physical key */
  code: string;
  /** Key-cap label shown on the fretboard (US layout) */
  label: string;
  /** String index — 0 = lowest (E, Z-row) up to 3 (G, number row) */
  string: number;
  /** Fret number — 0 = open string (leftmost key) */
  fret: number;
}

export const STRING_COUNT = 4;

// index = keyboard row from the bottom (0 = Z-row).
// Standard mode: row index = string number (Z-row = low E, frets ascend rightward).
// Mirror ("guitar") mode: both axes flip — the NUMBER row is low E and the
// RIGHTMOST key of each row is the open string ('=', ']', "'", '/'), so the
// fretting hand moves toward the nut the way it does on a real neck.
const STRING_ROWS: { codes: string[]; labels: string[] }[] = [
  {
    codes: ['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'Period', 'Slash'],
    labels: ['Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/'],
  },
  {
    codes: ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'Quote'],
    labels: ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'"],
  },
  {
    codes: ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP', 'BracketLeft', 'BracketRight'],
    labels: ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']'],
  },
  {
    codes: ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal'],
    labels: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='],
  },
];

export function buildFretboardLayout(mirrored: boolean): FretPosition[] {
  return STRING_ROWS.flatMap((row, rowIdx) =>
    row.codes.map((code, keyIdx) => ({
      code,
      label: row.labels[keyIdx],
      string: mirrored ? STRING_COUNT - 1 - rowIdx : rowIdx,
      fret: mirrored ? row.codes.length - 1 - keyIdx : keyIdx,
    }))
  );
}

/** Open low string = E of the base octave (default octave 2 → E2, a guitar's low E). */
export function positionToMidi(string: number, fret: number, baseOctave: number): number {
  return (baseOctave + 1) * 12 + 4 + string * 5 + fret;
}

interface SoundingNote {
  fret: number;
  midi: number;
}

export class FretboardEngine extends HexKeyboardEngine {
  /** Frets currently held down on each string (from keys and pointer alike) */
  private heldFrets: Set<number>[] = Array.from({ length: STRING_COUNT }, () => new Set<number>());
  /** The note each string is currently sounding, if any */
  private sounding: (SoundingNote | null)[] = Array(STRING_COUNT).fill(null);

  private mirrored = false;
  private codeMap = new Map(buildFretboardLayout(false).map((p) => [p.code, p]));

  private boundKeyDown: ((e: KeyboardEvent) => void) | null = null;
  private boundKeyUp: ((e: KeyboardEvent) => void) | null = null;
  private boundBlur: (() => void) | null = null;

  create(ctx: AudioContext): void {
    super.create(ctx);

    this.boundKeyDown = (e) => this.handleKeyDown(e);
    this.boundKeyUp = (e) => this.handleKeyUp(e);
    // Focus steal (e.g. Firefox quick-find on ' or /) swallows keyups —
    // release everything when the window loses focus
    this.boundBlur = () => this.releaseAll();

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.boundKeyDown);
      window.addEventListener('keyup', this.boundKeyUp);
      window.addEventListener('blur', this.boundBlur);
    }
  }

  // ── Fret API — shared by key handlers and the UI's pointer events ────────

  pressFret(string: number, fret: number): void {
    this.heldFrets[string].add(fret);
    this.resolveString(string);
  }

  releaseFret(string: number, fret: number): void {
    this.heldFrets[string].delete(fret);
    this.resolveString(string);
  }

  /** Highest held fret per string wins — hammer-ons and pull-offs fall out of this. */
  private resolveString(string: number): void {
    const held = this.heldFrets[string];
    const targetFret = held.size > 0 ? Math.max(...held) : null;
    const current = this.sounding[string];

    if (current?.fret === targetFret) return;

    // Release the current note — unless another string is sounding the same pitch
    this.sounding[string] = null;
    if (current && !this.isSounding(current.midi)) {
      this.noteOff(current.midi);
    }

    if (targetFret !== null) {
      const midi = positionToMidi(string, targetFret, this.getBaseOctave());
      if (midi >= 0 && midi <= 127) {
        const unison = this.isSounding(midi);
        this.sounding[string] = { fret: targetFret, midi };
        if (!unison) this.noteOn(midi);
      }
    }
  }

  private isSounding(midi: number): boolean {
    return this.sounding.some((n) => n !== null && n.midi === midi);
  }

  // ── Physical key handling ─────────────────────────────────────────────────

  private handleKeyDown(e: KeyboardEvent): void {
    // Leave browser/system shortcuts alone
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;

    const pos = this.codeMap.get(e.code);
    if (!pos) return;

    // preventDefault even on auto-repeat — an unprevented repeat can still
    // trigger browser find-as-you-type and steal focus mid-note
    e.preventDefault();
    if (e.repeat) return;

    this.pressFret(pos.string, pos.fret);
  }

  private handleKeyUp(e: KeyboardEvent): void {
    const pos = this.codeMap.get(e.code);
    if (!pos) return;
    this.releaseFret(pos.string, pos.fret);
  }

  /** Silence everything and drop all fretting state — for mode/octave flips. */
  private releaseAll(): void {
    const midis = new Set(
      this.sounding.filter((n): n is SoundingNote => n !== null).map((n) => n.midi)
    );
    this.sounding.fill(null);
    for (const held of this.heldFrets) held.clear();
    for (const m of midis) this.noteOff(m);
  }

  // ── Parameters ────────────────────────────────────────────────────────────

  setParameter(name: string, value: number | string): void {
    if (name === 'mirror') {
      const next = (value as number) > 0.5;
      if (next !== this.mirrored) {
        this.mirrored = next;
        this.codeMap = new Map(buildFretboardLayout(next).map((p) => [p.code, p]));
        this.releaseAll();
      }
      return;
    }
    // Octave change releases all notes in the base engine — drop fretting state too
    if (name === 'octave') {
      for (const held of this.heldFrets) held.clear();
      this.sounding.fill(null);
    }
    super.setParameter(name, value);
  }

  isMirrored(): boolean {
    return this.mirrored;
  }

  // ── UI accessors ──────────────────────────────────────────────────────────

  getSoundingPositions(): { string: number; fret: number }[] {
    const out: { string: number; fret: number }[] = [];
    for (let s = 0; s < STRING_COUNT; s++) {
      const n = this.sounding[s];
      if (n !== null) out.push({ string: s, fret: n.fret });
    }
    return out;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  destroy(): void {
    if (typeof window !== 'undefined') {
      if (this.boundKeyDown) window.removeEventListener('keydown', this.boundKeyDown);
      if (this.boundKeyUp) window.removeEventListener('keyup', this.boundKeyUp);
      if (this.boundBlur) window.removeEventListener('blur', this.boundBlur);
    }
    this.boundKeyDown = null;
    this.boundKeyUp = null;
    this.boundBlur = null;
    for (const held of this.heldFrets) held.clear();
    this.sounding.fill(null);
    super.destroy();
  }
}
