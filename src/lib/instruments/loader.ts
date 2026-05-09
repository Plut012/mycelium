/**
 * Sample loader — fetches, decodes, and caches AudioBuffers from URLs.
 *
 * Designed for lazy loading: samples are fetched only when needed,
 * then cached for the lifetime of the AudioContext.
 */

import type { InstrumentPack, SampleMapping } from './types.js';

/** Cached decoded AudioBuffers keyed by URL. */
const bufferCache = new Map<string, AudioBuffer>();

/** In-flight fetch promises to avoid duplicate requests. */
const pendingFetches = new Map<string, Promise<AudioBuffer>>();

/**
 * Load a single audio sample from a URL.
 * Returns a cached buffer if already loaded.
 */
export async function loadSample(ctx: AudioContext, url: string): Promise<AudioBuffer> {
  // Return cached
  const cached = bufferCache.get(url);
  if (cached) return cached;

  // Return in-flight
  const pending = pendingFetches.get(url);
  if (pending) return pending;

  // Fetch and decode
  const promise = (async () => {
    const response = await fetch(url);
    if (!response.ok && !url.startsWith('data:')) {
      throw new Error(`Failed to load sample: ${url} (${response.status})`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    bufferCache.set(url, audioBuffer);
    pendingFetches.delete(url);
    return audioBuffer;
  })();

  pendingFetches.set(url, promise);
  return promise;
}

/**
 * Preload all samples for a velocity layer of an instrument.
 * Returns when all samples are loaded and cached.
 */
export async function preloadLayer(
  ctx: AudioContext,
  samples: SampleMapping[],
): Promise<void> {
  await Promise.all(samples.map((s) => loadSample(ctx, s.url)));
}

/**
 * Preload an entire instrument pack (all velocity layers).
 * Calls the progress callback with (loaded, total) counts.
 */
export async function preloadInstrument(
  ctx: AudioContext,
  pack: InstrumentPack,
  onProgress?: (loaded: number, total: number) => void,
): Promise<void> {
  const allSamples = pack.velocityLayers.flat();
  const total = allSamples.length;
  let loaded = 0;

  await Promise.all(
    allSamples.map(async (s) => {
      await loadSample(ctx, s.url);
      loaded++;
      onProgress?.(loaded, total);
    }),
  );
}

/**
 * Find the best sample for a given MIDI note from a set of sample mappings.
 * Returns the mapping whose recorded pitch is closest to the target note,
 * plus the playback rate needed to pitch-shift to the exact target.
 */
export function findBestSample(
  midi: number,
  samples: SampleMapping[],
): { mapping: SampleMapping; playbackRate: number } | null {
  if (samples.length === 0) return null;

  // Find closest sample by MIDI note
  let best = samples[0];
  let bestDist = Math.abs(midi - best.midi);

  for (let i = 1; i < samples.length; i++) {
    const dist = Math.abs(midi - samples[i].midi);
    if (dist < bestDist) {
      best = samples[i];
      bestDist = dist;
    }
  }

  // Calculate playback rate for pitch shifting
  // Every semitone is a factor of 2^(1/12)
  const semitoneDiff = midi - best.midi;
  const playbackRate = Math.pow(2, semitoneDiff / 12);

  return { mapping: best, playbackRate };
}

/**
 * Select the appropriate velocity layer based on a velocity value (0-1).
 */
export function selectVelocityLayer(
  pack: InstrumentPack,
  velocity: number,
): SampleMapping[] {
  const numLayers = pack.velocityLayers.length;
  if (numLayers === 0) return [];
  if (numLayers === 1) return pack.velocityLayers[0];

  // Map 0-1 velocity to layer index
  const idx = Math.min(
    Math.floor(velocity * numLayers),
    numLayers - 1,
  );
  return pack.velocityLayers[idx];
}

/**
 * Get a cached AudioBuffer for a URL. Returns undefined if not yet loaded.
 */
export function getCachedBuffer(url: string): AudioBuffer | undefined {
  return bufferCache.get(url);
}
