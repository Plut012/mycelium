/**
 * Trombone — from MusyngKite soundfont (General MIDI).
 *
 * Rich, warm low brass. Excellent for bass lines and warm chords.
 * Source: https://github.com/gleitz/midi-js-soundfonts
 */

import type { InstrumentPack, SampleMapping } from '../types.js';

const NOTE_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

function midiToNoteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[midi % 12]}${octave}`;
}

const BASE_URL = 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/trombone-ogg';

function buildLayer(): SampleMapping[] {
  const mappings: SampleMapping[] = [];
  // Trombone range: E2 (MIDI 40) to Bb4 (MIDI 70)
  for (let midi = 40; midi <= 70; midi += 3) {
    mappings.push({ midi, url: `${BASE_URL}/${midiToNoteName(midi)}.ogg` });
  }
  return mappings;
}

export const trombone: InstrumentPack = {
  id: 'trombone',
  name: 'Trombone',
  description: 'Rich, warm low brass — deep and expressive.',
  category: 'brass',
  license: 'MIT / Free',
  velocityLayers: [buildLayer()],
  range: { low: 40, high: 70 },
};
