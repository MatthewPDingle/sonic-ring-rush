# Sonic Ring Rush

A local browser 3D Sonic fan racer made for kids. Four procedural worlds,
two-lap races, rings, hazards, jumping, spring launchers, boost pads, three
computer rivals, and forgiving auto-forward controls. Original procedural
models and Web Audio music; no remote runtime assets.

The detail upgrade adds sculpted curved quills, articulated limbs, shaped gloves
and shoes, blinking/breathing, textured course surfaces, layered jungle cliffs,
leafy palms, carved ruins, city windows and softer atmospheric lighting.

Each world has an original 64-bar score. Emerald Coast and Parrot Paradise use
warm steel drums, syncopated bass, congas, shaker and clave for a Caribbean feel.
Ruins and Starlight retain their own musical themes. Sound settings in the menu
and pause screen save separate Music and Sound effects volumes. Bird warnings
and fanfares duck the music; boost and the final lap add percussion.

The fourth world, **Parrot Paradise**, is a 3.1 km super-track with two rideable
vertical loops, banked bends, canopy tunnels, a waterfall bridge, fallen logs,
moving pendulums, and seven swooping parrots. Birds chirp and mark their locked
attack lane before diving; steer or jump to dodge. Hits give a recoverable
sideways knock. Loop grip maintains momentum so younger players keep moving.

## Play on Windows

Download the latest Windows ZIP or Android APK from
[GitHub Releases](https://github.com/MatthewPDingle/sonic-ring-rush/releases/latest).

Double-click `Start-Game.cmd` after building, or extract the release ZIP and
double-click its launcher. Windows PowerShell supplies the local-only server;
the packaged game needs no Node.js installation. Read `PLAY-ME.txt` for controls.

## Play on Android

Install `release/Sonic-Ring-Rush-Android.apk` and open **Sonic Ring Rush**.
The signed APK bundles all four worlds and audio offline in a native Android
Activity with an accelerated WebView. It supports narrow phone screens,
unfolded foldable screens and rotation, with touch steering, jump and boost.
Best times and sound settings are saved locally. Leaving the app pauses the
race; folding or resizing retains its state.

Build and installation details: [android/README.md](android/README.md).

## Develop

Node.js 20.19+ or 22+ and npm. On Windows:

```powershell
npm.cmd install --os=win32
npm.cmd run dev
npm.cmd test
npm.cmd run build
```

The `--os=win32` flag overrides a Linux OS selection in the current machine's
npm configuration. On Linux or macOS, use a normal npm install.

The Vite development server binds to 127.0.0.1. The Windows release launcher
also binds only to loopback, chooses an available port, and stops after five
minutes without requests. The open game sends keepalive requests while playing.

## Gauntlet process

The project uses the builder / separate critic / revise loop described in
[Matt Shumer's original write-up](https://somethingbig.ai/gauntlet-loop).
Visual direction: the readable Sonic silhouette and colourful themed courses
shown in [SEGA's official Sonic Racing CrossWorlds course gallery](https://sonic.sega.jp/SonicRacingCrossWorlds/courses.html).
Commercial visuals are an aspirational reference, not a claimed parity result.
Independent visual and gameplay reviews inspect the running output and concrete
simulation checks; revisions and remaining limitations are recorded in `docs/GAUNTLET.md`.

Sonic is SEGA's character. This is an unofficial fan game; it has no SEGA assets,
voice recordings, or affiliation. Three.js is distributed under the MIT license.
