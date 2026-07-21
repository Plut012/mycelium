# The Tin — Module Suite Spec & Implementation Plan

**Status:** COMPLETE (2026-07-21) — all 5 phases shipped. Phase 5: "The Tin" preset
(10 modules laid out like the hardware panel — Compass left, performance knobs center,
Freeze ×3 right column, Keys lower half — fully cabled incl. the drift cable; the
preset system gained an optional `key` alias so one preset can place the same module
type more than once) and "The Tin" theme (matte black print, brushed-metal knobs,
amber lamp glow, copper spore ports honoring the copper-tape pads). Browser-verified:
preset loads 10 modules / 20 connected jacks, theme applies, bed-freeze gesture works
under the new theme. Module glows (Tin Keys pads, Freeze/Shimmer lit states) now
inherit `--knob-indicator` via color-mix instead of hardcoding a theme's green.

**Phase log:** Phase 4: `freeze` and `halo`
(both AudioWorklet) registered and browser-verified: a frozen bed sustains
indefinitely after key release; two chained Freezes stack beds across a key change
(the full layering gesture: freeze C bed → Compass to G → freeze second bed → thaw
independently); unfreezing fades ~0.5 s back to silence; Halo's tail rings and decays
per its RT60, and shimmer at max decay is stable with no runaway. **Fix found during
verification:** Halo's original shimmer "level compensation" multiplied loop gain per
pass, exponentially crushing the decay time — compensation moved to the injection
point (shimmer scaled like the dry send), with damping + safety clamp providing
stability. Phase 3 verified 2026-07-21 (`x-factor`); Phase 2 2026-07-21 (`bloom`);
Phase 1 2026-07-20 (`tin-keys`, `compass`, `tin-voice`). Phase 5 (theme + preset)
pending.
**Verification note:** early module-card clicks after page load can be silently lost —
this turned out to be SvelteKit hydration timing (SSR markup is visible before delegated
event handlers attach), i.e. a headless-testing artifact, not an app bug. Automated
drivers should wait ~3 s after load before the first click.
**Created:** 2026-07-20
**Goal:** simulate the planned "Tin" pocket synthesizer hardware project as a suite of
**7 modules** plus a preset rack, so the instrument's format can be tested and experimented
with before committing to hardware. Each module follows the standard
`manifest.ts` / `engine.ts` / `Module.svelte` structure. Part 1 preserves the user's
hardware project overview verbatim as source-of-truth. Part 2 is the implementation plan.

**Design decisions (agreed 2026-07-20):**

1. **Compass is standalone.** Root/mode selection is its own spore-transformer module, not
   knobs on the keyboard. Reusable by any degree-emitting controller; mirrors the hardware
   panel's own "setup controls" zone.
2. **X-Factor exposes a drift control output.** The audio-path character (saturation,
   wow/flutter, noise) lives in the X-Factor worklet; the cross-cutting voice character
   (detune drift) is a control-out patched into Tin Voice's drift input. One knob, two
   patch points. The extra cable is accepted — it's the modular-native expression of the
   hardware's macro behavior.
3. **Freeze is audio-domain.** Freeze captures the incoming *audio* into an infinite bed
   (ring buffer + crossfaded loop), not the held spore chord. Truer to hardware;
   key-change layering falls out for free.
4. **One Freeze module, three instances.** The hardware's Freeze 1/2/3 toggles become
   three placed copies of a single small module. The "3" is grid composition, not module
   internals — and you can experiment with 2 or 5.
5. **Out of scope:** MIDI/USB out (project-wide "not yet"), power hardware (meaningless in
   sim — the amber breathing LED becomes theme flavor), enclosure/panel aesthetics (a
   future "Tin" theme, tracked as optional Phase 5).

---

# Part 1 — Source spec (verbatim)

# The Tin — Project Overview

## Vision & Vibe

A meditative pocket synthesizer housed in a small, 3D-printed enclosure that echoes the proportions of an Altoids tin — but sized generously enough to comfortably fit real controls and be a real instrument. Retro-futuristic control panel. Chrome bat-handle toggles on a dark matte face. Metal rotary knobs with engraved indicators. A large power toggle with a warm amber glow beside it that pulses softly when the instrument is idle, as if the tin is breathing.

The instrument has one purpose: to be a calm, tactile object you reach for when you want to disappear into sound for a while. You don't play songs on it — you flip switches, brush your fingers across capacitive pads, turn a knob, and let the thing bloom into warm reverb.

Every design choice serves three principles:

**Warmth over precision.** Detuned voices, slow drift, gentle saturation, and a lush reverb are baked into the sound at all times. It should never feel digital unless you *choose* to make it feel digital.

