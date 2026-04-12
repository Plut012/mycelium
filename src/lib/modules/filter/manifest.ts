import type { ModuleManifest } from '$lib/engine/Module.js';

export const filterManifest: ModuleManifest = {
  id: 'filter',
  name: 'Filter',
  category: 'filter',
  description: 'Biquad filter — lowpass, highpass, bandpass, notch.',
  inputs: [
    { id: 'audio_in', name: 'In', type: 'audio', direction: 'input' },
    { id: 'cutoff_cv', name: 'CV', type: 'control', direction: 'input' },
  ],
  outputs: [
    { id: 'audio_out', name: 'Out', type: 'audio', direction: 'output' },
  ],
  gridWidth: 3,
  gridHeight: 5,
  parameters: [
    {
      id: 'frequency',
      name: 'Cutoff',
      type: 'continuous',
      min: 20,
      max: 20000,
      default: 1000,
      unit: 'Hz',
    },
    {
      id: 'Q',
      name: 'Res',
      type: 'continuous',
      min: 0.0001,
      max: 30,
      default: 1,
    },
    {
      id: 'type',
      name: 'Type',
      type: 'select',
      default: 'lowpass',
      steps: ['lowpass', 'highpass', 'bandpass', 'notch'],
    },
  ],
};
