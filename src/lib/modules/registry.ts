import type { ModuleManifest, ModuleCategory } from '$lib/engine/Module.js';
import type { ModuleEngine } from '$lib/engine/Module.js';
import type { Component } from 'svelte';

// ── Oscillator ────────────────────────────────────────────────────────────────
import { oscillatorManifest } from './oscillator/manifest.js';
import { OscillatorEngine } from './oscillator/engine.js';
import OscillatorModule from './oscillator/Module.svelte';

// ── Gain ──────────────────────────────────────────────────────────────────────
import { gainManifest } from './gain/manifest.js';
import { GainEngine } from './gain/engine.js';
import GainModule from './gain/Module.svelte';

// ── Filter ────────────────────────────────────────────────────────────────────
import { filterManifest } from './filter/manifest.js';
import { FilterEngine } from './filter/engine.js';
import FilterModule from './filter/Module.svelte';

// ── Delay ─────────────────────────────────────────────────────────────────────
import { delayManifest } from './delay/manifest.js';
import { DelayEngine } from './delay/engine.js';
import DelayModule from './delay/Module.svelte';

// ── Audio Input ───────────────────────────────────────────────────────────────
import { audioInputManifest } from './audio-input/manifest.js';
import { AudioInputEngine } from './audio-input/engine.js';
import AudioInputModule from './audio-input/Module.svelte';

// ── Output ────────────────────────────────────────────────────────────────────
import { outputManifest } from './output/manifest.js';
import { OutputEngine } from './output/engine.js';
import OutputModule from './output/Module.svelte';

// ── Keyboard ──────────────────────────────────────────────────────────────────
import { keyboardManifest } from './keyboard/manifest.js';
import { KeyboardEngine } from './keyboard/engine.js';
import KeyboardModule from './keyboard/Module.svelte';

// ── Sampler ───────────────────────────────────────────────────────────────────
import { samplerManifest } from './sampler/manifest.js';
import { SamplerEngine } from './sampler/engine.js';
import SamplerModule from './sampler/Module.svelte';

// ── Reverb ────────────────────────────────────────────────────────────────────
import { reverbManifest } from './reverb/manifest.js';
import { ReverbEngine } from './reverb/engine.js';
import ReverbModule from './reverb/Module.svelte';

// ── Hex Keyboard ──────────────────────────────────────────────────────────────
import { hexKeyboardManifest } from './hex-keyboard/manifest.js';
import { HexKeyboardEngine } from './hex-keyboard/engine.js';
import HexKeyboardModule from './hex-keyboard/Module.svelte';

// ── LFO ───────────────────────────────────────────────────────────────────────
import { lfoManifest } from './lfo/manifest.js';
import { LFOEngine } from './lfo/engine.js';
import LFOModule from './lfo/Module.svelte';

// ── Envelope ──────────────────────────────────────────────────────────────────
import { envelopeManifest } from './envelope/manifest.js';
import { EnvelopeEngine } from './envelope/engine.js';
import EnvelopeModule from './envelope/Module.svelte';

// ── Scroll ───────────────────────────────────────────────────────────────────
import { scrollManifest } from './scroll/manifest.js';
import { ScrollEngine } from './scroll/engine.js';
import ScrollModule from './scroll/Module.svelte';

// ── Tape ─────────────────────────────────────────────────────────────────────
import { tapeManifest } from './tape/manifest.js';
import { TapeEngine } from './tape/engine.js';
import TapeModule from './tape/Module.svelte';

// ── Registry entry type ───────────────────────────────────────────────────────

export interface RegistryEntry {
  manifest: ModuleManifest;
  /** Construct a new engine instance — called when adding a module to the rack */
  createEngine: () => ModuleEngine;
  /** The Svelte component that renders this module */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: Component<any>;
}

// ── Static registry ───────────────────────────────────────────────────────────

export const moduleRegistry = new Map<string, RegistryEntry>([
  [
    'oscillator',
    {
      manifest: oscillatorManifest,
      createEngine: () => new OscillatorEngine(),
      component: OscillatorModule,
    },
  ],
  [
    'gain',
    {
      manifest: gainManifest,
      createEngine: () => new GainEngine(),
      component: GainModule,
    },
  ],
  [
    'filter',
    {
      manifest: filterManifest,
      createEngine: () => new FilterEngine(),
      component: FilterModule,
    },
  ],
  [
    'delay',
    {
      manifest: delayManifest,
      createEngine: () => new DelayEngine(),
      component: DelayModule,
    },
  ],
  [
    'audio-input',
    {
      manifest: audioInputManifest,
      createEngine: () => new AudioInputEngine(),
      component: AudioInputModule,
    },
  ],
  [
    'output',
    {
      manifest: outputManifest,
      createEngine: () => new OutputEngine(),
      component: OutputModule,
    },
  ],
  [
    'keyboard',
    {
      manifest: keyboardManifest,
      createEngine: () => new KeyboardEngine(),
      component: KeyboardModule,
    },
  ],
  [
    'hex-keyboard',
    {
      manifest: hexKeyboardManifest,
      createEngine: () => new HexKeyboardEngine(),
      component: HexKeyboardModule,
    },
  ],
  [
    'sampler',
    {
      manifest: samplerManifest,
      createEngine: () => new SamplerEngine(),
      component: SamplerModule,
    },
  ],
  [
    'reverb',
    {
      manifest: reverbManifest,
      createEngine: () => new ReverbEngine(),
      component: ReverbModule,
    },
  ],
  [
    'lfo',
    {
      manifest: lfoManifest,
      createEngine: () => new LFOEngine(),
      component: LFOModule,
    },
  ],
  [
    'envelope',
    {
      manifest: envelopeManifest,
      createEngine: () => new EnvelopeEngine(),
      component: EnvelopeModule,
    },
  ],
  [
    'scroll',
    {
      manifest: scrollManifest,
      createEngine: () => new ScrollEngine(),
      component: ScrollModule,
    },
  ],
  [
    'tape',
    {
      manifest: tapeManifest,
      createEngine: () => new TapeEngine(),
      component: TapeModule,
    },
  ],
]);

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Get a single registry entry by module id. Returns undefined if not found. */
export function getModuleEntry(id: string): RegistryEntry | undefined {
  return moduleRegistry.get(id);
}

/** Get all registry entries for a given category. */
export function getModulesByCategory(category: ModuleCategory): RegistryEntry[] {
  return [...moduleRegistry.values()].filter(
    (entry) => entry.manifest.category === category
  );
}

/** All registered module ids. */
export function getAllModuleIds(): string[] {
  return [...moduleRegistry.keys()];
}