**Discrete gestures over dexterity.** Every control is a switch, a knob, or a touch pad with a clear identity. You can play it with your eyes closed, on a train, half-asleep.

**Embodied theory.** The instrument teaches functional harmony through use. The keyboard is labeled in Roman numerals, not letters — so degree 1 is always "home" regardless of what key you're in. The Circle of Fifths root selector teaches you the most important key relationship in Western music every time you turn it. The Mode selector lets you feel the difference between Ionian, Dorian, Phrygian, and the rest, one click apart. Over time, your fingers and ears learn theory without you studying it.

## How You Play It

You set your **key** with the Circle of Fifths knob (12 positions, engraved compass face). You set your **mode** — the emotional character of the scale — with the Mode knob (6 positions: Ionian, Dorian, Phrygian, Lydian, Mixolydian, Aeolian). You pick your **timbre** with the Voice knob (5 positions: sine pad, kalimba, flute, saw, bell).

Then you play. The capacitive touch keyboard — two rows of seven pads — plays the current scale, degrees I–VII, with the top row an octave above the bottom.

Two large performance knobs shape the sound as you play:

- **Time** — a single continuous control from held drone at one extreme, through slow arpeggiation, to fast shimmering wash at the other. One knob controls how fast the instrument breathes.
- **X-Factor** — a single continuous control from pristine digital cleanliness to broken 1970s tape warmth. Drift, detune, saturation, timing jitter, and voice imperfection all move together along this axis. One knob controls the instrument's personality.

Five small metal toggles handle dramatic gestures:

- **Shimmer** — sends the reverb tail back into itself pitched an octave up. Celestial upward transformation.
- **Sub-Octave** — adds a note one octave below every active pitch. Instant depth and weight.
- **Freeze 1, 2, 3** — three independent freeze buffers. Capture the current sound into an infinite harmonic bed. Freeze a chord in one key, change key, freeze another chord, play melodies over both. Build an ambient orchestra one layer at a time.

Everything sustains into the warm reverb. Nothing is harsh. Nothing is hard to reach.

## Panel Layout

**Top-left:** Large metal power toggle with warm amber LED indicator beside it. The LED pulses softly when the instrument is idle.

**Top edge (left):** USB-C port — power in, USB MIDI out to laptop, forward-compatible with USB host mode for future MIDI keyboard input.

**Top edge (right):** MIDI out (3.5mm TRS, Type A) and audio out (3.5mm stereo).

**Left column:** Circle of Fifths root selector on top, Mode selector below — the two "setup" rotaries grouped together and out of the way of performance controls.

**Center row of knobs:** Voice, X-Factor, Time — reading left-to-right as *what material → what character → what motion*. X-Factor and Time are the two large performance knobs; Voice is a smaller rotary selector.

**Above the center row:** Shimmer toggle (left), Sub-Octave toggle (right) — the two "sound shaping" mod toggles, positioned near their conceptually related knobs.

**Right column:** Three Freeze toggles stacked vertically — the "layering station," positioned near the right hand during play.

**Lower half:** Capacitive touch keyboard — 2 rows × 7 pads, labeled with Roman numerals I–VII. Top row is upper octave, bottom row is lower octave. Copper tape on the underside of the printed panel, sensed by a Trill Craft or MPR121 board.

## What This Instrument Is

A **contemplative interval instrument**. Small, tactile, warm. A full harmonic sandbox in a pocket: 12 keys × 6 modes × 5 voices × 3 freeze layers × 2 dramatic effects, all shaped by two expressive knobs that control how alive the instrument feels. Plays itself when you want ambient generative texture (turn Time up). Sits still and hums when you want pure drone (turn Time down). Records and sustains harmonic beds you can play against (Freeze). Sends MIDI to your laptop or hardware synth when you want to integrate with a larger setup. Runs standalone from a USB-C power bank when you want to sit under a tree with it.

You can play it in 30 seconds. You'll still be discovering things in it a year later.

