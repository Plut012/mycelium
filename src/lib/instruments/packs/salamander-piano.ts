/**
 * Salamander Grand Piano — Yamaha C5 Grand, CC-BY 3.0 / Public Domain.
 *
 * Uses MP3 samples from the Tone.js audio CDN on GitHub Pages.
 * Sampled every minor third (3 semitones) across the full 88-key range.
 * Single velocity layer (medium) for fast loading.
 */

import type { InstrumentPack, SampleMapping } from '../types.js';

// Tone.js salamander uses sharps written as 's' (e.g., Fs4, Ds3)
const NOTE_NAMES = ['C', 'Cs', 'D', 'Ds', 'E', 'F', 'Fs', 'G', 'Gs', 'A', 'As', 'B'];

function midiToNoteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const note = NOTE_NAMES[midi % 12];
  return `${note}${octave}`;
}

const BASE_URL = 'https://tonejs.github.io/audio/salamander';

/**
 * Build sample mappings.
 * Salamander has samples every minor 3rd: A, C, Ds, Fs from A0 to C8.
 */
function buildLayer(): SampleMapping[] {
  const mappings: SampleMapping[] = [];
  // The available notes follow the pattern: A, C, Ds, Fs across octaves
  for (let midi = 21; midi <= 108; midi += 3) {
    const noteName = midiToNoteName(midi);
    mappings.push({
      midi,
      url: `${BASE_URL}/${noteName}.mp3`,
    });
  }
  return mappings;
}

/**
 * Salamander Grand Piano instrument pack.
 *
 * Single velocity layer for fast loading (~30 samples, ~3-5MB).
 */
export const salamanderPiano: InstrumentPack = {
  id: 'salamander-piano',
  name: 'Salamander Grand Piano',
  description: 'Yamaha C5 Grand Piano — warm, rich, expressive. 88 keys.',
  category: 'piano',
  license: 'CC-BY 3.0 / Public Domain',
  velocityLayers: [buildLayer()],
  range: { low: 21, high: 108 },  // A0 to C8
};
