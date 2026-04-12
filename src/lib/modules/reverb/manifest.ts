import type { ModuleManifest } from '$lib/engine/Module.js';

export const reverbManifest: ModuleManifest = {
  id: 'reverb',
  name: 'Reverb',
  category: 'effect',
  description: 'Convolution reverb — adds natural room space and warmth.',
  gridWidth: 3,
  gridHeight: 4,
  inputs: [
    { id: 'audio_in', name: 'Audio In', type: 'audio', direction: 'input' },
  ],
  outputs: [
    { id: 'audio_out', name: 'Audio Out', type: 'audio', direction: 'output' },
  ],
  parameters: [
    {
      id: 'size',
      name: 'Size',
      type: 'select',
      steps: ['small', 'medium', 'large', 'hall'],
      default: 'medium',
    },
    {
      id: 'decay',
      name: 'Decay',
      type: 'continuous',
      min: 0.1,
      max: 6,
      default: 2,
      unit: 's',
    },
    {
      id: 'mix',
      name: 'Mix',
      type: 'continuous',
      min: 0,
      max: 1,
      default: 0.35,
    },
    {
      id: 'damping',
      name: 'Damping',
      type: 'continuous',
      min: 0,
      max: 1,
      default: 0.5,
    },
  ],
};
