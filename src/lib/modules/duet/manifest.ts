import type { ModuleManifest } from '$lib/engine/Module.js';

export const duetManifest: ModuleManifest = {
  id: 'duet',
  name: 'Duet',
  category: 'source',
  description:
    'Three violin-inspired touch strings, bass rightmost — slide for pitch, drift sideways for a gentle bend. Vibrato is yours; held notes settle into tune. Fullscreen play for phones.',
  gridWidth: 4,
  gridHeight: 4,
  inputs: [],
  outputs: [
    { id: 'audio_out', name: 'Audio Out', type: 'audio', direction: 'output' },
  ],
  parameters: [
    {
      id: 'scale',
      name: 'Scale',
      type: 'select',
      steps: ['Chromatic', 'Hijaz', 'Bayati', 'Rast', 'Phrygian Dom.', 'Phrygian', 'Harm. Minor'],
      default: 'Chromatic',
    },
    {
      id: 'root',
      name: 'Root',
      type: 'stepped',
      min: 0,
      max: 11,
      default: 2, // D — violin-neighbor D/A open strings
    },
    {
      id: 'octave',
      name: 'Octave',
      type: 'stepped',
      min: 2,
      max: 5,
      default: 3,
    },
    {
      id: 'intonation',
      name: 'Intonation',
      type: 'continuous',
      min: 0,
      max: 1,
      default: 0.5,
    },
    {
      id: 'vibrato',
      name: 'Vibrato',
      type: 'continuous',
      min: 0,
      max: 1,
      // Vibrato comes from the player's finger — auto-vibrato is opt-in
      default: 0,
    },
    {
      id: 'level',
      name: 'Level',
      type: 'continuous',
      min: 0,
      max: 1,
      default: 0.8,
    },
  ],
};
