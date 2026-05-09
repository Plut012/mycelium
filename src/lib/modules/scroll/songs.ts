/**
 * Built-in song library for the Scroll module.
 *
 * All pieces are public domain (composed pre-1928).
 * Note data is pre-parsed — no MIDI files shipped in the bundle.
 * PPQ = 480 ticks per quarter note throughout.
 */

import type { ScrollSong } from './types.js';

const PPQ = 480;
const Q = PPQ;         // quarter note
const H = PPQ * 2;     // half note
const W = PPQ * 4;     // whole note
const E = PPQ / 2;     // eighth note
const S = PPQ / 4;     // sixteenth note
const DQ = Q + E;      // dotted quarter
const DH = H + Q;      // dotted half

/** Helper: build notes from [midi, tick, duration, velocity?][] */
function n(data: [number, number, number, number?][]): import('./types.js').ScrollNote[] {
  return data.map(([midi, tick, duration, velocity]) => ({
    midi,
    tick,
    duration,
    velocity: velocity ?? 0.8,
  }));
}

// ─── Twinkle Twinkle Little Star ────────────────────────────────────────────
// Key of C, simple melody

const twinkle: ScrollSong = {
  id: 'twinkle',
  title: 'Twinkle Twinkle',
  artist: 'Traditional',
  ticksPerBeat: PPQ,
  builtIn: true,
  durationTicks: Q * 48,
  notes: n([
    // "Twinkle twinkle little star"
    [60, 0, Q], [60, Q, Q], [67, Q*2, Q], [67, Q*3, Q],
    [69, Q*4, Q], [69, Q*5, Q], [67, Q*6, H],
    // "How I wonder what you are"
    [65, Q*8, Q], [65, Q*9, Q], [64, Q*10, Q], [64, Q*11, Q],
    [62, Q*12, Q], [62, Q*13, Q], [60, Q*14, H],
    // "Up above the world so high"
    [67, Q*16, Q], [67, Q*17, Q], [65, Q*18, Q], [65, Q*19, Q],
    [64, Q*20, Q], [64, Q*21, Q], [62, Q*22, H],
    // "Like a diamond in the sky"
    [67, Q*24, Q], [67, Q*25, Q], [65, Q*26, Q], [65, Q*27, Q],
    [64, Q*28, Q], [64, Q*29, Q], [62, Q*30, H],
    // "Twinkle twinkle little star"
    [60, Q*32, Q], [60, Q*33, Q], [67, Q*34, Q], [67, Q*35, Q],
    [69, Q*36, Q], [69, Q*37, Q], [67, Q*38, H],
    // "How I wonder what you are"
    [65, Q*40, Q], [65, Q*41, Q], [64, Q*42, Q], [64, Q*43, Q],
    [62, Q*44, Q], [62, Q*45, Q], [60, Q*46, H],
  ]),
};

// ─── Ode to Joy (Beethoven, Symphony No. 9) ────────────────────────────────
// Key of D (transposed to C for simplicity), main theme

const odeToJoy: ScrollSong = {
  id: 'ode-to-joy',
  title: 'Ode to Joy',
  artist: 'Beethoven',
  ticksPerBeat: PPQ,
  builtIn: true,
  durationTicks: Q * 36,
  notes: n([
    // Line 1: E E F G | G F E D | C C D E | E. D D
    [64, 0, Q], [64, Q, Q], [65, Q*2, Q], [67, Q*3, Q],
    [67, Q*4, Q], [65, Q*5, Q], [64, Q*6, Q], [62, Q*7, Q],
    [60, Q*8, Q], [60, Q*9, Q], [62, Q*10, Q], [64, Q*11, Q],
    [64, Q*12, DQ], [62, E, Q], [62, Q*14, H],
    // Line 2: E E F G | G F E D | C C D E | D. C C
    [64, Q*16, Q], [64, Q*17, Q], [65, Q*18, Q], [67, Q*19, Q],
    [67, Q*20, Q], [65, Q*21, Q], [64, Q*22, Q], [62, Q*23, Q],
    [60, Q*24, Q], [60, Q*25, Q], [62, Q*26, Q], [64, Q*27, Q],
    [62, Q*28, DQ], [60, E, Q], [60, Q*30, H],
  ]),
};

// ─── Minuet in G (Bach, BWV Anh. 114) ──────────────────────────────────────
// Key of G, 3/4 time — first 16 bars

