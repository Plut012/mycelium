/**
 * Trumpet — from MusyngKite soundfont (General MIDI).
 *
 * Bright, clear brass. Great for melodies over chord pads.
 * Source: https://github.com/gleitz/midi-js-soundfonts
 */

import type { InstrumentPack, SampleMapping } from '../types.js';

const NOTE_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

function midiToNoteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[midi % 12]}${octave}`;
}

const BASE_URL = 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/trumpet-ogg';

function buildLayer(): SampleMapping[] {
  const mappings: SampleMapping[] = [];
  // Trumpet range: E3 (MIDI 52) to C6 (MIDI 84)
  for (let midi = 52; midi <= 84; midi += 3) {
    mappings.push({ midi, url: `${BASE_URL}/${midiToNoteName(midi)}.ogg` });
  }
  return mappings;
}

export const trumpet: InstrumentPack = {
  id: 'trumpet',
  name: 'Trumpet',
  description: 'Bright, clear brass — cuts through with clarity.',
  category: 'brass',
  license: 'MIT / Free',
  velocityLayers: [buildLayer()],
  range: { low: 52, high: 84 },
};
