import type { ModuleManifest } from '$lib/engine/Module.js';

export const audioInputManifest: ModuleManifest = {
  id: 'audio-input',
  name: 'Audio In',
  category: 'source',
  description: 'Microphone / line input from the browser.',
  inputs: [],
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
      max: 4,
      default: 1,
    },
  ],
};
