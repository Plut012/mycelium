# Duet — Two-String Touchscreen Vocal Instrument

**Status:** V3 SHIPPED, IN PLAY-AND-FEEDBACK (2026-07-22) — phone verdict so far:
*feeling pretty good*; keep playing before more changes. Panel overflow fixed
2026-07-22 (scale dropdown became a slim bar beside the preview after it pushed
PLAY/OUT out of the clipped panel body).

**Parked / candidate next steps** (in rough order of pull):
- **Fingerboard wear** — faint accumulating smudges where you actually play, fading
  over minutes; optionally persisted to localStorage so the instrument ages with its
  player. Concept agreed 2026-07-21, persistence question never answered.
- **Deeper bass floor** — Chamber's bass Duet bottoms at E2; true double-bass range
  needs octave min 1 plus a lowpass "body" path under the formant stack (low
  fundamentals starve through the 350 Hz band).
- **Per-string CV/gate outs** — would let the strings drive other voices; cheap.
- **Feel tuning knobs to watch during play**: quarter-tone assist strength (guided vs
  magnetic), lantern radius (~130 px), bead sizes at phone scale, ±2¢ detune warmth.

**V3 (2026-07-21) — scale-aware intonation: a Scale selector (Chromatic,
Hijaz, Bayati, Rast, Phrygian Dom., Phrygian, Harm. Minor) where scales are
cent-tables anchored to the root, so maqam quarter-tones are first-class — assist and
settle pull toward scale tones (verified: a held Bayati 2nd settles to exactly −50
cents). Hijaz uses traditional narrowed-augmented-2nd intonation (125/375), distinct
from 12-TET Phrygian Dominant. Fullscreen gains per-string scale beads: tonic diamonds
always visible, dominant diamonds and degree beads lantern-revealed near the finger,
quarter-tone degrees drawn as half-lit diamonds; Chromatic renders no beads. Gap
inlays (octave pair + alternating fifths) unchanged.
**V2 (2026-07-21) — phone-test feedback round 1 applied: **three strings**
(fifths: root, +7, +14) with the **bassiest string rightmost**; auto-vibrato now
**defaults to 0** (vibrato belongs to the player's finger; knob opts back in); osc
detune halved to ±2¢ (the old ±4¢ beat audibly on held notes); and held notes
**settle into tune** on stillness (full settle from intonation ≥ 0.5, gated off at 0
— fretless stays fretless; held bends sustain). V1 shipped 2026-07-21.
**Created:** 2026-07-21
**Goal:** a mobile-first input module: two violin-inspired strings played by sliding a
finger along them — continuous pitch, gentle vibrato, vocal timbre. Not strummed, not
fretted: the emphasis is flowing up and down a string. Fullscreen PLAY mode like Hex
Keys; the rack panel is just the patch point + settings.

**Development loop:** feel can only be judged on a real touchscreen. Iterations are
pushed to master; Spencer pulls to phone (`npm run dev -- --host` for LAN access),
plays, reports. Desktop browser verification covers only rendering/errors/basic
response.

**Design decisions (agreed 2026-07-21):**

1. **The module IS the instrument** — built-in vocal voice per string. Continuous
   pitch cannot ride the discrete NoteSpore/DegreeSpore protocol; position flows
   straight into AudioParams. (CV/gate outs per string are a possible later addition.)
2. **Sideways drift = subtle bend.** Pushing a finger off the string axis behaves
   like a gentle guitar bend: pitch rises slightly (≤ ~40 cents, direction-agnostic
   like a real bend) and the vowel opens a little (ooh → toward ahh). Subtle.
3. **Two strings a fifth apart** (violin-neighbor tuning) — embodied theory, matches
   the Compass ethos. Root + octave set on the panel.
4. **Intonation assist, not frets.** Finger pitch blends toward the nearest semitone
   with knob-controlled strength, weakened by finger velocity — slow movement settles
   in tune, fast slides and vibrato pass through untouched. 0 = fretless, 1 = snapped.
5. **Auto-vibrato on stillness** — holding a position fades in a gentle ~5 Hz vibrato
   after ~350 ms (depth knob). Manual finger wiggle counts as movement and suppresses
   it, so your own vibrato always wins.

## Responsiveness engineering (the load-bearing part)

- `getCoalescedEvents()` on pointermove — recover full digitizer-rate samples
  (120–240 Hz) instead of frame-rate-batched events, so vibrato micro-motion survives.
- Every pitch update is `setTargetAtTime(f, now, ~0.015)` — short exponential ramps,
  never raw sets: connected glissando, no zipper.
- String capture with hysteresis: a pointer claims a string on touch-down and keeps it
  regardless of sideways drift (that drift is the bend axis). You cannot fall off a
  string mid-phrase.
- Touch-down is a bow stroke: ~80 ms swell attack, ~300 ms release. No velocity
  (touch has none) — expressiveness comes from motion, not impact.

## Voice (stock nodes, no worklet)

Per string: 2 saws detuned ±4¢ → parallel 3-band formant filter stack → envelope →
master → analyser. Vowel morph interpolates formant frequencies/gains between
ooh [350, 800, 2400] and ahh [650, 1080, 2650] (exponential freq interp, linear gain).
Per-string vibrato LFO (sine ~5 Hz → gain → both oscs' detune), depth ramped by the
stillness detector.

## Module shape

- `src/lib/modules/duet/` — manifest / engine / Module.svelte (standard three files).
- Manifest: id `duet`, category `source`, grid 4×4, output `audio_out`.
- Parameters: `root` (stepped 0–11, panel shows note name), `octave` (2–5, default 3),
  `intonation` (0–1, default 0.5), `vibrato` (0–1, default 0.4), `level` (0–1,
  default 0.8).
- Panel: knobs + tiny live two-string preview + PLAY button. Fullscreen overlay
  reuses the Hex Keys pattern (requestFullscreen, blur/fullscreenchange release-all).
- Fullscreen: two vertical strings (top = higher pitch, 2-octave span), string visual
  bows toward the finger, floating note-name readout with cent deviation near each
  active finger.

## Evaluate on phone (v1)

1. Slide feel: does a slow glissando sound connected (no stepping)? Any perceptible lag?
2. Vibrato: does natural finger wiggle read as vibrato? Does auto-vibrato fade in
   tastefully on stillness, and get out of the way when you move?
3. Intonation at 0.5: can you land in-tune sustains without feeling snapped?
4. Bend: does sideways drift feel like a gentle bend, and is the vowel shift subtle
   enough?
5. Two-finger counterpoint: independent strings, no pointer confusion?
6. Ergonomics: string spacing, pitch range, top-is-higher orientation.
