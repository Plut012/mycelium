import type { ModuleManifest } from '$lib/engine/Module.js';
import { CIRCLE_OF_FIFTHS, MODE_NAMES } from './theory.js';

export const compassManifest: ModuleManifest = {
  id: 'compass',
  name: 'Compass',
  category: 'modulation',
  description:
    'Circle of Fifths root + mode selector. Turns scale degrees into pitches — the key lives here, not in the keyboard.',
  gridWidth: 3,
  gridHeight: 5,
  inputs: [
    { id: 'degree_in', name: 'Degree', type: 'spore', direction: 'input' },
  ],
  outputs: [
    { id: 'note_out', name: 'Notes', type: 'spore', direction: 'output' },
  ],
  parameters: [
    {
      id: 'root',
      name: 'Root',
      type: 'select',
      steps: [...CIRCLE_OF_FIFTHS],
      default: 'C',
    },
    {
      id: 'mode',
      name: 'Mode',
      type: 'select',
      steps: [...MODE_NAMES],
      default: 'Ionian',
    },
    {
      id: 'octave',
      name: 'Octave',
      type: 'stepped',
      min: 2,
      max: 6,
      default: 4,
    },
  ],
};
