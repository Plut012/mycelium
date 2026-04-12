import type { ModuleManifest } from '$lib/engine/Module.js';

export const gainManifest: ModuleManifest = {
  id: 'gain',
  name: 'Gain',
  category: 'utility',
  description: 'Amplifier / attenuator — controls signal level.',
  inputs: [
    { id: 'audio_in', name: 'In', type: 'audio', direction: 'input' },
    { id: 'gain', name: 'Gain CV', type: 'control', direction: 'input' },
  ],
  outputs: [
    { id: 'audio_out', name: 'Out', type: 'audio', direction: 'output' },
  ],
  gridWidth: 2,
  gridHeight: 4,
  parameters: [
    {
      id: 'gain',
      name: 'Gain',
      type: 'continuous',
      min: 0,
      max: 2,
      default: 0.5,
    },
  ],
};
