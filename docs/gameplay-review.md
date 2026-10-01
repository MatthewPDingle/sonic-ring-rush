# Independent gameplay review

Date: 2026-10-01. Reviewed actual source, unit tests, real courses, browser keyboard inputs and an isolated mobile touch context. No game source changed by this reviewer.

**Verdict: PASS for a child-friendly playable household fan game.** The initial blockers were corrected. Physical gamepad and real mobile hardware remain untested; their absence is a verification limit rather than an observed defect.

## Corrected blockers

- Finish board originally printed projected unfinished rival times as completed times. `src/race.js` marks those rows `estimated`; `src/main.js:185` now renders **Behind you**, and the real player finish time stays visible. Browser finish verified Sonic 1st, 0:26.46, three rivals Behind you. These are unfinished racers, not measured AI finishes.
- All hazards originally occupied the right lane. `src/world.js:236` now rotates hazards across all three lanes. The actual-world regression suite checks this.
- Normal previously allowed idle first place on all worlds. `src/race.js:33` now makes normal rivals faster. Idle normal finished fourth on all three actual courses; simple active ring chasing, timely jumping and held boost won all three. Easy idle still finished first, giving young players a gentle first experience.
- Engine audio previously retained its last gain while paused, at results, or home. `src/main.js:83`, `:86` and `:175` now pause audio and update speed to zero; restart/resume explicitly enable it. Verified by source inspection, not recorded audio listening.

## Evidence

- `npm.cmd test`: 17/17 passed, including actual-world lane distribution and difficulty regression checks.
- Actual-course simulation (`output/playwright/gamecritic-balance.mjs`): normal idle 37.52/41.11/42.69 seconds, fourth on every world. Simple active play 24.91/26.61/28.27 seconds, first on every world, zero hits. This policy has exact simulation knowledge; it proves attainable race mechanics, not a novice usability study.
- Real keyboard UI: steer left changed offset to -3.82; jump reached y=2.78; boost raised speed and spent energy; Escape paused the race. Paused time and position stayed exactly unchanged across a subsequent 1.5-second wait.
- Real browser race completed two laps under held Shift; result ranking, actual player time, and persistent best-time data appeared correctly.
- Actual UI restart reset time and position to zero. Home then selecting Starlight and Sunset started the selected courses without crashes. Saved record data survived reload.
- Mobile emulation, 390x844, `hasTouch:true`, `isMobile:true`: touch controls visible; actual touch hold on left changed offset to -2.72; touch jump reached y=1.64. Touch capture/release paths executed without error. Not a physical phone performance test.
- Desktop diagnostics during exercised gameplay were approximately 110–120 FPS. This is observed on the review machine, not a portable hardware guarantee.

Screenshots: `output/playwright/gamecritic-race.png`, `gamecritic-result.png`, `gamecritic-touch.png`.

## Verification limits and nonblocking observations

- No physical gamepad attached. Standard stick, D-pad, A jump, X/RT boost, B brake, Start pause mappings were source-reviewed only. Gamepad menu navigation is absent.
- Automated new-tab/bring-to-front did not provide a reliable visibility/blur transition in the shared CLI browser. Blur/visibility pause handlers are present; physical tab switching is not independently certified by this review.
- A subsequent next-world click timed out amid apparent cross-session browser state changes. Direct track changes and restart were verified in one atomic operation; next-world behavior was source-reviewed only.
- Holding boost alone still wins normal without steering or jumping. That is acceptable for this forgiving household-game bar, but normal is an introductory difficulty rather than a demanding racing challenge.
- Very brief input taps wholly between rendered frames can be missed because inputs are polled rather than buffered. Normal held keyboard and touch presses worked. Buffering jump presses would improve low-frame-rate responsiveness.

Camera/portrait changes proposed after this review need their own visual confirmation; they do not change the verified race simulation.
