import { HexKeyboardEngine } from '../hex-keyboard/engine.js';

/**
 * QwertyHexEngine — isomorphic hex keyboard driven by the physical keyboard.
 *
 * Same harmonic-table layout as Hex Keys (right = +4 semitones, next row
 * down = +3), but one hex per physical key in the four QWERTY letter/number
 * rows, including the punctuation keys (- = [ ] ; ' , . /).
 * The physical row stagger of a keyboard already matches the hex-grid
 * stagger, so the on-screen grid mirrors the keys under your fingers.
 *
 * Keys are matched by `KeyboardEvent.code` (physical position), so the
 * layout stays isomorphic on AZERTY/QWERTZ hardware too.
 */

export interface QwertyHexCell {
  /** KeyboardEvent.code for the physical key */
  code: string;
  /** Key-cap label shown on the hex (US layout) */
  label: string;
  /** Axial hex column — +1 = +4 semitones */
  q: number;
  /** Axial hex row — +1 = +3 semitones, staggered right like keyboard rows */
  r: number;
}

const ROWS: { codes: string[]; labels: string[] }[] = [
  {
    codes: ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal'],
    labels: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='],
  },
  {
    codes: ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP', 'BracketLeft', 'BracketRight'],
    labels: ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']'],
  },
  {
    codes: ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'Quote'],
    labels: ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'"],
  },
  {
    codes: ['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'Period', 'Slash'],
    labels: ['Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/'],
  },
];

export const QWERTY_HEX_LAYOUT: QwertyHexCell[] = ROWS.flatMap((row, r) =>
  row.codes.map((code, q) => ({ code, label: row.labels[q], q, r }))
);

const CODE_TO_CELL = new Map(QWERTY_HEX_LAYOUT.map((cell) => [cell.code, cell]));

/** Same interval formula as the touch Hex Keys module. */
export function cellToMidi(q: number, r: number, baseOctave: number): number {
  return (baseOctave + 1) * 12 + q * 4 + r * 3;
}

export class QwertyHexEngine extends HexKeyboardEngine {
  /** code → sounding midi note, so keyup releases the note that keydown started */
  private pressedKeys = new Map<string, number>();

  private boundKeyDown: ((e: KeyboardEvent) => void) | null = null;
  private boundKeyUp: ((e: KeyboardEvent) => void) | null = null;
  private boundBlur: (() => void) | null = null;

  create(ctx: AudioContext): void {
    super.create(ctx);

    this.boundKeyDown = (e) => this.handleKeyDown(e);
    this.boundKeyUp = (e) => this.handleKeyUp(e);
    // Focus steal (e.g. Firefox quick-find on ' or /) swallows keyups —
    // release everything when the window loses focus
    this.boundBlur = () => {
      this.pressedKeys.clear();
      this.releaseAllNotes();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.boundKeyDown);
      window.addEventListener('keyup', this.boundKeyUp);
      window.addEventListener('blur', this.boundBlur);
    }
  }

  private handleKeyDown(e: KeyboardEvent): void {
    // Leave browser/system shortcuts alone
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;

    const cell = CODE_TO_CELL.get(e.code);
    if (!cell) return;

    const midi = cellToMidi(cell.q, cell.r, this.getBaseOctave());
    if (midi < 0 || midi > 127) return;

    // preventDefault even on auto-repeat — an unprevented repeat can still
    // trigger browser find-as-you-type and steal focus mid-note
    e.preventDefault();
    if (e.repeat) return;

    this.pressedKeys.set(e.code, midi);
    this.noteOn(midi);
  }

  private handleKeyUp(e: KeyboardEvent): void {
    const midi = this.pressedKeys.get(e.code);
    if (midi === undefined) return;
    this.pressedKeys.delete(e.code);
    this.noteOff(midi);
  }

  setParameter(name: string, value: number | string): void {
    // Octave change releases all notes in the base engine — drop stale key holds too
    if (name === 'octave') this.pressedKeys.clear();
    super.setParameter(name, value);
  }

  destroy(): void {
    if (typeof window !== 'undefined') {
      if (this.boundKeyDown) window.removeEventListener('keydown', this.boundKeyDown);
      if (this.boundKeyUp) window.removeEventListener('keyup', this.boundKeyUp);
      if (this.boundBlur) window.removeEventListener('blur', this.boundBlur);
    }
    this.boundKeyDown = null;
    this.boundKeyUp = null;
    this.boundBlur = null;
    this.pressedKeys.clear();
    super.destroy();
  }
}
