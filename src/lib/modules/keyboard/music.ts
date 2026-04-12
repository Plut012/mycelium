/**
 * Music theory utilities for the Keyboard module.
 *
 * MIDI note 60 = C4 (middle C). A4 = 69 = 440 Hz.
 */

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** Convert MIDI note number to frequency in Hz. */
export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Convert MIDI note number to note name (e.g., 60 -> "C4"). */
export function midiToName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const note = NOTE_NAMES[midi % 12];
  return `${note}${octave}`;
}

/** Compute intervals in semitones from the lowest note. */
export function computeIntervals(notes: number[]): number[] {
  if (notes.length === 0) return [];
  const sorted = [...notes].sort((a, b) => a - b);
  const root = sorted[0];
  return sorted.map((n) => n - root);
}

/**
 * Identify a chord from a set of intervals (semitones from root).
 * Returns chord name or null if unrecognized.
 *
 * Keeps it simple — recognizes common triads and seventh chords.
 */
export function identifyChord(notes: number[]): string | null {
  if (notes.length < 2) return null;

  const sorted = [...notes].sort((a, b) => a - b);
  const root = sorted[0];
  const rootName = NOTE_NAMES[root % 12];

  // Normalize to pitch classes relative to root
  const intervals = new Set(sorted.map((n) => ((n - root) % 12 + 12) % 12));

  // Check from most specific (4-note) to least (2-note)
  // Seventh chords
  if (intervals.has(0) && intervals.has(4) && intervals.has(7) && intervals.has(11)) return `${rootName}maj7`;
  if (intervals.has(0) && intervals.has(4) && intervals.has(7) && intervals.has(10)) return `${rootName}7`;
  if (intervals.has(0) && intervals.has(3) && intervals.has(7) && intervals.has(10)) return `${rootName}m7`;
  if (intervals.has(0) && intervals.has(3) && intervals.has(6) && intervals.has(10)) return `${rootName}m7b5`;
  if (intervals.has(0) && intervals.has(3) && intervals.has(6) && intervals.has(9))  return `${rootName}dim7`;

  // Triads
  if (intervals.has(0) && intervals.has(4) && intervals.has(7)) return `${rootName}maj`;
  if (intervals.has(0) && intervals.has(3) && intervals.has(7)) return `${rootName}min`;
  if (intervals.has(0) && intervals.has(3) && intervals.has(6)) return `${rootName}dim`;
  if (intervals.has(0) && intervals.has(4) && intervals.has(8)) return `${rootName}aug`;
  if (intervals.has(0) && intervals.has(5) && intervals.has(7)) return `${rootName}sus4`;
  if (intervals.has(0) && intervals.has(2) && intervals.has(7)) return `${rootName}sus2`;

  // Dyads (intervals)
  if (intervals.has(0) && intervals.has(7))  return `${rootName}5`;
  if (intervals.has(0) && intervals.has(4))  return `${rootName} (maj 3rd)`;
  if (intervals.has(0) && intervals.has(3))  return `${rootName} (min 3rd)`;
  if (intervals.has(0) && intervals.has(5))  return `${rootName} (4th)`;

  return null;
}

/**
 * Standard musical typing keyboard map.
 *
 * Bottom two rows = lower octave, top two rows = upper octave.
 * Returns the semitone offset from the base octave, or null if unmapped.
 */
const KEY_MAP: Record<string, number> = {
  // Lower octave — naturals (Z row)
  'z': 0,   // C
  'x': 2,   // D
  'c': 4,   // E
  'v': 5,   // F
  'b': 7,   // G
  'n': 9,   // A
  'm': 11,  // B
  ',': 12,  // C+1

  // Lower octave — sharps (S row)
  's': 1,   // C#
  'd': 3,   // D#
  'g': 6,   // F#
  'h': 8,   // G#
  'j': 10,  // A#

  // Upper octave — naturals (Q row)
  'q': 12,  // C
  'w': 14,  // D
  'e': 16,  // E
  'r': 17,  // F
  't': 19,  // G
  'y': 21,  // A
  'u': 23,  // B
  'i': 24,  // C+1
  'o': 26,  // D+1
  'p': 28,  // E+1

  // Upper octave — sharps (number row)
  '2': 13,  // C#
  '3': 15,  // D#
  '5': 18,  // F#
  '6': 20,  // G#
  '7': 22,  // A#
  '9': 25,  // C#+1
  '0': 27,  // D#+1
};

/** Get MIDI note number for a keyboard key, given a base octave. */
export function keyToMidi(key: string, baseOctave: number): number | null {
  const offset = KEY_MAP[key.toLowerCase()];
  if (offset === undefined) return null;
  // MIDI: C4 = 60, so octave N starts at (N+1)*12
  return (baseOctave + 1) * 12 + offset;
}

/** Get all mapped keyboard keys (for rendering the visual keyboard). */
export function getMappedKeys(): { key: string; semitone: number; isSharp: boolean }[] {
  return Object.entries(KEY_MAP).map(([key, semitone]) => ({
    key,
    semitone,
    isSharp: [1, 3, 6, 8, 10, 13, 15, 18, 20, 22, 25, 27].includes(semitone),
  }));
}

export { KEY_MAP, NOTE_NAMES };
