import type { ModuleManifest } from '$lib/engine/Module.js';

export const euclidManifest: ModuleManifest = {
  id: 'euclid',
  name: 'Euclid',
  category: 'source',
  description: 'Euclidean rhythm gate — spreads hits as evenly as possible around a ring of steps. E(3,8) is the tresillo; most grooves live in here somewhere.',
  gridWidth: 4,
  gridHeight: 5,
  inputs: [],
  outputs: [
    { id: 'gate_out', name: 'Gate', type: 'control', direction: 'output' },
  ],
  parameters: [
    {
      id: 'tempo',
      name: 'Tempo',
      type: 'continuous',
      min: 40,
      max: 240,
      default: 120,
    },
    {
      id: 'steps',
      name: 'Steps',
      type: 'stepped',
      min: 1,
      max: 16,
      default: 8,
    },
    {
      id: 'fills',
      name: 'Fills',
      type: 'stepped',
      min: 0,
      max: 16,
      default: 3,
    },
    {
      id: 'rotate',
      name: 'Rotate',
      type: 'stepped',
      min: 0,
      max: 15,
      default: 0,
    },
    {
      id: 'running',
      name: 'Running',
      type: 'stepped',
      min: 0,
      max: 1,
      default: 1,
    },
  ],
};
