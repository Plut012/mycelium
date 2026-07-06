import type { ModuleManifest } from '$lib/engine/Module.js';

export const wahManifest: ModuleManifest = {
  id: 'wah',
  name: 'Wah',
  category: 'filter',
  description: 'Parked resonant wah — rock the lever for the vocal formant sweep, or patch an LFO/envelope into the treadle CV.',
  gridWidth: 3,
  gridHeight: 4,
  inputs: [
    { id: 'audio_in',    name: 'In',      type: 'audio',   direction: 'input' },
    { id: 'position_cv', name: 'Treadle', type: 'control', direction: 'input' },
  ],
  outputs: [
    { id: 'audio_out', name: 'Out', type: 'audio', direction: 'output' },
  ],
  parameters: [
    {
      id: 'position',
      name: 'Position',
      type: 'continuous',
      min: 0,
      max: 1,
      default: 0.45,
    },
    {
      id: 'engaged',
      name: 'Engaged',
      type: 'stepped',
      min: 0,
      max: 1,
      default: 1,
    },
  ],
};
