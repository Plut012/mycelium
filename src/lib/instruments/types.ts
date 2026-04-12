/**
 * Instrument pack format.
 *
 * An instrument pack defines a set of audio samples mapped across
 * the keyboard. Samples are loaded from URLs (typically CDN) on demand.
 */

export interface SampleMapping {
  /** MIDI note number this sample was recorded at */
  midi: number;
  /** URL to the audio file (OGG/MP3/WAV) */
  url: string;
}

export interface InstrumentPack {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Short description */
  description: string;
  /** Category for organization */
  category: 'piano' | 'guitar' | 'strings' | 'brass' | 'woodwind' | 'percussion' | 'other';
  /** License information */
  license: string;
  /**
   * Velocity layers — each layer is an array of sample mappings.
   * Layer 0 = softest, last layer = loudest.
   * For single-velocity instruments, use one layer.
   */
  velocityLayers: SampleMapping[][];
  /**
   * MIDI note range this instrument covers.
   * Notes outside this range won't play.
   */
  range: { low: number; high: number };
}
