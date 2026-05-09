import type { ModuleManifest } from '$lib/engine/Module.js';

export const scrollManifest: ModuleManifest = {
  id: 'scroll',
  name: 'Scroll',
  category: 'source',
  description: 'Jukebox MIDI player — plays note sequences with CV, gate, and clock output.',
  gridWidth: 3,
  gridHeight: 6,
  inputs: [],
  outputs: [
    { id: 'cv_out', name: 'CV', type: 'control', direction: 'output' },
    { id: 'gate_out', name: 'Gate', type: 'control', direction: 'output' },
    { id: 'clock_out', name: 'Clock', type: 'control', direction: 'output' },
    { id: 'note_data', name: 'Spore', type: 'spore', direction: 'output' },
  ],
  parameters: [
    { id: 'tempo', name: 'BPM', type: 'continuous', min: 40, max: 240, default: 120, unit: 'bpm' },
    { id: 'transpose', name: 'Trans', type: 'stepped', min: -24, max: 24, default: 0 },
    { id: 'loop', name: 'Loop', type: 'toggle', default: 1 },
  ],
};
