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

// ── Hex Qwerty ────────────────────────────────────────────────────────────────
import { qwertyHexManifest } from './hex-qwerty/manifest.js';
import { QwertyHexEngine } from './hex-qwerty/engine.js';
import QwertyHexModule from './hex-qwerty/Module.svelte';

// ── Fretboard ─────────────────────────────────────────────────────────────────
import { fretboardManifest } from './fretboard/manifest.js';
import { FretboardEngine } from './fretboard/engine.js';
import FretboardModule from './fretboard/Module.svelte';

// ── Euclid ────────────────────────────────────────────────────────────────────
import { euclidManifest } from './euclid/manifest.js';
import { EuclidEngine } from './euclid/engine.js';
import EuclidModule from './euclid/Module.svelte';

// ── Pedalboard: Wah ───────────────────────────────────────────────────────────
import { wahManifest } from './wah/manifest.js';
import { WahEngine } from './wah/engine.js';
import WahModule from './wah/Module.svelte';

// ── Pedalboard: Squeezer ──────────────────────────────────────────────────────
import { squeezerManifest } from './squeezer/manifest.js';
import { SqueezerEngine } from './squeezer/engine.js';
import SqueezerModule from './squeezer/Module.svelte';

// ── Pedalboard: King of Tone ──────────────────────────────────────────────────
import { kingOfToneManifest } from './king-of-tone/manifest.js';
import { KingOfToneEngine } from './king-of-tone/engine.js';
import KingOfToneModule from './king-of-tone/Module.svelte';

// ── Pedalboard: Bluesbreaker ──────────────────────────────────────────────────
import { bluesbreakerManifest } from './bluesbreaker/manifest.js';
import { BluesbreakerEngine } from './bluesbreaker/engine.js';
import BluesbreakerModule from './bluesbreaker/Module.svelte';

// ── Pedalboard: Rust Bucket ───────────────────────────────────────────────────
import { rustBucketManifest } from './rust-bucket/manifest.js';
import { RustBucketEngine } from './rust-bucket/engine.js';
import RustBucketModule from './rust-bucket/Module.svelte';

// ── Pedalboard: ARP-87 ────────────────────────────────────────────────────────
import { arp87Manifest } from './arp87/manifest.js';
import { Arp87Engine } from './arp87/engine.js';
import Arp87Module from './arp87/Module.svelte';

// ── Pedalboard: Hammertone ────────────────────────────────────────────────────
import { hammertoneManifest } from './hammertone/manifest.js';
import { HammertoneEngine } from './hammertone/engine.js';
import HammertoneModule from './hammertone/Module.svelte';

// ── Monitor ───────────────────────────────────────────────────────────────────
import { monitorManifest } from './monitor/manifest.js';
import { MonitorEngine } from './monitor/engine.js';
import MonitorModule from './monitor/Module.svelte';

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
    'hex-qwerty',
    {
      manifest: qwertyHexManifest,
      createEngine: () => new QwertyHexEngine(),
      component: QwertyHexModule,
    },
  ],
  [
    'fretboard',
    {
      manifest: fretboardManifest,
      createEngine: () => new FretboardEngine(),
      component: FretboardModule,
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
    'euclid',
    {
      manifest: euclidManifest,
      createEngine: () => new EuclidEngine(),
      component: EuclidModule,
    },
  ],
  [
    'squeezer',
    {
      manifest: squeezerManifest,
      createEngine: () => new SqueezerEngine(),
      component: SqueezerModule,
    },
  ],
  [
    'king-of-tone',
    {
      manifest: kingOfToneManifest,
      createEngine: () => new KingOfToneEngine(),
      component: KingOfToneModule,
    },
  ],
  [
    'bluesbreaker',
    {
      manifest: bluesbreakerManifest,
      createEngine: () => new BluesbreakerEngine(),
      component: BluesbreakerModule,
    },
  ],
  [
    'wah',
    {
      manifest: wahManifest,
      createEngine: () => new WahEngine(),
      component: WahModule,
    },
  ],
  [
    'rust-bucket',
    {
      manifest: rustBucketManifest,
      createEngine: () => new RustBucketEngine(),
      component: RustBucketModule,
    },
  ],
  [
    'arp87',
    {
      manifest: arp87Manifest,
      createEngine: () => new Arp87Engine(),
      component: Arp87Module,
    },
  ],
  [
    'hammertone',
    {
      manifest: hammertoneManifest,
      createEngine: () => new HammertoneEngine(),
      component: HammertoneModule,
    },
  ],
  [
    'monitor',
    {
      manifest: monitorManifest,
      createEngine: () => new MonitorEngine(),
      component: MonitorModule,
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
