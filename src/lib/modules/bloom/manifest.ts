import type { ModuleManifest } from '$lib/engine/Module.js';

export const bloomManifest: ModuleManifest = {
  id: 'bloom',
  name: 'Bloom',
  category: 'modulation',
  description:
    'The Tin\'s Time knob — one control from held drone through slow arpeggio to fast shimmering wash. How fast the instrument breathes.',
  gridWidth: 3,
  gridHeight: 4,
  inputs: [
    { id: 'note_in', name: 'Notes', type: 'spore', direction: 'input' },
  ],
  outputs: [
    { id: 'note_out', name: 'Notes', type: 'spore', direction: 'output' },
  ],
  parameters: [
    {
      id: 'time',
      name: 'Time',
      type: 'continuous',
      min: 0,
      max: 1,
      default: 0,
    },
  ],
};
