import type { ModuleManifest } from '$lib/engine/Module.js';

export const squeezerManifest: ModuleManifest = {
  id: 'squeezer',
  name: 'Squeezer',
  category: 'effect',
  description: 'Ross/Dyna-style two-knob compressor — sustain and evenness at the front of the chain. Fills fuzz gates, feeds octaves.',
  gridWidth: 3,
  gridHeight: 4,
  inputs: [
    { id: 'audio_in',   name: 'In',         type: 'audio',   direction: 'input' },
    { id: 'sustain_cv', name: 'Sustain CV', type: 'control', direction: 'input' },
    { id: 'level_cv',   name: 'Level CV',   type: 'control', direction: 'input' },
  ],
  outputs: [
    { id: 'audio_out', name: 'Out', type: 'audio', direction: 'output' },
  ],
  parameters: [
    {
      id: 'sustain',
      name: 'Sustain',
      type: 'continuous',
      min: 0,
      max: 1,
      default: 0.5,
    },
    {
      id: 'level',
      name: 'Level',
      type: 'continuous',
      min: 0,
      max: 1,
      default: 0.7,
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