const minuetInG: ScrollSong = {
  id: 'minuet-g',
  title: 'Minuet in G',
  artist: 'Bach',
  ticksPerBeat: PPQ,
  builtIn: true,
  durationTicks: Q * 48,
  notes: n([
    // Bar 1-2: D quarter, G-A-B quarter notes in 3/4
    [67, 0, Q], [65, Q, Q], [64, Q*2, Q],
    [67, Q*3, Q], [69, Q*4, Q], [71, Q*5, Q],
    // Bar 3-4
    [72, Q*6, Q], [69, Q*7, Q], [71, Q*8, Q],
    [72, Q*9, Q], [74, Q*10, Q], [71, Q*11, Q],
    // Bar 5-6
    [69, Q*12, Q], [67, Q*13, Q], [65, Q*14, Q],
    [64, Q*15, Q], [62, Q*16, Q], [64, Q*17, Q],
    // Bar 7-8
    [67, Q*18, Q], [71, Q*19, Q], [69, Q*20, Q],
    [67, Q*21, DH],
    // Bar 9-10
    [67, Q*24, Q], [65, Q*25, Q], [64, Q*26, Q],
    [67, Q*27, Q], [69, Q*28, Q], [71, Q*29, Q],
    // Bar 11-12
    [72, Q*30, Q], [69, Q*31, Q], [71, Q*32, Q],
    [72, Q*33, Q], [74, Q*34, Q], [76, Q*35, Q],
    // Bar 13-14
    [78, Q*36, Q], [76, Q*37, Q], [74, Q*38, Q],
    [72, Q*39, Q], [71, Q*40, Q], [69, Q*41, Q],
    // Bar 15-16
    [71, Q*42, Q], [67, Q*43, Q], [69, Q*44, Q],
    [67, Q*45, DH],
  ]),
};

// ─── Greensleeves (Traditional English) ─────────────────────────────────────
// Key of Am, 3/4 time

const greensleeves: ScrollSong = {
  id: 'greensleeves',
  title: 'Greensleeves',
  artist: 'Traditional',
  ticksPerBeat: PPQ,
  builtIn: true,
  durationTicks: Q * 48,
  notes: n([
    // "Alas my love you do me wrong"
    [69, 0, Q],
    [72, Q, H], [74, Q*3, Q],
    [76, Q*4, DQ], [77, E*9, E], [76, Q*6, Q],
    [72, Q*7, H], [69, Q*9, Q],
    [65, Q*10, DQ], [67, E*21, E], [69, Q*12, Q],
    [71, Q*13, H], [69, Q*15, Q],
    [72, Q*16, DQ], [71, E*33, E], [69, Q*18, Q],
    [68, Q*19, H], [65, Q*21, Q],
    [64, Q*22, DQ], [65, E*45, E], [68, Q*24, Q],
    [69, Q*25, H], [69, Q*27, Q],
    // "Greensleeves was all my joy"
    [76, Q*28, DH],
    [79, Q*31, Q], [79, Q*32, DQ], [77, E*67, E], [76, Q*34, Q],
    [72, Q*35, H], [69, Q*37, Q],
    [65, Q*38, DQ], [67, E*77, E], [69, Q*40, Q],
    [71, Q*41, DQ], [69, E*83, E], [68, Q*43, Q],
    [64, Q*44, H],
    [69, Q*46, H],
  ]),
};

// ─── Prelude in C Major (Bach, BWV 846) ─────────────────────────────────────
// Arpeggiated pattern — first 8 bars

