import type { ModuleManifest } from '$lib/engine/Module.js';

export const fretboardManifest: ModuleManifest = {
  id: 'fretboard',
  name: 'Fretboard',
  category: 'source',
  description: 'Four virtual strings in all-fourths tuning, played on the QWERTY rows — each string is monophonic, so hammer-ons and pull-offs come free.',
  gridWidth: 11,
  gridHeight: 3,
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
      max: 5,
      default: 2,
    },
    {
      id: 'velocity',
      name: 'Velocity',
      type: 'continuous',
      min: 0,
      max: 1,
      default: 0.8,
    },
    {
      id: 'mirror',
      name: 'Mirror (guitar direction)',
      type: 'stepped',
      min: 0,
      max: 1,
      default: 0,
    },
  ],
};
