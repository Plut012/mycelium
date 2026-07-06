import type { ModuleManifest } from '$lib/engine/Module.js';

export const bluesbreakerManifest: ModuleManifest = {
  id: 'bluesbreaker',
  name: 'Bluesbreaker',
  category: 'effect',
  description: 'Throne of Tone, Bluesbreaker voicing — mid push, spongier feel, mild compression. The finisher after the wah.',
  gridWidth: 4,
  gridHeight: 5,
  inputs: [
    { id: 'audio_in',  name: 'In',        type: 'audio',   direction: 'input' },
    { id: 'gain_cv',   name: 'Gain CV',   type: 'control', direction: 'input' },
    { id: 'volume_cv', name: 'Volume CV', type: 'control', direction: 'input' },
  ],
  outputs: [
    { id: 'audio_out', name: 'Out', type: 'audio', direction: 'output' },
  ],
  parameters: [
    { id: 'volume',    name: 'Volume',     type: 'continuous', min: 0, max: 1, default: 0.6 },
    { id: 'gain',      name: 'Gain',       type: 'continuous', min: 0, max: 1, default: 0.4 },
    { id: 'tone',      name: 'Tone',       type: 'continuous', min: 0, max: 1, default: 0.5 },
    { id: 'presence',  name: 'Presence',   type: 'continuous', min: 0, max: 1, default: 0.3 },
    { id: 'engaged',   name: 'Engaged',    type: 'stepped',    min: 0, max: 1, default: 1 },
  ],
};
