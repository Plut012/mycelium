import type { ModuleManifest } from '$lib/engine/Module.js';

export const envelopeManifest: ModuleManifest = {
  id: 'envelope',
  name: 'Envelope',
  category: 'modulation',
  description: 'ADSR envelope — shapes amplitude over time when triggered by a gate signal.',
  inputs: [
    {
      id: 'gate_in',
      name: 'Gate',
      type: 'control',
      direction: 'input',
    },
  ],
  outputs: [
    {
      id: 'cv_out',
      name: 'CV Out',
      type: 'control',
      direction: 'output',
    },
  ],
  gridWidth: 3,
  gridHeight: 5,
  parameters: [
    {
      id: 'attack',
      name: 'Attack',
      type: 'continuous',
      min: 0.001,
      max: 2,
      default: 0.01,
      unit: 's',
    },
    {
      id: 'decay',
      name: 'Decay',
      type: 'continuous',
      min: 0.001,
      max: 2,
      default: 0.2,
      unit: 's',
    },
    {
      id: 'sustain',
      name: 'Sustain',
      type: 'continuous',
      min: 0,
      max: 1,
      default: 0.7,
    },
    {
      id: 'release',
      name: 'Release',
      type: 'continuous',
      min: 0.001,
      max: 3,
      default: 0.3,
      unit: 's',
    },
  ],
};
