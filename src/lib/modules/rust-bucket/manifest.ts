import type { ModuleManifest } from '$lib/engine/Module.js';

export const rustBucketManifest: ModuleManifest = {
  id: 'rust-bucket',
  name: 'Rust Bucket',
  category: 'effect',
  description: '3-way dirt box: clean boost → gated velcro fuzz → rectifier octave-up. The octave only sings when fed saturation — that coupling is the sound.',
  gridWidth: 4,
  gridHeight: 4,
  inputs: [
    { id: 'audio_in', name: 'In', type: 'audio', direction: 'input' },
  ],
  outputs: [
    { id: 'audio_out', name: 'Out', type: 'audio', direction: 'output' },
  ],
  parameters: [
    { id: 'volume', name: 'Volume', type: 'continuous', min: 0, max: 1, default: 0.7 },
    { id: 'boost',  name: 'Boost',  type: 'stepped',    min: 0, max: 1, default: 1 },
    { id: 'fuzz',   name: 'Fuzz',   type: 'stepped',    min: 0, max: 1, default: 0 },
    { id: 'octave', name: 'Octave', type: 'stepped',    min: 0, max: 1, default: 0 },
  ],
};