const preludeInC: ScrollSong = {
  id: 'prelude-c',
  title: 'Prelude in C',
  artist: 'Bach',
  ticksPerBeat: PPQ,
  builtIn: true,
  durationTicks: E * 128,
  notes: (() => {
    // Each bar is an arpeggiated pattern of 8 eighth notes (two groups of the same 5 notes)
    const bars: [number[], number[]][] = [
      // Bar 1: C E G C E (C major)
      [[60, 64, 67, 72, 76], [60, 64, 67, 72, 76]],
      // Bar 2: C D A D F (Dm7)
      [[60, 62, 69, 62, 65], [60, 62, 69, 62, 65]],
      // Bar 3: B D G D F (G7)
      [[59, 62, 67, 62, 65], [59, 62, 67, 62, 65]],
      // Bar 4: C E G C E (C major)
      [[60, 64, 67, 72, 76], [60, 64, 67, 72, 76]],
      // Bar 5: C E A E A (Am)
      [[60, 64, 69, 64, 69], [60, 64, 69, 64, 69]],
      // Bar 6: C D F# A D (D7)
      [[60, 62, 66, 69, 74], [60, 62, 66, 69, 74]],
      // Bar 7: B D G D G (G)
      [[59, 62, 67, 62, 67], [59, 62, 67, 62, 67]],
      // Bar 8: B C E G C (C/E)
      [[59, 60, 64, 67, 72], [59, 60, 64, 67, 72]],
    ];

    const notes: [number, number, number, number?][] = [];
    let tick = 0;
    for (const [group1, group2] of bars) {
      // First half of bar: play each note as an eighth
      for (const midi of group1) {
        notes.push([midi, tick, E]);
        tick += E;
      }
      // Second half: repeat pattern but only first 3 notes to fill 8 eighths per bar
      for (let i = 0; i < 3; i++) {
        notes.push([group2[i], tick, E]);
        tick += E;
      }
    }
    return n(notes);
  })(),
};

// ─── Canon in D (Pachelbel) ─────────────────────────────────────────────────
// Main theme, key of D (transposed to C)

const canonInD: ScrollSong = {
  id: 'canon-d',
  title: 'Canon in D',
  artist: 'Pachelbel',
  ticksPerBeat: PPQ,
  builtIn: true,
  durationTicks: Q * 32,
  notes: n([
    // Bass line (transposed to C): C G Am Em F C F G
    // Melody over the progression
    // Phrase 1
    [72, 0, H], [71, H, H],
    [69, Q*4, H], [67, Q*6, H],
    [65, Q*8, H], [64, Q*10, H],
    [65, Q*12, H], [67, Q*14, H],
    // Phrase 2 (eighth note elaboration)
    [72, Q*16, Q], [71, Q*17, Q], [72, Q*18, Q], [74, Q*19, Q],
    [69, Q*20, Q], [71, Q*21, Q], [69, Q*22, Q], [67, Q*23, Q],
    [65, Q*24, Q], [67, Q*25, Q], [64, Q*26, Q], [65, Q*27, Q],
    [65, Q*28, Q], [64, Q*29, Q], [67, Q*30, Q], [71, Q*31, Q],
  ]),
};

// ─── Für Elise (Beethoven) ──────────────────────────────────────────────────
// Opening theme, key of Am

const furElise: ScrollSong = {
  id: 'fur-elise',
  title: 'Fur Elise',
  artist: 'Beethoven',
  ticksPerBeat: PPQ,
  builtIn: true,
  durationTicks: Q * 28,
  notes: n([
    // E D# E D# E B D C A...
    [76, 0, E], [75, E, E], [76, E*2, E], [75, E*3, E],
    [76, E*4, E], [71, E*5, E], [74, E*6, E], [72, E*7, E],
    [69, E*8, Q],
    // C E A B
    [60, E*10, E], [64, E*11, E], [69, E*12, Q],
    // E G# B C
    [64, E*14, E], [68, E*15, E], [71, E*16, Q],
    // E E D# E D# E B D C A
    [64, E*18, E],
    [76, E*19, E], [75, E*20, E], [76, E*21, E], [75, E*22, E],
    [76, E*23, E], [71, E*24, E], [74, E*25, E], [72, E*26, E],
    [69, E*27, Q],
    // C E A B
    [60, E*29, E], [64, E*30, E], [69, E*31, Q],
    // E C B A
    [64, E*33, E], [72, E*34, E], [71, E*35, E],
    [69, E*36, H],
    // Second phrase: E D# E D# E B D C A
    [76, E*40, E], [75, E*41, E], [76, E*42, E], [75, E*43, E],
    [76, E*44, E], [71, E*45, E], [74, E*46, E], [72, E*47, E],
    [69, E*48, Q],
    // C E A B
    [60, E*50, E], [64, E*51, E], [69, E*52, Q],
    [64, E*54, E], [68, E*55, E],
  ]),
};

export const BUILT_IN_SONGS: ScrollSong[] = [
  twinkle,
  odeToJoy,
  furElise,
  minuetInG,
  greensleeves,
  preludeInC,
  canonInD,
];
