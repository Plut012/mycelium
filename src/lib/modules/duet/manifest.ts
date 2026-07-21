import type { ModuleManifest } from '$lib/engine/Module.js';

export const duetManifest: ModuleManifest = {
  id: 'duet',
  name: 'Duet',
  category: 'source',
  description:
    'Two violin-inspired touch strings — slide for pitch, drift sideways for a gentle bend, hold still for vibrato. Fullscreen play for phones.',
  gridWidth: 4,
  gridHeight: 4,
  inputs: [],
  outputs: [
    { id: 'audio_out', name: 'Audio Out', type: 'audio', direction: 'output' },
  ],
  parameters: [
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
      default: 0.4,
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
