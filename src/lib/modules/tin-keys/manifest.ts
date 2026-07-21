import type { ModuleManifest } from '$lib/engine/Module.js';

export const tinKeysManifest: ModuleManifest = {
  id: 'tin-keys',
  name: 'Tin Keys',
  category: 'source',
  description:
    'The Tin touch keyboard — 2×7 pads playing scale degrees I–VII. Emits degrees, not pitches; patch into Compass to pick a key.',
  gridWidth: 5,
  gridHeight: 3,
  inputs: [],
  outputs: [
    { id: 'degree_out', name: 'Degree', type: 'spore', direction: 'output' },
  ],
  parameters: [],
};
