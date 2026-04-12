import type { ModuleManifest } from '$lib/engine/Module.js';

export const samplerManifest: ModuleManifest = {
  id: 'sampler',
  name: 'Sampler',
  category: 'source',
  description: 'Polyphonic tone generator — warm synthesized tones for chord exploration.',
  gridWidth: 4,
  gridHeight: 5,
  inputs: [
    { id: 'note_data', name: 'Notes', type: 'spore', direction: 'input' },
  ],
  outputs: [
    { id: 'audio_out', name: 'Output', type: 'audio', direction: 'output' },
  ],
  parameters: [
    {
      id: 'tone',
      name: 'Tone',
      type: 'select',
      default: 'warm-pad',
      steps: ['warm-pad', 'nylon', 'bell', 'soft-keys'],
    },
    {
      id: 'attack',
      name: 'Attack',
      type: 'continuous',
      min: 0.001,
      max: 1,
      default: 0.02,
      unit: 's',
    },
    {
      id: 'release',
      name: 'Release',
      type: 'continuous',
      min: 0.01,
      max: 3,
      default: 0.8,
      unit: 's',
    },
    {
      id: 'brightness',
      name: 'Brightness',
      type: 'continuous',
      min: 0,
      max: 1,
      default: 0.3,
    },
    {
      id: 'volume',
      name: 'Volume',
      type: 'continuous',
      min: 0,
      max: 1,
      default: 0.6,
    },
  ],
};
