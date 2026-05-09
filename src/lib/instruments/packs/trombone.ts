/**
 * Trombone — from MusyngKite soundfont (General MIDI).
 *
 * Rich, warm low brass. Excellent for bass lines and warm chords.
 * Source: https://github.com/gleitz/midi-js-soundfonts
 */

import type { InstrumentPack } from '../types.js';
import { buildSoundfontLayer } from '../soundfont-loader.js';

const JS_URL = 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/trombone-ogg.js';
const RANGE = { low: 40, high: 70 }; // E2 to Bb4

export const trombone: InstrumentPack = {
  id: 'trombone',
  name: 'Trombone',
  description: 'Rich, warm low brass — deep and expressive.',
  category: 'brass',
  license: 'MIT / Free',
  velocityLayers: [],
  range: RANGE,
};

export async function prepareTrombone(): Promise<void> {
  if (trombone.velocityLayers.length > 0) return;
  const layer = await buildSoundfontLayer(JS_URL, RANGE.low, RANGE.high);
  trombone.velocityLayers = [layer];
}
