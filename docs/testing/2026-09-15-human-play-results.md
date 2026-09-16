# Human mode browser verification — 2026-09-15

- 155 tests passed across 23 files; typecheck and build passed.
- Scripted accelerated browser game completed: **town_win**, day 4, 299 events.
- Browser exercised human public chat and private Wolf chat, locked vote, reload/reconnect, and Alchemist kill plus block submission. Replay records human slot 5 nominating target 2 with killer 1 and blocking target 7 on Night 1.
- Desktop 1440×900 and narrow desktop checked; chat composer remains inside the viewport. Mobile 390×844 checked with no horizontal page overflow; chat and journal remain scrollable.
- LLM timeout/repair behavior tested with hung and invalid mocked providers. No paid LLM calls were made during this verification. A fresh real-time LLM lobby was prepared separately for the user to join.
- Original game art/layout was adapted; Discord authentication, music and animations are outside this port.

Artifact: `artifacts/human-1789516720802/replay.json` (local, ignored by Git).