*(Hardware component list omitted — see the hardware project's own docs; not relevant to the sim.)*

---

# Part 2 — Implementation plan

## Signal path

The Tin decomposes along signal-path seams, not panel zones. The panel zones map onto a
spore → audio pipeline:

```
┌──────────┐ degree ┌─────────┐ note  ┌───────┐ note  ┌───────────┐        ┌──────────┐
│ Tin Keys │─spore─▶│ Compass │─spore▶│ Bloom │─spore▶│ Tin Voice │─audio─▶│ X-Factor │
│ (2×7 I–VII)│      │ key+mode│       │ Time  │       │ 5 timbres │   ┌───▶│ worklet  │
└──────────┘        └─────────┘       └───────┘       │ sub-octave│   │    └────┬─────┘
                                                      │ drift in ◀────┼─────┐   │audio
                                                      └───────────┘   │     │   ▼
                                                                      │  drift  ┌────────┐
                                                                      │  (ctrl) │ Freeze │×3
                                                                      │         └────┬───┘
                                                                      └──────────────┼── X-Factor drift_out
                                                                                     ▼
                                                                              ┌──────┐   ┌────────┐
                                                                              │ Halo │──▶│ Output │
                                                                              │reverb│   └────────┘
                                                                              └──────┘
```

## Spore payload contracts

Two payload shapes flow through the spore ports:

**`DegreeSpore`** (new — emitted by Tin Keys, consumed by Compass):

```typescript
interface DegreeSpore {
  kind: 'degree';
  /** Active pads: scale degree 1–7 + octave offset 0 (bottom row) or 1 (top row) */
  active: { degree: number; octave: number }[];
}
```

**`NoteSpore`** (existing — `src/lib/modules/keyboard/engine.ts`): Compass emits this exact
shape downstream. This is deliberate: everything after Compass speaks the established
protocol, so **Bloom and Tin Voice also work with the existing Keyboard / Hex Keyboard /
Fretboard controllers, and the existing Sampler can sit in for Tin Voice**. The Tin
modules join the library; they don't fork it. Compass fills all NoteSpore fields
(frequencies, noteNames, intervals, chordName) using the keyboard module's `music.ts`
helpers — import them, don't duplicate.

Spore ports are untyped beyond `"spore"`, so a `kind` discriminant on DegreeSpore lets
consumers ignore payloads they don't understand (Compass ignores NoteSpores; Tin Voice
ignores DegreeSpores) instead of misbehaving on a mismatched patch.

## Module specs

### 1. `tin-keys` — Tin Keys

*The 2×7 capacitive touch keyboard. Emits scale degrees, not pitches — it doesn't know
what key it's in. Embodied theory made structural.*

- **Category:** source · **Grid:** 5 × 3
- **Ports:** out `degree_out` (spore, DegreeSpore)
- **Parameters:** none (deliberately — all musical configuration lives in Compass)
- **Engine:** no AudioNodes. Pointer/touch handlers on 14 pads → `emitSpore`. Multi-touch
  via tracking active pointer IDs per pad (same care as hex-keyboard). QWERTY playability
  for desktop: home row `a s d f g h j` = bottom row (degrees I–VII), `q w e r t y u` =
  top row. Release-all on window blur (same stuck-note guard as keyboard module).
- **UI:** two rows of seven pads labeled I–VII in Roman numerals, top row visually
  distinct as the upper octave. Pads light on touch.

### 2. `compass` — Compass

*The two setup rotaries: Circle of Fifths root + Mode. Degree-spores in, note-spores out.*

- **Category:** modulation (it shapes control data, produces no audio) · **Grid:** 3 × 5
- **Ports:** in `degree_in` (spore) · out `note_out` (spore, NoteSpore)
- **Parameters:**
  - `root` (select, 12 steps): **circle-of-fifths order** — C G D A E B F♯ D♭ A♭ E♭ B♭ F.
    Adjacent clicks = fifth apart. This ordering is the point; do not sort chromatically.
  - `mode` (select, 6 steps): Ionian, Dorian, Phrygian, Lydian, Mixolydian, Aeolian.
  - `octave` (stepped, 2–6, default 4): base octave for degree 1, row 0.
- **Engine:** no AudioNodes. `onSpore('degree_in')` → map each `{degree, octave}` through
  the mode's interval table + root + base octave → MIDI notes → emit full NoteSpore.
  Interval tables: Ionian `[0,2,4,5,7,9,11]`, then each mode rotates. Re-emit immediately
  when root/mode/octave changes while notes are held (live key-change is a core Tin
  gesture — freeze a bed, turn the compass, play over it).
- **UI:** large circle-of-fifths rotary with engraved compass face (12 labels around the
  dial), smaller 6-position mode rotary below. This module carries the retro-futurist
  look hardest.

### 3. `bloom` — Bloom (Time)

*The Time knob: drone → slow arpeggio → fast wash. A note-motion processor.*

