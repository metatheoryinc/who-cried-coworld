# Human-paced play implementation plan

**Goal:** Play one authenticated human seat against eight policies using the original Discord game's visual language and assets.

**Architecture:** Retain fast Session scheduling; add HumanSession using the same rules, actions, results, and replay. Human discussion uses authenticated, phase-bound chat alongside timed policy requests. The browser receives a seat-filtered snapshot and controls only its reserved seat.

**Tech stack:** TypeScript, Zod, WebSocket, esbuild; browser DOM/CSS with original game artwork.

## Timing design
- Discussion 150 seconds; twelve host-selected public turns: eleven at 13 seconds and a final 7-second turn. Prioritize the latest unanswered human message and named living bots, otherwise rotate fairly. Private team coordination runs alongside public speeches. Human public/private chat remains available throughout.
- Vote 45 seconds; night coordination 30 seconds; night actions 45 seconds.
- LLM attempt plus at most one repair share the turn deadline: 13 seconds for discussion (shortened at day end), at most 15 seconds for voting/night. Human action deadline remains 45 seconds. Late responses never move deadlines.
- Eight days maximum with five-second dawn/dusk pauses: conservative default budget 38m20s, below the 40-minute cap. Human connection default is 30 seconds; local lobby waits for the human before starting.
- Human disconnect preserves pending action until deadline. Reconnection restores role, permitted history, action status, and remaining time. No automatic bot takeover.

## Implementation steps
1. Add human config, timer budget, typed chat/snapshot protocol. Test timing and phase boundaries with fake monotonic time.
2. Implement separate human scheduler sharing existing resolution logic. Test private/public chat permissions, duplicate IDs, stale phase rejection, and full replay validity.
3. Add authenticated human socket and player asset routing. Reserve human seat; test reconnect, token rejection, and start behavior.
4. Adapt original game card layout, day/night backgrounds, private role card, clock, journal and chat into a responsive player page. Replace Discord state/actions with Coworld adapter; preserve hidden roles.
5. Provide local launcher with eight scripted or benchmark-prompt LLM policies. Wait for human Join before gameplay; write completed replay/results. Credentials stay server-side.
6. Run tests, typecheck, build; browser-review desktop/mobile and an accelerated scripted game. Document launch and hosted limitation.

## Scope decisions
A direct import of the React client would bring in the old game manager, Discord SDK, store and rules assumptions. Port visual pieces and assets while making the new typed protocol authoritative. Hosted Softmax human seating/certification is a separate deployment test; 40 minutes is accepted by the local SDK schema but not yet verified on the service.
