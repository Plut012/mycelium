import type { ModuleManifest } from '$lib/engine/Module.js';

export const monitorManifest: ModuleManifest = {
  id: 'monitor',
  name: 'Monitor',
  category: 'utility',
  description: 'See the music — waveform, log-frequency spectrogram, chroma ring and level meter. Passes audio through untouched. Fullscreen for the full picture.',
  gridWidth: 5,
  gridHeight: 6,
  inputs: [
    { id: 'audio_in', name: 'In', type: 'audio', direction: 'input' },
  ],
  outputs: [
    { id: 'audio_out', name: 'Thru', type: 'audio', direction: 'output' },
  ],
  parameters: [],
};