- **Category:** modulation · **Grid:** 3 × 4
- **Ports:** in `note_in` (spore) · out `note_out` (spore, NoteSpore)
- **Parameters:** `time` (continuous 0–1, default 0):
  - `0` – **drone**: pass held notes through sustained, untouched.
  - low→mid – **arpeggio**: cycle held notes one at a time, ~0.3 Hz up to ~4 Hz,
    each note held until the next fires (legato steps).
  - mid→high – **wash**: rate climbs ~4→16 Hz, note order randomizes, emitted notes
    overlap (2–3 sounding at once) for shimmer density.
- **Engine:** no AudioNodes. Holds the current chord from `note_in`; a `setInterval`-based
  scheduler re-emits NoteSpore snapshots per the time zone. Interval rescheduled on
  parameter change. Spore emission is main-thread events (established pattern — sampler
  consumes the same way); at 16 Hz max this is trivial. Empty chord → emit empty spore,
  stop the timer (no idle churn).
- **Deferred:** `time` CV input. Control ports connect to AudioParams and Bloom has none;
  sampling a control signal needs an analyser-poll pattern that isn't established yet.
  Revisit if/when a second module wants it.

### 4. `tin-voice` — Tin Voice

*The instrument's material: 5 timbres, polyphonic, warm by construction. Stock AudioNodes
only — no worklet.*

- **Category:** source · **Grid:** 4 × 5
- **Ports:** in `note_in` (spore), `drift_in` (control) · out `audio_out` (audio)
- **Parameters:**
  - `voice` (select, 5): sine pad, kalimba, flute, saw, bell.
  - `sub` (toggle, default off): Sub-Octave — every voice gains a paired oscillator at
    half frequency. Per-note doubling belongs here, not in the audio path.
  - `level` (continuous 0–1, default 0.8).
- **Voice recipes (stock nodes per sounding note):**
  - **sine pad** — 2 sines detuned ±4¢, slow attack (~400 ms), gentle lowpass.
  - **kalimba** — 2-op FM (carrier + modulator ~3.4× ratio, fast-decaying mod index),
    short percussive envelope, long-ish release into reverb.
  - **flute** — sine + quiet triangle an octave up, filtered noise "breath" burst on
    attack, slow 5 Hz vibrato via LFO → detune.
  - **saw** — 2 saws detuned ±7¢ through a lowpass at ~2.5 kHz.
  - **bell** — 2-op FM at inharmonic ratio (~2.76×), long exponential decay.
- **Engine:** polyphonic voice management modeled on sampler's (`handleNoteData` diff of
  incoming vs playing, voice stealing at max polyphony ~12 — generous because Bloom's
  wash overlaps notes). `drift_in` registers a GainNode via `registerInputNode`; it fans
  out to every active oscillator's `detune` AudioParam (scaled ±25¢ full-scale). Unpatched
  it contributes nothing — the voice is pristine by default, warmed only by the X-Factor
  cable. Sub oscillators inherit drift like any other.
- **UI:** 5-position voice rotary (the hardware's smaller center knob), sub-octave
  toggle, level knob.

### 5. `x-factor` — X-Factor

*The personality knob: pristine → broken 1970s tape. One knob, two patch points.*

- **Category:** effect · **Grid:** 3 × 4
- **Ports:** in `audio_in` (audio) · out `audio_out` (audio), `drift_out` (control)
- **Parameters:** `x` (continuous 0–1, default 0.3).
- **Engine — audio path (AudioWorklet, `processor.ts`):** everything scales with `x`,
  one parameter in the processor:
  - gentle tanh saturation (drive ramps with x)
  - wow/flutter — fractional-delay line modulated by slow (~0.5 Hz) + fast (~6 Hz)
    wobble, depth with x
  - tape hiss — filtered noise floor, −∞ → ~−45 dB with x
  - high-end rolloff — one-pole lowpass walking down from ~18 kHz → ~7 kHz with x
  - at `x = 0` the processor is exactly transparent (true-bypass equivalent).
- **Engine — drift out:** ConstantSourceNode random-walked on the main thread
  (`setTargetAtTime` toward a new random target every 0.5–2 s, amplitude scaled by x).
  Patched to Tin Voice `drift_in`, this is the hardware's "voice imperfection" leg of the
  macro. The hardware's "timing jitter" leg is dropped for v1 (would require Bloom
  coupling; the audio wobble already reads as timing instability).
- **UI:** one large knob — visually a peer of Bloom's Time knob, per the hardware's
  two-big-performance-knobs design.

### 6. `freeze` — Freeze

*One buffer per module; place three. The layering station.*

