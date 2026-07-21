import type { ModuleManifest } from '$lib/engine/Module.js';

export const haloManifest: ModuleManifest = {
  id: 'halo',
  name: 'Halo',
  category: 'effect',
  description:
    'The Tin\'s reverb — a lush algorithmic tail everything sustains into, with a Shimmer toggle that feeds the tail back an octave up.',
  gridWidth: 3,
  gridHeight: 5,
  inputs: [
    { id: 'audio_in', name: 'Audio In', type: 'audio', direction: 'input' },
  ],
  outputs: [
    { id: 'audio_out', name: 'Audio Out', type: 'audio', direction: 'output' },
  ],
  parameters: [
    {
      id: 'decay',
      name: 'Decay',
      type: 'continuous',
      min: 1,
      max: 20,
      default: 6,
      unit: 's',
    },
    {
      id: 'mix',
      name: 'Mix',
      type: 'continuous',
      min: 0,
      max: 1,
      default: 0.5,
    },
    {
      id: 'damping',
      name: 'Damping',
      type: 'continuous',
      min: 0,
      max: 1,
      default: 0.4,
    },
    {
      id: 'shimmer',
      name: 'Shimmer',
      type: 'toggle',
      default: 0,
    },
    {
      id: 'shimmer_amount',
      name: 'Amount',
      type: 'continuous',
      min: 0,
      max: 1,
      default: 0.5,
    },
  ],
};
