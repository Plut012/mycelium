import type { ModuleManifest } from '$lib/engine/Module.js';

export const freezeManifest: ModuleManifest = {
  id: 'freeze',
  name: 'Freeze',
  category: 'effect',
  description:
    'Capture the current sound into an infinite harmonic bed. Dry passes through; place several and layer beds across key changes.',
  gridWidth: 2,
  gridHeight: 4,
  inputs: [
    { id: 'audio_in', name: 'Audio In', type: 'audio', direction: 'input' },
  ],
  outputs: [
    { id: 'audio_out', name: 'Audio Out', type: 'audio', direction: 'output' },
  ],
  parameters: [
    {
      id: 'freeze',
      name: 'Freeze',
      type: 'toggle',
      default: 0,
    },
    {
      id: 'bed_level',
      name: 'Bed',
      type: 'continuous',
      min: 0,
      max: 1,
      default: 0.7,
    },
  ],
};
