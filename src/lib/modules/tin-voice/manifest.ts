import type { ModuleManifest } from '$lib/engine/Module.js';

export const tinVoiceManifest: ModuleManifest = {
  id: 'tin-voice',
  name: 'Tin Voice',
  category: 'source',
  description:
    'The Tin\'s polyphonic voice — sine pad, kalimba, flute, saw, bell. Sub-octave toggle for weight; drift input for X-Factor warmth.',
  gridWidth: 4,
  gridHeight: 5,
  inputs: [
    { id: 'note_in', name: 'Notes', type: 'spore', direction: 'input' },
    { id: 'drift_in', name: 'Drift', type: 'control', direction: 'input' },
  ],
  outputs: [
    { id: 'audio_out', name: 'Audio Out', type: 'audio', direction: 'output' },
  ],
  parameters: [
    {
      id: 'voice',
      name: 'Voice',
      type: 'select',
      steps: ['sine-pad', 'kalimba', 'flute', 'saw', 'bell'],
      default: 'sine-pad',
    },
    {
      id: 'sub',
      name: 'Sub',
      type: 'toggle',
      default: 0,
    },
    {
      id: 'level',
      name: 'Level',
      type: 'continuous',
      min: 0,
      max: 1,
      default: 0.8,
    },
  ],
};