- **Category:** effect · **Grid:** 2 × 4 (small — three stack in a column like the
  hardware's right edge)
- **Ports:** in `audio_in` (audio) · out `audio_out` (audio)
- **Parameters:** `freeze` (toggle, default off) · `bed_level` (continuous 0–1,
  default 0.7).
- **Engine (AudioWorklet):** dry input always passes through; the frozen bed is *added*,
  so chaining three works naturally. Processor keeps a ~2 s rolling ring buffer of the
  input; on toggle-on it loops the captured window with windowed-grain crossfading
  (equal-power, a few overlapping grains with slightly varied read offsets so the bed is
  a static *texture*, not an obvious loop). Toggle-off fades the bed out over ~0.5 s.
  Capture is audio-domain (decision 3): freeze a chord, retune Compass, freeze another —
  beds layer across keys.
- **UI:** one chrome bat-handle toggle (lit while frozen) + bed level knob.

### 7. `halo` — Halo (Shimmer Reverb)

*The always-on warm space everything sustains into, plus the Shimmer toggle.*

- **Category:** effect · **Grid:** 3 × 5
- **Ports:** in `audio_in` (audio) · out `audio_out` (audio)
- **Parameters:** `decay` (continuous 1–20 s, default 6) · `mix` (0–1, default 0.5) ·
  `damping` (0–1, default 0.4) · `shimmer` (toggle, default off) · `shimmer_amount`
  (0–1, default 0.5, only audible when shimmer is on).
- **Engine (AudioWorklet):** the existing convolution Reverb can't shimmer — shimmer
  requires a feedback loop containing a pitch shifter, and an IR has no loop. Halo is a
  single worklet: FDN reverb (4–8 delay lines, Hadamard mixing, per-line damping
  lowpass) with a granular octave-up shifter inside the feedback path, gated by the
  shimmer toggle and scaled by shimmer_amount. Long decays must stay stable (feedback
  gain derived from decay time, shimmer path level-compensated so it can't run away).
- **UI:** decay/mix/damping knobs + shimmer toggle. This replaces nothing — Reverb and
  Hammertone remain; Halo is the ambient-tail specialist.

## Registry & preset

- Add all 7 to `src/lib/modules/registry.ts` (per module-creation checklist — the one
  sanctioned touch).
- Add a **"The Tin"** preset to the `presets` array in `src/routes/+page.svelte` (same
  mechanism as the Pedalboard preset): all 7 modules placed to echo the hardware panel
  (Compass left column, Keys lower half, Freeze ×3 right column, Voice/X-Factor centered,
  Bloom beside X-Factor), fully cabled in the canonical path including the
  X-Factor `drift_out` → Tin Voice `drift_in` control cable, terminating in Output.

## Build phases

**Phase 1 — playable core:** `tin-keys` → `compass` → `tin-voice`. With existing Reverb
and Output this is already an instrument: pads → key/mode → 5 timbres → space.
Milestone: play degrees I–VII in any key/mode with all 5 voices + sub-octave.

**Phase 2 — motion:** `bloom`. Milestone: hold a chord, sweep Time from drone through
arp to wash.

**Phase 3 — character:** `x-factor` (first worklet of the suite) + Tin Voice `drift_in`
wiring. Milestone: sweep x from pristine to broken tape; drift cable audibly wobbles
voice tuning.

**Phase 4 — layers & space:** `freeze`, `halo`. Milestone: the full Tin gesture — freeze
a bed, turn the Compass, freeze a second bed in the new key, play a melody over both
into shimmering reverb.

**Phase 5 (optional) — vibe:** "Tin" theme (matte black panel, chrome toggle styling,
engraved-metal knobs, warm amber glow accents; idle-breathing via a slow CSS pulse on
glow properties) + the preset. Preset can ship earlier if Phase 5 is deferred.

## Testing checklist (per module + suite)

- Module appears in browser, snaps to grid, no collisions at listed sizes.
- Tin Keys: multi-touch chords; QWERTY rows; no stuck notes on blur.
- Compass: degree 1 = root in all 12 roots; mode interval spot-checks (Dorian ♭3 ♮6,
  Lydian ♯4, Phrygian ♭2); live root change re-pitches held notes.
- Downstream compatibility: Keyboard → Bloom → Sampler works (NoteSpore contract);
  Compass → Sampler works.
- Tin Voice: 5 timbres audibly distinct; sub-octave doubles; polyphony under wash load;
  no envelope clicks.
- X-Factor: x=0 transparent (null test by ear); drift cable wobbles Tin Voice.
- Freeze: bed sustains indefinitely without looping artifacts; dry passes when frozen;
  three chained instances layer independently.
- Halo: no runaway feedback at max decay + shimmer; tail dies cleanly on disconnect.
- Preset loads the full panel; serialization round-trips through save/load and URL hash.
