import type { ModuleManifest } from '$lib/engine/Module.js';

export const lfoManifest: ModuleManifest = {
  id: 'lfo',
  name: 'LFO',
  category: 'modulation',
  description: 'Low frequency oscillator — modulates other parameters with slow waveforms.',
  inputs: [],
  outputs: [
    {
      id: 'cv_out',
      name: 'CV Out',
      type: 'control',
      direction: 'output',
    },
  ],
  gridWidth: 3,
  gridHeight: 4,
  parameters: [
    {
      id: 'rate',
      name: 'Rate',
      type: 'continuous',
      min: 0.01,
      max: 20,
      default: 1,
      unit: 'Hz',
    },
    {
      id: 'depth',
      name: 'Depth',
      type: 'continuous',
      min: 0,
      max: 1,
      default: 0.5,
    },
    {
      id: 'waveform',
      name: 'Waveform',
      type: 'select',
      default: 'sine',
      steps: ['sine', 'square', 'sawtooth', 'triangle'],
    },
  ],
};
