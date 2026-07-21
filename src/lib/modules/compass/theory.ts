/**
 * Theory tables for the Compass module.
 *
 * Roots are ordered around the Circle of Fifths — adjacent positions are a
 * fifth apart. This ordering is the point of the control; never sort it
 * chromatically.
 */

export const CIRCLE_OF_FIFTHS = [
  'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F',
] as const;

export type RootName = (typeof CIRCLE_OF_FIFTHS)[number];

/** Pitch class (semitones above C) for each root */
export const ROOT_PITCH_CLASS: Record<RootName, number> = {
  C: 0, G: 7, D: 2, A: 9, E: 4, B: 11, 'F#': 6, Db: 1, Ab: 8, Eb: 3, Bb: 10, F: 5,
};

/** The Tin's six modes — Locrian deliberately omitted, matching the hardware */
export const MODE_NAMES = [
  'Ionian', 'Dorian', 'Phrygian', 'Lydian', 'Mixolydian', 'Aeolian',
] as const;

export type ModeName = (typeof MODE_NAMES)[number];

/** Semitone offsets of degrees I–VII for each mode */
export const MODE_INTERVALS: Record<ModeName, number[]> = {
  Ionian:     [0, 2, 4, 5, 7, 9, 11],
  Dorian:     [0, 2, 3, 5, 7, 9, 10],
  Phrygian:   [0, 1, 3, 5, 7, 8, 10],
  Lydian:     [0, 2, 4, 6, 7, 9, 11],
  Mixolydian: [0, 2, 4, 5, 7, 9, 10],
  Aeolian:    [0, 2, 3, 5, 7, 8, 10],
};

/**
 * Map a scale degree to a MIDI note.
 * @param degree 1–7
 * @param padOctave 0 (bottom row) or 1 (top row)
 * @param baseOctave octave of degree 1, row 0 (MIDI: octave N starts at (N+1)*12)
 */
export function degreeToMidi(
  degree: number,
  padOctave: number,
  root: RootName,
  mode: ModeName,
  baseOctave: number
): number {
  const interval = MODE_INTERVALS[mode][(degree - 1) % 7];
  return (baseOctave + 1 + padOctave) * 12 + ROOT_PITCH_CLASS[root] + interval;
}
