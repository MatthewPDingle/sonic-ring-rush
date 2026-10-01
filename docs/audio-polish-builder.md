# Audio polish: composition and sound design

The previous audio played one 32-note triangle-wave melody over an eight-note sine bass, with a vehicle-like oscillator underneath. All four courses shared it. This revision replaces that with four original authored compositions and a layered synthesizer, and replaces the effect recipes. The music is composed in `src/score.js`, the game lifecycle and effects in `src/audio.js`.

## Four scores

Each has 64 bars, lasting roughly 110–135 seconds, before wrapping to its introduction. The sequence is a four-bar introduction, twelve bars of A melody, eight bars of B response, an eight-bar breakdown, sixteen bars of reprise and sixteen bars of finale. The lead rests during the breakdown, with an answering arpeggio taking over. Eight-bar phrases have a climb and resolution, and drum fills announce transitions.

| Course | Original piece | Character |
| --- | --- | --- |
| Emerald Coast | Coastline Carousel | 132 BPM, D major, warm steel drums from the first bar, syncopated island bass, conga, shaker, 3–2 clave and backbeat |
| Ancient Ruins | Amber Expedition | 114 BPM, A minor, wooden mallet lead, toms and warm sustained harmony |
| Neon Night | Midnight Circuit | 140 BPM, F-sharp minor, filtered detuned synth, four-on-floor kick and electronic arpeggio |
| Parrot Paradise | Canopy Capers | 126 BPM, C dominant/major, prominent steel drums from the first bar, swung shaker, conga, 3–2 clave and syncopated island bass |

All notes and rhythms are authored in this project. There are no downloaded songs, SEGA melodies, recordings, external services or network requests. The timbres are lightweight Web Audio synthesis, rather than a studio instrumental recording. The dedicated steelpan voice has a warm fundamental and five independently decaying partials, including briefly ringing inharmonic upper modes. Coastal/jungle lead notes are an octave lower than the first polish draft, providing more body and less high-pitched chiming. Wood mallets in the ruins also use a warmer register. The Caribbean revision followed the user's explicit request for steel drums and a stronger Caribbean feel.

## Effects and mix

Ring pickups use a stereo three-part bell shimmer. A hit adds a filtered noise thump, low tom and five scattering ring tones alternating across the stereo field. Jump and spring combine a rising voiced pitch with air or mallet accents. Boost uses shaped rushing air and a short upward chord. Parrots have chirped warnings and three fluttering wind pulses. A loop plays an upward mallet run and air swell. Countdown, start, lap and finish have separate cadences; the finish resolves into a sustained harmony.

Music ducks for parrot warnings, lap accents and the finish fanfare. Boost and the final lap add a quiet offbeat percussion layer. Low-volume coastal air, ruins/jungle bird calls and a neon hum provide environmental ambience. Sonic's running sound is filtered rushing air whose level and brightness follow speed.

Independent music and SFX volumes apply to both dry sound and their corresponding short stereo room return. A soft compressor and conservative source gains preserve headroom. Effects are rate limited. The music scheduler looks ahead 120 milliseconds and schedules at most eight subdivisions per frame. Every one-shot source has a scheduled stop and disconnects on completion; switching tracks or starting a new race stops the old musical voices. Pausing stops the sequencing clock and fades the music. Muting silences the master. A missing or unavailable audio device does not prevent play.

## Verification and listening

Five audio tests verify complete arrangement event bounds, four distinct melodies and B responses, breakdowns and intensity additions, steel drums and Caribbean percussion audible in the opening arrangement with a warm note register, distinct gameplay effects and stereo scattering, and graceful no-device/settings/disposal behavior.

`scheduleScore` and `scheduleSfx` expose the exact same event recipes and synthesizer used live for genuine browser `OfflineAudioContext` rendering. For a combined audit, create one graph with `createAudioGraph`, then pass `destination:graph.music,reverb:graph.musicReverb` for score and `destination:graph.sfx,reverb:graph.sfxReverb` for effects. No normalization is applied by the rendering helpers; the rendered mix can be measured honestly. Listening and browser review are required in addition to the event tests; those results are recorded by the independent reviewer rather than inferred from code.

Self-review corrected two issues before the audio audit: harmony originally retriggered every bar while holding for two bars; it now retriggers every two bars. A shared room return originally bypassed individual volume sliders; separate room returns now enter the corresponding volume-controlled bus.

The independent audio critic then found a remaining blocker: the neon ambience pad used the SFX synthesizer, whose reverb still leaked through the SFX bus when Music was zero. The correction uses a dedicated ambience synthesizer with no reverb, routed exclusively through the music-controlled ambience bus. Its voices stop on track changes and disposal. Saved zero-volume preferences now initialize gains silently before the first sound, with fades used for subsequent adjustments.
