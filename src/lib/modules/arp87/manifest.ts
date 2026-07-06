import type { ModuleManifest } from '$lib/engine/Module.js';

export const arp87Manifest: ModuleManifest = {
  id: 'arp87',
  name: 'ARP-87',
  category: 'effect',
  description: 'Walrus-style multi-algorithm delay — Digital / Analog / Lo-Fi / Slap, tap tempo, hold tap for self-oscillation swells.',
  gridWidth: 4,
  gridHeight: 5,
  inputs: [
    { id: 'audio_in',   name: 'In',         type: 'audio',   direction: 'input' },
    { id: 'time_cv',    name: 'Time CV',    type: 'control', direction: 'input' },
    { id: 'repeats_cv', name: 'Repeats CV', type: 'control', direction: 'input' },
    { id: 'x_cv',       name: 'X CV',       type: 'control', direction: 'input' },
  ],
  outputs: [
    { id: 'audio_out', name: 'Out', type: 'audio', direction: 'output' },
  ],
  parameters: [
    { id: 'level',   name: 'Level',   type: 'continuous', min: 0, max: 1, default: 0.5 },
    { id: 'dampen',  name: 'Dampen',  type: 'continuous', min: 0, max: 1, default: 0.5 },
    { id: 'repeats', name: 'Repeats', type: 'continuous', min: 0, max: 1, default: 0.4 },
    { id: 'ratio',   name: 'Ratio',   type: 'stepped',    min: 0, max: 4, default: 2 },
    { id: 'x',       name: 'X',       type: 'continuous', min: 0, max: 1, default: 0.2 },
    { id: 'trails',  name: 'Trails',  type: 'stepped',    min: 0, max: 1, default: 1 },
    { id: 'engaged', name: 'Engaged', type: 'stepped',    min: 0, max: 1, default: 1 },
  ],
};
