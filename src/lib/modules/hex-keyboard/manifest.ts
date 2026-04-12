import type { ModuleManifest } from '$lib/engine/Module.js';

export const hexKeyboardManifest: ModuleManifest = {
  id: 'hex-keyboard',
  name: 'Hex Keys',
  category: 'source',
  description: 'Isomorphic hexagonal keyboard — Harmonic Table layout. Every chord is the same shape.',
  gridWidth: 8,
  gridHeight: 8,
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
