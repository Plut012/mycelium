export type { InstrumentPack, SampleMapping } from './types.js';
export { loadSample, preloadInstrument, preloadLayer, findBestSample, selectVelocityLayer, getCachedBuffer } from './loader.js';
export { salamanderPiano } from './packs/salamander-piano.js';
export { frenchHorn } from './packs/french-horn.js';
export { trumpet } from './packs/trumpet.js';
export { trombone } from './packs/trombone.js';

import { salamanderPiano } from './packs/salamander-piano.js';
import { frenchHorn } from './packs/french-horn.js';
import { trumpet } from './packs/trumpet.js';
import { trombone } from './packs/trombone.js';
import type { InstrumentPack } from './types.js';

/** All available instrument packs, indexed by id. */
export const instrumentPacks: Record<string, InstrumentPack> = {
  'salamander-piano': salamanderPiano,
  'french-horn': frenchHorn,
  'trumpet': trumpet,
  'trombone': trombone,
};
