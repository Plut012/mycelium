import type { ModuleManifest } from '$lib/engine/Module.js';

export const hammertoneManifest: ModuleManifest = {
  id: 'hammertone',
  name: 'Hammertone',
  category: 'effect',
  description: 'Fender Hammertone-style digital reverb — Hall / Room / Plate, no trails. Dry passes at unity; Level is wet-only.',
  gridWidth: 4,
  gridHeight: 4,
  inputs: [
    { id: 'audio_in', name: 'In',       type: 'audio',   direction: 'input' },
    { id: 'level_cv', name: 'Level CV', type: 'control', direction: 'input' },
  ],
  outputs: [
    { id: 'audio_out', name: 'Out', type: 'audio', direction: 'output' },
  ],
  parameters: [
    { id: 'time',    name: 'Time',    type: 'continuous', min: 0, max: 1, default: 0.4 },
    { id: 'damp',    name: 'Damp',    type: 'continuous', min: 0, max: 1, default: 0.5 },
    { id: 'level',   name: 'Level',   type: 'continuous', min: 0, max: 1, default: 0.35 },
    { id: 'tone',    name: 'Tone',    type: 'stepped',    min: 0, max: 1, default: 0 },
    { id: 'engaged', name: 'Engaged', type: 'stepped',    min: 0, max: 1, default: 1 },
  ],
};
