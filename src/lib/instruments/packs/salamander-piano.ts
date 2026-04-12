/**
 * Salamander Grand Piano — Yamaha C5 Grand, CC-BY 3.0 / Public Domain.
 *
 * Uses web-optimized OGG samples from @audio-samples packages on jsdelivr CDN.
 * Sampled every minor third (3 semitones) across the full 88-key range.
 * We load 3 velocity layers for a good balance of realism vs. load time.
 */

import type { InstrumentPack, SampleMapping } from '../types.js';

// Note name helpers
const NOTE_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

function midiToNoteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const note = NOTE_NAMES[midi % 12];
  return `${note}${octave}`;
}

/**
 * Build sample mappings for a velocity layer.
 * Salamander samples every minor third (3 semitones) from A0 (MIDI 21) to C8 (MIDI 108).
 */
function buildLayer(velocityNum: number): SampleMapping[] {
  const baseUrl = `https://cdn.jsdelivr.net/npm/@audio-samples/piano-velocity${velocityNum}/audio`;
  const mappings: SampleMapping[] = [];

  // Sample every 3 semitones from A0 (21) to C8 (108)
  for (let midi = 21; midi <= 108; midi += 3) {
    const noteName = midiToNoteName(midi);
    mappings.push({
      midi,
      url: `${baseUrl}/${noteName}.ogg`,
    });
  }

  return mappings;
}

/**
 * Salamander Grand Piano instrument pack.
 *
 * 3 velocity layers (soft, medium, loud) for expressive playing.
 * ~30 samples per layer × 3 layers = ~90 samples total.
 * Estimated total size: ~8-12MB (loaded on demand from CDN).
 */
export const salamanderPiano: InstrumentPack = {
  id: 'salamander-piano',
  name: 'Salamander Grand Piano',
  description: 'Yamaha C5 Grand Piano — warm, rich, expressive. 88 keys, 3 velocity layers.',
  category: 'piano',
  license: 'CC-BY 3.0 / Public Domain',
  velocityLayers: [
    buildLayer(4),   // soft (velocity layer 4 of 16)
    buildLayer(8),   // medium (velocity layer 8 of 16)
    buildLayer(13),  // loud (velocity layer 13 of 16)
  ],
  range: { low: 21, high: 108 },  // A0 to C8
};
