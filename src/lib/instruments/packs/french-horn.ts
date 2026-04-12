/**
 * French Horn — from MusyngKite soundfont (General MIDI).
 *
 * Uses pre-rendered OGG samples from midi-js-soundfonts on GitHub Pages CDN.
 * Warm, mellow, beautiful for chords and harmony exploration.
 *
 * Source: https://github.com/gleitz/midi-js-soundfonts
 * License: MIT (soundfont rendering) / Free (original soundfont data)
 */

import type { InstrumentPack, SampleMapping } from '../types.js';

const NOTE_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

function midiToNoteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const note = NOTE_NAMES[midi % 12];
  return `${note}${octave}`;
}

const BASE_URL = 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/french_horn-ogg';

/**
 * Build sample mappings — sample every 3 semitones for reasonable load.
 * French horn practical range: F2 (MIDI 41) to C6 (MIDI 84).
 */
function buildLayer(): SampleMapping[] {
  const mappings: SampleMapping[] = [];
  for (let midi = 41; midi <= 84; midi += 3) {
    const noteName = midiToNoteName(midi);
    mappings.push({
      midi,
      url: `${BASE_URL}/${noteName}.ogg`,
    });
  }
  return mappings;
}

export const frenchHorn: InstrumentPack = {
  id: 'french-horn',
  name: 'French Horn',
  description: 'Warm, mellow brass — beautiful for chords and harmony.',
  category: 'brass',
  license: 'MIT / Free',
  velocityLayers: [buildLayer()],  // single velocity layer from soundfont
  range: { low: 41, high: 84 },
};
