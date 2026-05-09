/**
 * Built-in track library for the Tape module.
 *
 * All recordings are public domain, served from Internet Archive
 * with CORS enabled (access-control-allow-origin: *).
 */

export interface TapeTrack {
  id: string;
  title: string;
  artist: string;
  /** Direct audio URL (for built-in tracks) or empty for user-imported */
  url: string;
  builtIn: boolean;
  /** Approximate duration in seconds (for UI before load completes) */
  durationHint?: number;
}

export const BUILT_IN_TRACKS: TapeTrack[] = [
  {
    id: 'moonlight-sonata',
    title: 'Moonlight Sonata',
    artist: 'Beethoven',
    url: 'https://archive.org/download/MoonlightSonata_755/Beethoven-MoonlightSonata.mp3',
    builtIn: true,
    durationHint: 900,
  },
];
