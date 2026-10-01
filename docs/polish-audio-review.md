# Independent audio polish review

Final verdict: mechanical quality PASS for the reviewed renders after two returned defects were corrected. Subjective listening is unavailable in this model: an independent attempt to ingest the real coastal WAV returned `audio content omitted because you do not support audio input`. This is an external capability boundary, not a pending listening task. No subjective listening PASS is claimed.

The baseline in `output/polish-baseline/audio.js` uses one short triangle melody and sine bass across all four courses. The revision in `src/audio.js` and `src/score.js` authors four scores with different melodies, tempo, instrumentation and percussion, plus longer arrangements and multi-layer effects. Those are source facts, not listening conclusions.

## First source audit

- The music and SFX reverb returns now route through their corresponding volume bus. This fixes the earlier wet-return bypass for ordinary musical voices and effects.
- The initial audit found Neon Night's environmental pad routing its wet return through SFX. The builder corrected this with a dedicated dry `_ambienceSynth`, stopped on track switch and disposal. Independent source reinspection confirms the correction; the actual eight-second Neon Music=0 render has exactly zero-valued PCM in both channels.
- The realtime scheduler has a bounded 120 ms lookahead and at most eight subdivisions per update, with gap recovery. Completed voices disconnect their sources, envelopes, panners and intermediate nodes.
- A subsequent source revision fades stopped musical and ambient envelopes over 25 ms, then ends sources at 30 ms. This addresses abrupt-stop concerns on browsers with `cancelAndHoldAtTime`, and the dedicated dry ambience synthesizer prevents prolonged old-world ambient tails during course changes. Already playing gameplay effects can retain their short tails.
- Pause attenuates music and stops future sequencing, but up to 120 ms of queued events and existing tails can still play quietly. This should be judged against the intended pause behavior in the actual game.

## Actual render findings

The root rendered 24 kHz, stereo, 16-bit WAVs through the actual `GameAudio` graph. This review independently decoded their PCM; neither sample normalization nor screenshot interpretation was used.

| Render | RMS | Absolute peak | Clipped samples |
| --- | ---: | ---: | ---: |
| Baseline, 36 s | 0.003853 | 0.040466 | 0 |
| Corrected Coast, 36 s | 0.063097 | 0.397095 | 0 |
| Corrected Ruins, 36 s | 0.051766 | 0.361816 | 0 |
| Corrected Neon, 36 s | 0.057498 | 0.478149 | 0 |
| Corrected Jungle, 36 s | 0.060629 | 0.371582 | 0 |
| Corrected Jungle with effects, 36 s | 0.058689 | 0.362305 | 0 |
| Effects reel, 36 s | 0.014614 | 0.264832 | 0 |
| Neon Music=0, 8 s | 0 | 0 | 0 |

The initial score renders failed mechanical review: they contained isolated, one-sample negative impulses with adjacent jumps of approximately 0.92. Examples from the retained failing renders:

- Ruins at 10.046 s, left: `0.00049, -0.91843, 0.00165`; right: `0.00052, -0.72397, 0.00137`.
- Neon at 33.046 s, left: `-0.00037, -0.91904, 0.00052`.
- Jungle at 23.379333 s, left: `-0.02155, -0.92862, -0.01343`.
- Coast at 35.046 s, left: `-0.01004, -0.92349, -0.00943`.

These are objective discontinuities inconsistent with the surrounding musical waveform. A zero clipping count alone could not justify a mechanical quality PASS. They occurred at score event times plus 6 ms; every listed event included snare and hat, while the Coast/Jungle events had no kick or bass. The actual browser float peak measurements agreed with the PCM peaks. The baseline did not have comparable impulses.

The critic returned these examples and the hypothesis that a GainNode's default gain of 1 before the future scheduled zero could leak a noise sample at a fractional start time. Simple root isolation with individual snare/hat voices, compressor on/off and 24/48 kHz did not reproduce the large impulse. The root nevertheless applied the robust initialization fix: `envelope.gain.value = 0` immediately after node creation, before scheduling its future automation.

The critic independently decoded all four regenerated 36-second scores and the regenerated 36-second Jungle mix. The exact former failures are now continuous; for example Ruins at 10.046 s is `0.000671, 0.000824, 0.002319`, and Neon at 33.046 s is `-0.000519, -0.000519, 0.000732`. Every corrected score and mix has zero adjacent jumps greater than 0.3, zero isolated deviations greater than 0.3 from the average of neighboring samples, and zero clipped PCM samples. Peaks are at most 0.478149, leaving more than 6 dB of numerical headroom in these excerpts. This clears the concrete impulse blocker; the precise browser rounding mechanism remains a hypothesis.

The revised samples have measurable stereo differences, whereas the baseline channels are identical. Their four-second RMS windows show the intended intro-to-A increase. These measurements establish signal changes, not perceived musicality, steel-drum recognition, enjoyable balance, or warning clarity.

The effects reel has nonzero, differing rendered waveforms for ring, jump, boost, bird warning and hit. Selected isolated windows show peaks of 0.1374, 0.0649, 0.1309, 0.0959 and 0.2147 respectively. Their source recipes and measured spectral/temporal profiles differ, including stereo warning/ring scattering. This establishes actual synthesis of separate signals, not perceptual recognition or clarity during play.

## Listening limits and remaining evidence

Human audition of the supplied renders can assess lead/bass/pad/drum balance, perceived theme differences, racing energy, and whether ring, jump, boost, bird warning and hit remain understandable against music. A waveform, peak/RMS measurement, or different JSON event signature cannot establish those subjective outcomes. The reviewer could not perform this audition because the runtime rejected audio input.

The 36-second renders cover intro, A and the beginning of B. They do not cover breakdown, reprise, finale or the complete 64-bar wrap. Full transition quality is unverified. Source confirms the later Caribbean revision adds independently decaying steel-pan partials from the first bar, lowers the coastal/jungle lead register and adds conga, shaker, clave and island bass; those facts do not establish perceptual recognition.
