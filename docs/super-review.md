# Independent fourth-course Gauntlet review

Date: 2026-10-01. The critic reviewed the actual `src/main.js`, `src/world.js`, `src/super-track.js`, `src/race.js`, `src/character.js`, and `src/audio.js`, imported the shipped course into independent simulations, and operated the running game with ordinary UI and keyboard controls. No game source was changed by this critic.

## Reference and release bar

The established three-world household fan game is the minimum reference for readability and polish. Commercial Sonic racing is aspirational; this procedural fan game does not reach commercial assets, material detail, animation, or art direction. The requested additions are a much bigger fourth course, genuinely rideable vertical loops, more interesting obstacles, and visible tree-launched parrots with fair, avoidable, recoverable knocks.

## Independent evidence

- Fourth-course length is **3106.322 m**, roughly three times the original courses. The physical ribbon is 16 m wide and carries 320 rings, 13 spike hazards, six logs, six moving pendulums, 13 boost pads, five springs, and seven authored parrots.
- The two actual loop frames each rotate through approximately **6.28 radians**. Their crowns invert local up to below -0.9999; vertical climbs are 52 m and 58 m. Position and orientation remain continuous through their approaches, exits, and the lap seam. Dense frame sampling found maximum adjacent 0.4 m tangent change 0.0395 radians, no orthogonality defect beyond floating-point noise, and a 0.0002 m closing seam for points 0.0001 m either side of the start.
- Independent sampled loop deck clearance is at least **24.22 m** between lane-surface points at least 30 m apart along the loop and approaches. The authored pillars and gates leave the racing ribbon unobstructed. This is sampled clearance, not a complete analytic intersection proof.
- Six independent races imported the actual items, loops, and parrots: idle, engaged, and held-brake policies in both Little legends and Speed stars. All finished two laps. Every run emitted four loop entries, one final-lap transition, and fourteen parrot warnings. Loop height remained zero, including repeated jump inputs and held braking. Birds attacked once per lap; restart descriptors remained independent of attack state.
- Engaged policies avoided every parrot and won in about **79.97 s** in both modes. Idle easy won in **120.00 s**, while idle normal finished fourth in **122.40 s**. Holding brake still finished in approximately 379 s. These policies have exact simulation knowledge and prove mechanical attainability, not novice playability.
- Actual parrot hit warnings led contact by at least **1.8187 s** in the exercised course policies. The rendered bird origin remained within 0.29 m of the intended contact point after the collision substep. Exact progress 0.5 puts its origin at the same locked track lane and height used for the collision.
- Live browser captures show first-loop rise, inverted crown, descent, and exit, with Sonic visibly grounded and the world turning around the camera. The second inverted crown was captured at s=1537.84 m, loop progress 0.5031, height 0, and speed 80 m/s. No road clipping, camera obstruction, or missing track surface was observed.
- Live first-parrot captures show a bright red/blue bird diving from the tree, a CENTER LANE warning, contact by Sonic, a **20 to 15** ring change, speed reduction, and recovery feedback.
- Live lap reset at s=3107.74 m showed all seven birds back in `perched`, targets reset to zero, and `worldS` shifted by one course length. HUD displayed 2/2. Escape pause froze player state and race time exactly over a 1.2-second independent comparison.

Evidence scripts and screenshots are under `output/playwright/supercritic-*`.

## Bounds

The reviewer is using real browser frames for visual assertions and read-only `window.__ringRush.state` for timing, with normal keyboard/UI input. Pure simulations run quickly in Node and do not substitute for visual captures. Physical controller and phone hardware remain untested. Audio behavior is source-reviewed; it is not a recorded listening test.

## Live completion and evasion

- Completed an actual Little legends race in the live browser with ordinary keyboard input: **1st, 1:41.71**, two laps, saved personal best, and three unfinished rivals truthfully labelled Behind you.
- Actual jump evasion: the first second-lap bird remained locked at lane -2.0307; Sonic crossed it at s=3542.79 m with height **2.7447 m**. Rings stayed **39 to 39** and speed remained above 68 m/s.
- Actual steering evasion: a later warning locked lane -2.0307; a 450 ms right-arrow hold moved Sonic to +3.5219 before the crossing. The bird retained its locked target, rings rose from 29 to 34 through pickups, and no contact speed loss occurred.

## Minor correction resolved

The result caption RINGS COLLECTED described the final remaining ring balance. The easy test collected dozens of rings but finished with zero after later knocks and correctly displayed zero. The parent corrected the caption to RINGS KEPT in `index.html`, and the critic independently verified the final source wording. This was inherited UI wording, not a failure of the new course mechanics. Earlier result screenshots preserve the original caption as review evidence.

## Final live regression checks

- Completed an actual Speed stars race using ordinary arrow, Space, and Shift inputs: **1st, 1:22.60, 224 remaining rings**. The lap transition occurred at 40.96 s, and the saved result again distinguished unfinished rivals with Behind you. This automated keyboard policy knew course layout; it is a mechanics/UI test, not a novice-play study.
- The result-screen BACK TO EMERALD COAST control wrapped correctly from fourth to first world and immediately started Emerald Coast. Actual Restart race reset player distance, speed, height, offset, rings, and race time to zero, with boost reset to 70 and a fresh countdown.
- Sunset Ruins and Starlight Circuit both selected and started through the UI after the supertrack. Their character and camera were upright and normal, their courses rendered correctly, and no page errors occurred. Their full-race regressions remain covered by the original actual-world simulation tests; this reviewer did not repeat complete live races on those three worlds.
- At **390 x 844**, the menu scrolls vertically, all four cards remain readable and reachable, card widths stay inside the viewport, and menu client/scroll widths both equal 375 px. The screenshot after scrolling shows all four cards. At desktop resolution all four cards fit in one row. Phone-sized viewport checks do not certify a physical phone or its performance.
- The shipped test suite passed **26/26** at the critic's initial run. After the parent added actual-super-world regressions, the critic independently repeated the final suite and confirmed **29/29**. The successful final production build and ZIP packaging were performed by the parent.
- Live race diagnostics were about 110–120 FPS for ordinary captures; the active keyboard automation's lowest sampled diagnostic was 63 FPS. These observations are specific to the review machine and browser automation workload.

## Verdict

**PASS for the requested household fan-game features, with no observed release blocker.** The fourth course is substantially bigger, has two genuinely rideable full vertical loops, adds grounded jumpable logs and moving pendulums, and has visible tree-launched parrots whose warnings, fixed target lane, collision, knock, recovery, jump evasion, steering evasion, and per-lap reset agree. Both difficulties completed in the live product. Pause, restart, results, records, original-world transitions, and four-card desktop/mobile menu behavior were exercised.

The minor inherited result-caption issue is corrected. Physical gamepad/phone hardware, recorded audio listening, novice usability, and complete analytic geometry collision proofs remain outside this review. This game remains visibly below commercial Sonic fidelity and must not be represented as commercial parity.
