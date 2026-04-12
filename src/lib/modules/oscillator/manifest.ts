import type { ModuleManifest } from '$lib/engine/Module.js';

export const oscillatorManifest: ModuleManifest = {
  id: 'oscillator',
  name: 'Oscillator',
  category: 'source',
  description: 'Generates a periodic waveform — the basic sound source of any patch.',
  inputs: [
    {
      id: 'frequency',
      name: 'Freq CV',
      type: 'control',
      direction: 'input',
    },
  ],
  outputs: [
    {
      id: 'audio_out',
      name: 'Output',
      type: 'audio',
      direction: 'output',
    },
  ],
  gridWidth: 3,
  gridHeight: 5,
  parameters: [
    {
      id: 'frequency',
      name: 'Freq',
      type: 'continuous',
      min: 20,
      max: 20000,
      default: 440,
      unit: 'Hz',
    },
    {
      id: 'waveform',
      name: 'Waveform',
      type: 'select',
      default: 'sine',
      steps: ['sine', 'square', 'sawtooth', 'triangle'],
    },
    {
      id: 'detune',
      name: 'Detune',
      type: 'continuous',
      min: -100,
      max: 100,
      default: 0,
      unit: 'ct',
    },
  ],
};
