import type { ModuleManifest } from '$lib/engine/Module.js';

export const qwertyHexManifest: ModuleManifest = {
  id: 'hex-qwerty',
  name: 'Hex Qwerty',
  category: 'source',
  description: 'Isomorphic hex keyboard played on the physical QWERTY keys — same chord shapes as Hex Keys, one hex per key across all four rows.',
  gridWidth: 11,
  gridHeight: 4,
  inputs: [],
  outputs: [
    { id: 'cv_out',    name: 'CV',    type: 'control', direction: 'output' },
    { id: 'gate_out',  name: 'Gate',  type: 'control', direction: 'output' },
    { id: 'note_data', name: 'Spore', type: 'spore',   direction: 'output' },
  ],
  parameters: [
    {
      id: 'octave',
      name: 'Octave',
      type: 'stepped',
      min: 1,
      max: 7,
      default: 3,
    },
    {
      id: 'velocity',
      name: 'Velocity',
      type: 'continuous',
      min: 0,
      max: 1,
      default: 0.8,
    },
  ],
};
