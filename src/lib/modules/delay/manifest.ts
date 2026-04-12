import type { ModuleManifest } from '$lib/engine/Module.js';

export const delayManifest: ModuleManifest = {
  id: 'delay',
  name: 'Delay',
  category: 'effect',
  description: 'Tape-style delay with feedback.',
  inputs: [
    { id: 'audio_in', name: 'In', type: 'audio', direction: 'input' },
  ],
  outputs: [
    { id: 'audio_out', name: 'Out', type: 'audio', direction: 'output' },
  ],
  gridWidth: 3,
  gridHeight: 5,
  parameters: [
    {
      id: 'delayTime',
      name: 'Time',
      type: 'continuous',
      min: 0,
      max: 2,
      default: 0.5,
      unit: 's',
    },
    {
      id: 'feedback',
      name: 'Feedback',
      type: 'continuous',
      min: 0,
      max: 0.95,
      default: 0.3,
    },
    {
      id: 'mix',
      name: 'Mix',
      type: 'continuous',
      min: 0,
      max: 1,
      default: 0.5,
    },
  ],
};
