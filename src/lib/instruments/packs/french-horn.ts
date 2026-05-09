/**
 * French Horn — from MusyngKite soundfont (General MIDI).
 *
 * Loads base64-encoded OGG samples from midi-js-soundfonts JS bundle.
 * Warm, mellow, beautiful for chords and harmony exploration.
 *
 * Source: https://github.com/gleitz/midi-js-soundfonts
 * License: MIT (soundfont rendering) / Free (original soundfont data)
 */

import type { InstrumentPack } from '../types.js';
import { buildSoundfontLayer } from '../soundfont-loader.js';

const JS_URL = 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/french_horn-ogg.js';
const RANGE = { low: 41, high: 84 }; // F2 to C6

/**
 * French Horn pack — starts with empty layers.
 * Call `prepareFrenchHorn()` to fetch and populate sample mappings.
 */
export const frenchHorn: InstrumentPack = {
  id: 'french-horn',
  name: 'French Horn',
  description: 'Warm, mellow brass — beautiful for chords and harmony.',
  category: 'brass',
  license: 'MIT / Free',
  velocityLayers: [],
  range: RANGE,
};

/** Fetch soundfont data and populate the velocity layers. */
export async function prepareFrenchHorn(): Promise<void> {
  if (frenchHorn.velocityLayers.length > 0) return;
  const layer = await buildSoundfontLayer(JS_URL, RANGE.low, RANGE.high);
  frenchHorn.velocityLayers = [layer];
}
