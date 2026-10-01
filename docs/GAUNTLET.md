# Gauntlet review record

## Goal and reference

Build a playable, inviting local 3D Sonic running racer for children, with
several distinct worlds and forgiving controls. The original method is
[Matt Shumer's Gauntlet Loop](https://somethingbig.ai/gauntlet-loop): builders
work separately from critics, who inspect actual output and send concrete gaps
back for revision.

Visual direction comes from [SEGA's Sonic Racing CrossWorlds course gallery](https://sonic.sega.jp/SonicRacingCrossWorlds/courses.html),
particularly [the official stadium screenshot](https://sonic.sega.jp/SonicRacingCrossWorlds/assets/images/common/courses/SS/mainss01.png).
This is an aspirational reference. Independent review explicitly finds this
small procedural fan game below commercial fidelity. The comparison is direct,
not blind: recognizable Sonic branding makes an honest blind comparison
impractical. No claim of commercial parity is made.

The concrete household release bar is: readable Sonic, three visually distinct
and continuous courses, responsive steering/jumping/boosting, fair hazards,
gentle difficulty, a harder mode that rewards playing, correct laps and finish
ordering, safe pause/resume/restart, clear menu/HUD/results, and a Windows launch
path that requires neither development tools nor remote runtime assets.

## Independent review and revisions

The world/character builder and simulation/audio builder worked separately.
Fresh visual and gameplay critics received the actual project and running game
without builder explanations. Reviews included source inspection, independent
simulations with the shipped courses, and rendered desktop/mobile screenshots.

Initial gaps returned by the critics:

- Plain cone mountains, flat palm fronds, and a detail-free loop made the coast
  look generic. Replaced the horizon with green-topped stepped checkerboard
  islands; added a checker loop, curved palm fronds, flower/mushroom patches,
  sandstone strata, and a neon orbital landmark.
- Sonic was too small in the menu. Enlarged only the menu preview character.
- Every hazard landed in the right lane due to a placement expression. Hazards
  now rotate through all lanes, with 92–106 m spacing and clear spring approaches.
- Hands-off play won every normal race. Increased normal rival speeds while
  preserving gentle mode. On all three actual courses, hands-off normal now
  finishes fourth; ring chasing, jumping and boosting can finish first.
- Results displayed projected unfinished rival times as actual measurements.
  Unfinished opponents now display "Behind you" rather than a fictional time.
- The last running sound persisted in pause/results/menu. These states now
  explicitly pause audio and zero movement ambience.
- Portrait framing cropped Sonic, and close trailing rivals drew over the
  chase view. Added a portrait preview camera, faded nearby trailing rivals,
  and lifted Starlight's decorative gates above the player's silhouette.

The corrected visual review passes the household bar for character recognition,
world distinction, unobstructed racing line and readable desktop/mobile UI.
Commercial reference remains visibly stronger in materials, landmark density,
lighting and atmospheric depth.

## Verification

- 17 automated checks: racing lifecycle, pause during countdown and movement,
  per-lap ring pickups, jumping hazards, boost exhaustion, bounded steering,
  springs/pads, consistency across simulation frame rates, finish order, and
  actual course geometry/fairness/difficulty across all three worlds.
- Production build succeeds; installed dependency audit reports zero known
  vulnerabilities. Three.js remains the largest bundle, about 130 kB gzipped.
- The Windows PowerShell server was exercised with successful HTML/JS requests,
  correct MIME types, and 404 responses for source/outside-root requests.
- The compiled game was opened and rendered through that release server.
- The independent gameplay critic completed a real keyboard race, verified
  frozen pause state, restart/home/next-track transitions and persisted records.
  In an isolated 390 x 844 touch browser context, actual emulated touch events
  steered Sonic and triggered a jump. See `docs/gameplay-review.md`.
- Screenshots and independent balance scripts live in `output/playwright/`.

## Practical limits

Single player with three computer rivals; no split-screen or online multiplayer.
Procedural stylized geometry and synthesized audio rather than commercial
assets or voice acting. Touch and standard gamepad input are implemented;
physical controller testing requires an attached controller. Personal records
are browser-local. Smoothness depends on the device's WebGL performance.

## Fourth super-track extension

The follow-up adds Parrot Paradise, a 3,106 m course compared with 953–1,088 m
for the original worlds. It has two actual inverted loops, a raised waterfall
bridge, banked bends, canopy passages, fallen logs, moving pendulums, and seven
parrots that launch from trees once per lap. Character, road, collectibles and
camera share a full three-dimensional course frame through each loop.

The world builder and physics/audio builder worked independently. A separate
critic inspected the actual course geometry, the shipped simulation and live
browser output. The root integrated the camera, fourth selection card, warning
HUD and existing Windows package.

During construction, a planar loop design could cross its own road. Loops now
drift sideways smoothly; the full deck retains clearance between its passes.
Parrot visual flight and physics share a distance-based approach, reaching the
locked lane at progress 0.5. Warnings provide at least 0.8 seconds before a hit.
Knocks decay and are bounded by the guardrails, with gentler hits in easy mode.

New regression checks verify full loop inversion, orthonormal frames, continuous
arc-length sampling, road clearance, strike alignment, two complete laps, all
four loop traversals and fourteen warnings, along with pause, evasion, restart,
moving obstacles and frame-rate consistency. The original course tests remain.

Final extension verdict: PASS for the requested household fan-game features.
All 29 automated checks passed. Independent live races finished both modes,
and the critic verified both loop crowns, jump and steering evasion, pause,
lap reset, restart, returning to the original worlds and the 390 x 844 layout.
The result balance caption was corrected to RINGS KEPT after review.
See `docs/super-review.md` for evidence and practical testing limits.

## Character, world and audio polish loop

The next request targets world/character detail and soundtrack/SFX quality.
Separate character, world and audio builders implemented upgrades, while fresh
visual and audio critics inspected the actual source and rendered outputs.
The previous source and matched screenshots were preserved in
`output/polish-baseline` for direct comparison.

The visual critic requested revisions after the first pass: a large rock hid
Sonic on the first loop approach, fern anchors were below the terrain, moss
shelves were buried in simple cliff shapes, and water patterns repeated too
strongly. The rock used a world-Z offset that moved it back towards the first
loop. Both outcrops now sit on the side opposite the loop's drift, with offsets
in the course frame. A regression samples the actual rendered rock bounds
against the full course width and character height. Ferns now rise from the
terrain; jungle cliffs have separate stepped rock bodies with exposed grassy
caps and vegetation; water/grass patterns are subtler.

The audio critic found wet returns bypassing independent volume controls,
including a neon ambience pad leaking into the SFX bus. Separate room returns
and a dedicated dry ambience synth correct these paths. Course switches fade
voices before stopping them. The user's Caribbean direction adds steel drums
from the opening bar in Coast/Jungle, with syncopated bass and island percussion.

`output/audio-review.html` renders the actual GameAudio engine through a
clock-controlled native OfflineAudioContext, including live mixing, ducking,
boost/final-lap intensity and effects. Eight PCM WAVs were produced: baseline,
four scores, effects, jungle mix and a Music=0 neon regression. Float samples
showed no clipping; the neon regression was exactly silent. The model's audio
input is unavailable: both root and independent critic received "audio content
omitted because you do not support audio input". Subjective listening quality
is unverified, and no listening PASS is claimed. The rendered clip is provided
for the user to audition. See `docs/polish-audio-review.md` and
`docs/polish-visual-review.md` for independent evidence and final verdicts.

The audio critic rejected initial renders despite zero clipping because
isolated one-sample impulses were present. Each new voice now initializes its
envelope to zero before scheduling the attack. Independent re-decoding of all
four corrected scores and the jungle mix found no former impulses, no adjacent
jumps over 0.3, no clipping and over 6 dB of peak headroom. Mechanical audio
review passes these excerpts; subjective listening remains unverified.

Final visual re-review passes: both loop approaches and exits are clear,
vegetation sits above terrain, the jungle has visible stepped silhouettes,
and all four desktop worlds and portrait views remain readable. The browser
verified sound unlock, saved independent volumes, pause/resume, and that
closing the sound dialog during a pause keeps the race paused. All 35 automated
checks and the final production build pass. The Windows package is updated.

## Steering correction

The reported reversed keys came from treating the character's local +X course
offset as screen-right. The chase camera looking along the character's +Z
direction sees that offset on screen-left. A shared controls conversion now
maps arrows, A/D, touch buttons and controller stick/D-pad into the correct
course direction. Parrot lane warnings use the same screen convention.

Five additional regression checks project real simulation movement through a
Three.js chase camera across all four courses, including both loop crowns.
All 40 automated tests and the production build pass. In the packaged browser
game, arrows and A/D passed on every course; arrow direction was also checked
and captured during an inverted loop. Mobile pointer controls and simulated
controller axes passed in a clean browser without page errors. The rebuilt
Windows ZIP contains the correction.


## Android controls and active rivals

Rivals now use actual ring pickups, boost pads, springs, hazard collisions and
finite boost charge. Route decisions and obstacle jumps replace sine-wave lane
wandering and cosmetic hops. Independent simulation checks exercise pickups,
collisions, recovery, lap history, all shipped courses and frame-rate determinism.

Phone review found that the steering pad inherited disabled pointer events from
the HUD. Real-device touch checks verified the fix, then subsequent user feedback
changed the wide analog control to a smaller one-lane-per-gesture threshold pad.
The device also verified independent AI pickups and boosts. Native-resolution
rendering uses FXAA and mobile rendering optimizations. The user chose native
resolution despite the remaining gap to sustained 120 FPS. Validation details
and evidence are in `docs/android-validation.md`.
