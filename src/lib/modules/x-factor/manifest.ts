import type { ModuleManifest } from '$lib/engine/Module.js';

export const xFactorManifest: ModuleManifest = {
  id: 'x-factor',
  name: 'X-Factor',
  category: 'effect',
  description:
    'The Tin\'s personality knob — one control from pristine digital to broken 1970s tape. Saturation, wow/flutter, hiss, rolloff; drift output for Tin Voice.',
  gridWidth: 3,
  gridHeight: 4,
  inputs: [
    { id: 'audio_in', name: 'Audio In', type: 'audio', direction: 'input' },
  ],
  outputs: [
    { id: 'audio_out', name: 'Audio Out', type: 'audio', direction: 'output' },
    { id: 'drift_out', name: 'Drift', type: 'control', direction: 'output' },
  ],
  parameters: [
    {
      id: 'x',
      name: 'X',
      type: 'continuous',
      min: 0,
      max: 1,
      default: 0.3,
    },
  ],
};
