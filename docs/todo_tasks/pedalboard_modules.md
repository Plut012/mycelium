# Pedalboard Module Suite — Spec & Implementation Plan

**Status:** COMPLETE (2026-07-06) — all 7 pedals built + "Pedalboard" preset. Phase 2 [CV ext.]
jacks shipped: Squeezer sustain/level CV, King & Blues gain/volume CV, ARP-87 time/repeats/X CV,
Hammertone level CV (Time CV intentionally omitted — Time regenerates the convolution IR, which
can't be continuously modulated; revisit only if a real algorithmic reverb replaces the IR).
**Created:** 2026-07-06
**Goal:** clone the physical guitar pedalboard as a suite of **7 modules** (pedals 1–7), each
following the standard `manifest.ts` / `engine.ts` / `Module.svelte` structure. Source spec
(Part 1) is the user's source-of-truth description, preserved verbatim. Part 2 is the
implementation plan.

**Scope decision (2026-07-06):** the **NUX Looper (M8)** and **Supro amp (M9)** are cut — the
existing Output module terminates the chain instead. Their spec sections remain in Part 1 for
reference should they ever be revived. The **Wah** is a simple vibey lever interaction: a
draggable treadle, not an expression-pedal simulation.

---

# Part 1 — Source spec (verbatim)

A source-of-truth reference for cloning each pedal on the board as a module in a Eurorack-style simulator. Each entry gives **patch points** (audio + CV I/O), **panel parameters** (control + range + function), a **DSP model** (how to actually build the sound), and **behavior** (dynamics, quirks, couplings).

## Conventions & global notes

- **Audio I/O** = mono jacks unless noted. Model at instrument level internally; normalize to your sim's standard.
- **Engage** = each true-bypass footswitch becomes a gate/bypass toggle on the module. When bypassed, audio passes clean (true bypass), except the amp (always in circuit).
- **CV inputs** are modular-native *extensions* — the real pedal has a static knob; exposing it as a CV input is the whole point of porting to Eurorack. These are flagged as **[CV ext.]** so you can tell "faithful clone" from "modular bonus."
- **Signal order of the current patch** (the "wild" routing):
  `Squeezer → King(ToT1) → RustBucket → Wah → Bluesbreaker(ToT2) → ARP-87 → Hammertone → Looper → Amp`
- **Free routing insight:** the Throne of Tone's send/return (which physically lets you insert pedals between its two sides) is *just patch cables* in a modular sim. So the King and Bluesbreaker modules below are fully independent — anything can sit between them.

## 1. SQUEEZER — Compressor

*Ross/Dyna-style OTA compressor. Front of chain: sustain + evenness.*
> **Assumption:** modeled as the classic Ross/Dyna 2-knob topology. If your actual build adds Attack/Blend/Tone, extend the param list accordingly.

- **Patch points:** Audio in, audio out. **[CV ext.]** Sustain CV, Level CV.
- **Parameters:**
  - **Sustain** (0–1): compression amount + makeup gain. Higher = more squish, more sustain, higher noise floor.
  - **Level** (0–1): output/makeup volume.
- **DSP model:** OTA/VCA gain cell driven by a **full-wave rectified envelope detector** (feed-forward). Soft knee, high ratio (limiter-ish), **fast attack** (slight initial pick "pluck" passes through), **medium release** (~100–300 ms) → audible "breathing"/pumping on decay. Subtle high-frequency loss (Dyna darkening) — model a gentle LPF or treble tilt on the compressed signal.
- **Behavior:** Evens dynamics, extends sustain, **fills the RustBucket fuzz gate** for smoother held notes. Raises noise floor. Interacts with guitar-volume cleanup downstream (heavy compression flattens that dynamic — keep moderate).

## 2. KING OF TONE — Overdrive (ToT voicing A)

*Warm Audio Throne of Tone, King-of-Tone voicing. In the current patch this is the octave-feeder (gentle drive before the RustBucket octave).*

- **Patch points:** Audio in, audio out. **[CV ext.]** Gain CV, Volume CV.
- **Parameters:**
  - **Volume** (0–1): output level.
  - **Gain** (0–1): drive amount.
  - **Tone** (0–1): passive post-clip tilt, dark→bright.
  - **Presence** (0–1): upper-mid emphasis, **~500 Hz–2.3 kHz** band.
  - **Drive Mode** (3-way): *Boost* / *Overdrive* / *Distortion* — see DSP.
  - **Gain Level** (2-way): Low / High gain range.
- **DSP model:** Op-amp gain stage → **soft clipping via diodes in the feedback loop** (asymmetric). *King* voicing = more open/transparent, less mid-hump, a bit more headroom & clarity than Bluesbreaker. Mode switch changes clipping topology: **Boost** = clipping diodes out (near-clean boost), **Overdrive** = soft asymmetric clip (light), **Distortion** = extra diodes to ground / harder clip (still not high-gain). Passive tone filter at the end; Presence = separate upper-mid shelf/peak.
- **Behavior:** Very touch-sensitive; **cleans up with guitar volume**. Stacks smoothly into other drives. As the octave-feeder: set Mode=OD, low-to-medium Gain — feeds the octave rounded harmonics for a *singing* (not screaming) octave.

## 3. BLUESBREAKER — Overdrive (ToT voicing B)

*Same pedal, Bluesbreaker voicing. In the current patch this is the finisher (post-wah polish / lead boost).*

- **Patch points / Parameters:** Identical control set and I/O to Module 2 (Volume, Gain, Tone, Presence, Drive Mode, Gain Level). **[CV ext.]** Gain CV, Volume CV.
- **DSP model:** Same op-amp + feedback-diode soft-clip topology, **Bluesbreaker voicing**: more midrange push, softer/spongier feel, slightly darker, mild compression vs. the King's openness.
- **Behavior:** Warm, compressed, classic transparent OD. As finisher: re-saturates the parked-wah peak (smooths it), adds warmth; bump Volume for a lead jump.
- **Note (hardware truth):** Modules 2 & 3 are two sides of ONE pedal; each physical side can be set to *either* voicing and they can cascade in series. Modeling them as two fixed-voicing modules is the chosen abstraction — if you want full fidelity, give each module a Voicing switch (King/Blues) instead of hardcoding.

## 4. RUST BUCKET "3 WAY" — Boost + Fuzz + Octave

*Custom, undocumented triple-stage dirt module. Three independent stages, each own engage, one shared output.*
> **Assumption:** octave type (ring-mod/Octavia family) and the single knob as master Volume are an informed read, not manufacturer-confirmed. Treat as a strong hypothesis; adjust if the real unit differs.

- **Patch points:** Audio in, audio out. Three engage gates: **Boost / Fuzz / Octave**. Internal order: **Boost → Fuzz → Octave**.
- **Parameters:**
  - **Volume** (0–1): shared master output (post all three stages).
  - (Stages are on/off only — no per-stage knobs.)
- **DSP model — three cascaded sub-stages:**
  - **A. Boost:** clean-ish gain stage into the fuzz (mild soft clip at most). Its real job is *pushing the fuzz harder*, which in turn gives the octave more to grab.
  - **B. Fuzz:** high-gain, **gated, glitchy, splatty** fuzz. Model = aggressive hard clipping (silicon-ish) **+ a noise gate / starved-voltage sputter**: notes cut off abruptly on decay, staccato "velcro" gating, unstable/glitchy at low input levels. Raw, mid-present voicing.
  - **C. Octave (up):** **full-wave rectifier (absolute value) of the signal → frequency doubling → octave-up**, ring-modulator family. *Only audible when the input is already saturated* (needs Fuzz, or a hot drive upstream). Screechy ring-mod artifacts on chords/intervals; singing octave on saturated single notes high on the neck.
- **Behavior:** The octave is **input-dependent** — feed it harmonic-dense, saturated single notes (mids, neck pickup) for a clean octave; low notes/chords → chaotic warble. Guitar volume rolls the whole module from wall-of-fuzz to sputter. For the "gentle octave," feed it Module 2 (OD) with Fuzz *off*.

## 5. WAH — Parked Resonant Filter

*Filter placed after RustBucket. Used static ("parked") as a fixed vocal formant; occasional slow manual sweeps for expression.*
> **Assumption:** standard inductor-based (Cry Baby-type) response; adjust sweep range/Q if your unit differs.

- **Patch points:** Audio in, audio out. **[CV ext.] Position CV** — the treadle. This is the key modular patch point: an envelope here = auto-wah; a slow LFO = the trippy sweep. Default = static (parked).
- **Parameters:**
  - **Position** (0–1): filter center frequency. Parked = fixed value.
  - (Q/resonance fixed internally unless you expose it.)
- **DSP model:** **Resonant band-pass / peaking filter**, moderate-high Q, swept center **~400 Hz–2.2 kHz**. Inductor voicing gives a characteristic peak shape (not a clean textbook BP) — a pronounced resonant bump with a gentle skirt.
- **Behavior:** **Filter-into-drive** (Module 3 after it) re-saturates and smooths the peak → vocal, not screechy. Tames the RustBucket octave's ice-pick. **Frequency overlap with the ToT Presence control** (~500 Hz–2.3 kHz) — don't stack a heavy Presence boost on top of the parked peak or it gets honky; let one lead.

## 6. ARP-87 — Multi-Algorithm Delay

*Walrus Audio ARP-87. Digital delay, pre-reverb. Tap-tempo based (no time knob).*

- **Patch points:** Audio in, audio out. **Tap gate** (sets tempo). **[CV ext.]** Ratio CV, Repeats CV, X CV. **Momentary feedback ramp** (hold tap → feedback to max = self-oscillation) — expose as a gate for runaway/oscillation swells.
- **Parameters:**
  - **Level** (0–1): repeat/echo volume.
  - **Dampen** (0–1): low-pass filter on repeats. CW = brighter/opener.
  - **Repeats** (0–1): feedback amount (→ self-oscillation near max).
  - **Ratio** (stepped): tap-tempo subdivision multiplier. In **Slap** mode it sets delay time directly.
  - **X** (0–1): **mode-dependent** — modulation depth in Digital/Analog/Slap; **filter width** in Lo-Fi.
  - **Program** (4-way): Digital / Analog / Lo-Fi / Slap.
  - **Max delay:** 1000 ms. **Trails / No-trails** global toggle.
- **DSP model per algorithm:**
  - **Digital:** clean delay line, pristine repeats.
  - **Analog:** BBD-style — each repeat progressively **low-pass filtered + mildly saturated** (darkens as it decays).
  - **Lo-Fi:** degraded/band-limited (bitcrush + bandpass feel), warped → "AM radio"; **X = filter width**.
  - **Slap:** single short slapback; Ratio = time.
  - **Modulation:** LFO on delay time (chorus-y pitch wobble), depth = X (in non-Lo-Fi modes).
- **Behavior:** Darker (Analog/Lo-Fi) repeats sit *under* loop layers without clutter. Feedback ramp = intentional self-oscillation swells.

## 7. HAMMERTONE — Reverb

*Fender Hammertone Reverb. Digital, post-delay, pre-looper. No trails (cuts on bypass).*

- **Patch points:** Audio in, audio out. **[CV ext.]** Time CV, Level CV.
- **Parameters:**
  - **Time** (0–1): decay length (tail duration).
  - **Damp** (0–1): rate of high-frequency decay *within the tail*. CW = brighter/longer; CCW = darker/shorter (eventually clamps the tail).
  - **Level** (0–1): wet mix (dry stays constant / analog dry-through feel).
  - **Type** (3-way): Hall / Room / Plate.
  - **Tone** (2-way switch): high-frequency dampen on/off — sit-in-mix darkening.
- **DSP model per type:**
  - **Hall:** smooth, long, mid-sustaining; ranges spring-ish → cavernous.
  - **Room:** scooped mids, clear transients/note definition, gentle low-end thump, shorter.
  - **Plate:** bright, chimey; **lows diminish as Time increases** → stays clean on big chords.
  - Digital algorithm; can produce glitchy artifacts at very high Level/Time (per user reports) — optional to model.
- **Behavior:** **No trails** — tail cuts instantly on bypass. Keep this OFF/low when committing percussive/"drum" layers to the looper (global wash muddies transients); use per-layer for pads/leads.

## 8. NUX LOOPER — Loop Recorder

*Small NUX looper. Post-reverb, pre-amp → commits a fully-wet loop.*
> **Assumption:** generic small-NUX feature set; verify max loop time, undo depth, and whether your specific model has onboard rhythms.

- **Patch points:** Audio in, audio out. Gates: **Record / Overdub**, **Play / Stop**, **Undo / Redo**, **Clear**.
- **Parameters:**
  - **Level** (0–1): loop playback volume vs. live signal (if present on your model).
  - **Max loop length / undo depth:** model-specific (small NUX units are limited; confirm).
- **DSP model:** Record buffer; overdub **sums** new audio into the existing buffer; playback loops the buffer. **Transparent** — no tone shaping. First-press records, second sets loop length, subsequent presses overdub.
- **Behavior:** Position = last before amp → **delay + reverb are baked into the loop**. Matches the intended workflow: commit a wet backing, then strip effects for a dry lead over the top (backing and lead live in different sonic spaces). Amp EQ/reverb are applied to playback *after* this, globally.

## 9. SUPRO DELTA KING 12 — Amp / Output Stage

*Final module. Global EQ + spring reverb + boost/drive + power-amp voicing, applied to everything post-looper.*

- **Patch points:** Audio in; **Speaker out** = the sim's final output. **Power-amp in** (bypasses preamp — feed a modeled preamp straight to the power stage). **Line out** (post-preamp DI tap).
- **Parameters:**
  - **Volume** (0–1): preamp gain → sets breakup.
  - **Treble / Mid / Bass:** interactive passive tone stack (Fender-ish; controls are not independent).
  - **Reverb** (0–1): spring tank level.
  - **Master** (0–1): power-amp level.
  - **Boost** (switch): FET-driven, fixed-level, near-clean boost.
  - **Drive** (switch): Pigtronix "FAT" — fixed high-gain, compressed, quite distorted.
- **DSP model:** 12AX7 preamp gain → **passive interactive tone stack** → **single-ended Class A 6L6 power amp** (asymmetric, even-harmonic breakup; **sag/compression** when pushed) → **12" speaker cab** (voiced vintage/field-coil-ish; LPF ~5 kHz-ish, model as a speaker IR). **Reverb = long spring-tank model** (dispersive, boingy, splashy — grabs transients). Boost = FET gain stage in front; Drive = fixed high-gain FAT circuit.
- **Behavior:** At **low Master** (apartment use): minimal power-amp breakup, and perceived EQ shifts (less bass/treble by ear at low SPL — set EQ referencing recorded playback, not the room). **Spring reverb is global** (applied to the whole loop + live) — the source of muddy percussion; keep it low and let Module 7 handle per-layer reverb. Line out = clean post-preamp DI, no power-amp/speaker character.

## Key cross-module couplings (worth modeling)

- **Octave needs upstream saturation.** Module 4-C is silent on clean input; its output scales with how saturated its input is (fuzz, or a hot drive from Module 2). This coupling *is* the sound.
- **Comp fills the fuzz gate.** Module 1's sustain feeds Module 4-B a steadier level → less sputter, longer octave tracking.
- **Wah ↔ Presence overlap.** Module 5's parked peak and Modules 2/3 Presence share ~0.5–2.3 kHz. Summing both = honky. Let one lead.
- **Filter-into-drive smoothing.** Any drive *after* the wah (Module 3) re-saturates and rounds the wah's resonant peak.
- **Post-looper amp = master bus.** Module 9's EQ/reverb are global and applied at playback (not committed into the loop buffer), unlike everything before Module 8, which is baked per-layer.

---

# Part 2 — Implementation plan

## Guiding constraints (from CLAUDE.md)

- Wrap Web Audio nodes; never replace them. `WaveShaperNode` (with `oversample: '4x'`) is the
  clipping workhorse; `ConvolverNode` + procedural IR generation (technique already proven in
  `src/lib/modules/reverb/engine.ts`) covers reverbs and the speaker cab.
- **AudioWorklet is permitted for analog modeling** — reserve it for the two places stock nodes
  genuinely can't go: the Rust Bucket's gated/sputtering fuzz (needs an envelope-dependent
  expander) and the Looper's sample-accurate recording.
- Each pedal = one directory under `src/lib/modules/{id}/` with `manifest.ts`, `engine.ts`,
  `Module.svelte` + a registry entry. No core changes.

## Shared infrastructure (build once, before pedal #1)

1. **Bypass pattern** — every pedal engine gets the same true-bypass topology:
   `input GainNode → [effect chain] → wet GainNode → out` in parallel with
   `input → dry GainNode → out`. Engage flips wet/dry gains with a short
   `setTargetAtTime` ramp (~5 ms) to avoid clicks. Implement as a small helper the first pedal
   establishes and the rest copy (module self-containment rule — copy, don't share a core class).
   Hammertone's "no trails" behavior falls out free: bypassing mutes the wet path instantly.
2. **`Footswitch.svelte` UI primitive** (`src/lib/ui/`) — pedal-style stomp button + status LED,
   used by every module. Toggles the `engaged` param.
3. **CV extension convention** — flagged `[CV ext.]` ports are **phase 2** for every pedal.
   Pattern: register a control-type input port wired to a GainNode that scales into the target
   AudioParam (same pattern as the filter's `cutoff_cv`). Ship each pedal with knobs first;
   add CV jacks in a later pass so phase 1 stays lean. Exception: **Wah Position CV ships in
   phase 1** — the spec calls it "the key modular patch point."

## Per-module plans

### M5. Wah (`wah`) — build 1st, easiest
- **Graph:** `in → peaking BiquadFilter (+14 dB, Q≈5) → gentle lowpass (tracks ~2.5× peak freq, models the inductor skirt) → out`.
- **Position→freq:** log map `f = 400 · (2200/400)^position`. Lever + `position_cv` control input
  into `filter.frequency` via scaling GainNode (phase 1, per above).
- **Params:** position (default parked ≈ 0.45 — the vocal formant spot).
- **UI — the vibey lever:** a big SVG **treadle lever** you grab and rock with the pointer
  (drag up/down = heel/toe), drawn in side profile and pivoting around its hinge. Position
  changes glide with a short `setTargetAtTime` smoothing so hand motion sounds like a foot,
  not a zipper. The lever stays where you leave it (parked — no spring-back), shows the current
  center frequency, and animates when `position_cv` drives it so modulation is visible on the panel.
- **Effort:** small. No worklet.

### M1. Squeezer (`squeezer`) — build 2nd
- **Graph:** `in → DynamicsCompressorNode → makeup GainNode → highshelf BiquadFilter (−2 dB @ 6 kHz, Dyna darkening) → level GainNode → out`.
- **Sustain knob maps three things at once:** threshold (−24 → −45 dB), release (300 → 120 ms),
  makeup gain (+0 → +18 dB). Ratio fixed ≈ 10:1, knee 12 dB, attack 4 ms (lets the pick pluck through).
- **Accept:** DynamicsCompressorNode's detector isn't a true full-wave OTA feed-forward — close
  enough at this level; revisit with a worklet only if the squish feels wrong.
- **UI:** two knobs + gain-reduction meter (poll `compressor.reduction` — nice teaching visual).
- **Effort:** small.

### M2. King of Tone (`king-of-tone`) — build 3rd
- **Graph:** `in → input highpass (~90 Hz, tightens lows) → [BB-only mid-push peaking] → drive GainNode → WaveShaperNode (oversample 4x) → post-clip lowpass ("passive tone", 800 Hz–8 kHz log from Tone) → Presence peaking (center ≈ 1.1 kHz, Q 0.9, 0→+7 dB) → volume GainNode → out`.
- **Mode switch = three waveshaper curves:** Boost = near-linear tanh with late knee;
  Overdrive = asymmetric soft clip (`tanh(kx)` positive, softer negative — even harmonics);
  Distortion = same shape, harder knee + lower ceiling. Gain Level toggle scales drive range
  (Low ×1–8, High ×1–30).
- **Touch sensitivity comes free:** waveshaper curves are level-dependent by nature, so lowering
  upstream level (comp off, sampler volume down) cleans it up like a guitar volume knob.
- **UI:** pedal-face layout — 4 knobs, 2 switches, footswitch + LED.
- **Effort:** medium. Establishes the drive-pedal template.

### M3. Bluesbreaker (`bluesbreaker`) — build 4th, cheap after M2
- Same engine structure as M2 with the **voicing constants** changed: pre-clip mid-push peaking
  (+3 dB @ 650 Hz) engaged, slightly softer clip knee, post lowpass default darker, drive range
  lower, plus a fixed gentle compressor (ratio 2:1) after the shaper for the "spongier" feel.
- **Implementation:** `bluesbreaker/engine.ts` imports the shared drive core from
  `king-of-tone/engine.ts` (precedent: hex modules import from `keyboard/`) parameterized by a
  voicing config object. Two module dirs, one clipping implementation.
- **Effort:** small.

### M7. Hammertone (`hammertone`) — build 5th
- **Graph:** dry pass-through + `wet: in → ConvolverNode (procedural IR) → tone-switch lowpass → level GainNode → out`.
- **Procedural IRs** (extend the existing reverb module's generator): exponential-decay noise,
  per-type shaping — **Hall**: long decay, mid emphasis; **Room**: shorter, mid scoop + early
  reflection cluster, small low thump; **Plate**: bright init, high-frequency-weighted noise,
  *and low-shelf cut in the IR that deepens as Time increases* (the spec's "lows diminish" quirk).
  **Damp** = frequency-dependent decay: apply a per-sample lowpass whose coefficient tightens
  along the IR tail during generation. Time/Damp/Type changes regenerate the IR (debounced,
  as the existing reverb does).
- **No trails** is the default bypass behavior (wet gain cut). Add nothing.
- **Effort:** medium — mostly IR-generation tuning by ear.

### M6. ARP-87 (`arp87`) — build 6th
- **Graph:** dry + `wet: in → input GainNode → DelayNode (max 2 s) → feedback loop [→ Dampen lowpass → mode color stage → feedback GainNode →]` back into the delay; wet tap → level GainNode → out. Mod LFO: `OscillatorNode (~0.5 Hz sine) → depth GainNode → delay.delayTime`.
- **Mode = reconfigure the loop color stage:**
  - *Digital*: color stage bypassed.
  - *Analog*: mild tanh WaveShaper + fixed 3.5 kHz lowpass in the loop (repeats darken cumulatively — free, since every pass re-filters).
  - *Lo-Fi*: bandpass (center ~1.2 kHz, width from **X**) + quantizing staircase WaveShaper curve (bitcrush with a stock node).
  - *Slap*: feedback forced ~0, Ratio maps time directly 60–160 ms.
- **Tap tempo:** TAP button in UI; engine stores interval between last two taps, Ratio applies
  stepped subdivision (1/1, 1/2, dotted 1/8, 1/4...; clamp to 1000 ms). **Hold TAP ≥ 400 ms** =
  momentary feedback ramp (feedback → 1.05, self-oscillation) until release — one button does both,
  like the pedal.
- **Trails toggle:** trails = bypass only mutes the input to the wet path (tail rings out);
  no-trails = mutes wet output.
- **UI:** 4 knobs + program selector + TAP button with tempo-blinking LED.
- **Effort:** medium-large. All stock nodes.

### M4. Rust Bucket (`rust-bucket`) — build 7th
- **Graph:** three cascaded stages, each with its own bypass crossfade, then master volume:
  - **Boost:** GainNode ×4 + barely-soft tanh shaper.
  - **Fuzz:** **AudioWorklet** (`rust-fuzz-processor`) — the one dirt stage that earns a worklet:
    per-sample envelope follower driving a hard downward expander (gate: env < threshold →
    steep cut = velcro sputter) + biased hard clip (bias shifts with envelope = starved-voltage
    misbehavior at low input). ~60 lines of processor code. Fallback if worklet load fails:
    plain hard-clip WaveShaper (no gate).
  - **Octave:** `WaveShaperNode` with **|x| curve** (full-wave rectifier — stock node does the
    Octavia trick perfectly) → highpass ~120 Hz (kills rectifier DC + flub) → +6 dB makeup.
  - **The coupling is free:** rectifier-doubling only reads as an octave on saturated input, so
    "octave needs upstream saturation" and "comp fills the fuzz gate" emerge from the physics
    without any special-case code.
- **UI:** one big Volume knob + three stomp switches (BOOST / FUZZ / OCT) with LEDs.
- **Effort:** medium (the worklet is new ground; everything else is small).

### M8 NUX Looper / M9 Supro amp — CUT (scope decision 2026-07-06)
- Not being built. The chain terminates in the existing **Output module** after the Hammertone.
- Spec sections retained in Part 1 only as reference. If ever revived: the looper would be an
  AudioWorklet buffer recorder; the amp a WaveShaper preamp/power stages + procedural cab and
  spring-chirp IRs. (Prior plan detail available in git history of this file.)

## Build order & milestones

| # | Module | Size | New tech |
|---|--------|------|----------|
| 0 | Shared: bypass pattern + Footswitch primitive | S | — |
| 1 | Wah | S | lever UI |
| 2 | Squeezer | S | — |
| 3 | King of Tone | M | drive template |
| 4 | Bluesbreaker | S | reuses M2 core |
| 5 | Hammertone | M | IR variants |
| 6 | ARP-87 | M/L | tap tempo |
| 7 | Rust Bucket | M | **only AudioWorklet** |
| 8 | "Pedalboard" preset | S | — |

**Milestone A** (after 4): Squeezer → King → Wah → Bluesbreaker chain playable from the Fretboard.
**Milestone B** (after 6): full time-based section — the "wild" chain minus the dirt box.
**Milestone C** (after 8): complete board.

## The "Pedalboard" preset (final step)

Full wild-routing chain minus looper/amp (needs two rack rows; all types unique so the preset
loader's type-keyed connection map works). The Fretboard outputs note data, not audio, so the
**Sampler (nylon) is the "guitar"** in front of the pedals:

`fretboard → sampler → squeezer → king-of-tone → rust-bucket → wah → bluesbreaker → arp87 → hammertone → output`

Defaults tuned to the spec's advice: Squeezer moderate (preserve cleanup), King Mode=OD low-mid
gain (octave feeder), RustBucket Fuzz OFF initially (the "gentle octave" recipe), Wah parked ≈0.45,
Hammertone Level modest.

## Open questions (flagged in spec, answer when relevant module is built)

- Squeezer: does the real build have Attack/Blend/Tone knobs? (M1 param list)
- Rust Bucket: confirm octave family + master-volume read. (M4 voicing)
- Wah: sweep range/Q of the actual unit. (M5 constants)
