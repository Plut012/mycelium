import type { ModuleManifest } from '$lib/engine/Module.js';

export const tapeManifest: ModuleManifest = {
  id: 'tape',
  name: 'Tape',
  category: 'source',
  description: 'Audio tape player — plays back recordings with waveform display.',
  gridWidth: 10,
  gridHeight: 3,
  inputs: [],
  outputs: [
    { id: 'audio_out', name: 'Output', type: 'audio', direction: 'output' },
  ],
  parameters: [
    { id: 'volume', name: 'Vol', type: 'continuous', min: 0, max: 1, default: 0.8 },
    { id: 'speed', name: 'Speed', type: 'continuous', min: 0.25, max: 2, default: 1.0 },
    { id: 'loop', name: 'Loop', type: 'toggle', default: 1 },
  ],
};
