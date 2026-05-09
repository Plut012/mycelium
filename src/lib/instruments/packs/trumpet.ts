/**
 * Trumpet — from MusyngKite soundfont (General MIDI).
 *
 * Bright, clear brass. Great for melodies over chord pads.
 * Source: https://github.com/gleitz/midi-js-soundfonts
 */

import type { InstrumentPack } from '../types.js';
import { buildSoundfontLayer } from '../soundfont-loader.js';

const JS_URL = 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/trumpet-ogg.js';
const RANGE = { low: 52, high: 84 }; // E3 to C6

export const trumpet: InstrumentPack = {
  id: 'trumpet',
  name: 'Trumpet',
  description: 'Bright, clear brass — cuts through with clarity.',
  category: 'brass',
  license: 'MIT / Free',
  velocityLayers: [],
  range: RANGE,
};

export async function prepareTrumpet(): Promise<void> {
  if (trumpet.velocityLayers.length > 0) return;
  const layer = await buildSoundfontLayer(JS_URL, RANGE.low, RANGE.high);
  trumpet.velocityLayers = [layer];
}
