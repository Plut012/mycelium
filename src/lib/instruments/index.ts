export type { InstrumentPack, SampleMapping } from './types.js';
export { loadSample, preloadInstrument, preloadLayer, findBestSample, selectVelocityLayer, getCachedBuffer } from './loader.js';
export { salamanderPiano } from './packs/salamander-piano.js';
export { frenchHorn, prepareFrenchHorn } from './packs/french-horn.js';
export { trumpet, prepareTrumpet } from './packs/trumpet.js';
export { trombone, prepareTrombone } from './packs/trombone.js';

import { salamanderPiano } from './packs/salamander-piano.js';
import { frenchHorn, prepareFrenchHorn } from './packs/french-horn.js';
import { trumpet, prepareTrumpet } from './packs/trumpet.js';
import { trombone, prepareTrombone } from './packs/trombone.js';
import type { InstrumentPack } from './types.js';

/** All available instrument packs, indexed by id. */
export const instrumentPacks: Record<string, InstrumentPack> = {
  'salamander-piano': salamanderPiano,
  'french-horn': frenchHorn,
  'trumpet': trumpet,
  'trombone': trombone,
};

/**
 * Prepare functions for instruments that need async initialization
 * (e.g., soundfont JS bundle fetch). Call before preloading samples.
 */
export const instrumentPrepare: Record<string, () => Promise<void>> = {
  'french-horn': prepareFrenchHorn,
  'trumpet': prepareTrumpet,
  'trombone': prepareTrombone,
};
