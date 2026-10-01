# Android update validation

Package `com.ringrush.game`, version 1.2.0 (4), minimum Android 9, target Android
16. Native Java Activity with the game bundled offline in Android's accelerated
WebView. The regular APK is signed and disables debugging.

## Gameplay and touch

51 automated checks pass. Rivals follow course rings and pads, jump hazards,
use finite boost charge, lose rings and speed on collisions, and finish on their
own simulation times. Course checks cover all four worlds and preserve forgiving
Easy difficulty and a winnable Normal race. Different render frame rates produce
deterministic rival progress and pickup counts. Each racer has their own lap
pickup history; AI pickups do not remove Sonic's ring opportunities.

The old analog pad inherited `pointer-events:none` from the HUD. The pad now
accepts real finger input. After user feedback it was narrowed to 220 CSS pixels
maximum and changed to threshold lane commands. Passing a side marker requests
one of the three lanes; holding the thumb does not repeatedly switch. Recenter
or lift to rearm. Sonic finishes the lane transition automatically. Keyboard
and controller free steering remain available.

Installed phone checks passed small-motion dead zone, one lane per gesture,
hold/release, recenter/rearm, opposite direction, and simultaneous lane change
with jump and boost. The three AI racers each collected rings, used pads and
spent boost charge during the same native test. No game JavaScript exceptions
were reported. Evidence: `output/android/native-lane-check.json` and the physical
ADB screenshot `native-lane-steering.png`.

## Display and performance

Phone reports model SM-F976B and Android 17. The unfolded panel is 2256x2504.
The game occupies 2256x2414 physical pixels after the host's system-gesture inset;
the WebView has device pixel ratio 2.8125. Rendering uses the full available
physical resolution, including the fractional CSS viewport dimensions. FXAA
replaces expensive mobile multisampling. The user explicitly chose native
resolution over lowering internal resolution to prioritize 120 FPS.

Mobile optimizations retain meshes and textures, use cheaper specular lighting,
batch character pieces per articulated part, cache the painted sky, update world
shadows at 15 Hz, use soft character ground shadows, and cull distant track
items. Scenery batches are partitioned for the larger super-track. Desktop keeps
its original lighting and bloom. Native full-resolution checks have not achieved
sustained 120 FPS; short course samples were approximately 40-75 FPS depending
on course and view. These are performance samples, not sustained thermal tests.
The full-resolution 4x AA prototype was about 23-30 FPS.

Browser layout checks passed cover portrait (344x900), expanded (800x900), cover
landscape (900x344), expanded landscape (900x800), and narrow portrait (320x700).
No menu horizontal overflow; all controls fit with touch targets at least 48 px.
Live cover/unfolded/rotation resizing preserves race progress. Background events
pause and mute; returning preserves pause until manual resume. Physical folding
feedback is still pending; unfolded rendering was verified on the actual phone.

## Packaging and offline

Production build, Android compilation, exact bundled asset names and APK v3
signature checks pass. Assets have normalized forward-slash ZIP paths.
The final APK disables the inspector and preserves saved records on update.
Baseline device checks verified native Back/pause/resume and background freeze.
Game-only network emulation verified offline HTML, CSS and JavaScript assets;
the phone's network settings were not changed. ADB screen captures show the GPU
canvas; WebView inspector screenshots omit accelerated canvas layers here.
