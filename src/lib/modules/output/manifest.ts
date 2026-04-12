import type { ModuleManifest } from '$lib/engine/Module.js';

export const outputManifest: ModuleManifest = {
  id: 'output',
  name: 'Output',
  category: 'output',
  description: 'Master audio output — connects to speakers.',
  inputs: [
    { id: 'audio_in', name: 'In', type: 'audio', direction: 'input' },
  ],
  outputs: [],
  gridWidth: 2,
  gridHeight: 4,
  parameters: [
    {
      id: 'volume',
      name: 'Vol',
      type: 'continuous',
      min: 0,
      max: 1,
      default: 0.3,
    },
  ],
};
