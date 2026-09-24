# Phone Shell Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Branch 3 of `2026-09-24-phone-shell-and-action-stamps-design.md`: a conversation-first layout for viewports ≤ 760 px.

**Architecture:** Reuse the existing DOM. At ≤ 760 px CSS turns the header into a top bar, `.players` into a nine-seat strip, `.chat-panel` into the main view, `.action-panel` into a bottom sheet for stamp decisions, and `.personal` into a "You" sheet. `player.js` adds the role chip and **?** buttons, the sheet's seat grid, a player card sheet, sheet collapse state, speaker ring, and seat-numbered chat names. Desktop is unchanged except for the speaker ring and seat numbers in chat.

**Tech Stack:** Vanilla JS/CSS, Vitest for any pure helper, browser checks at 277×1488, 375×812, 1022×596, 2000×1104.

---

### Task 1: Shell layout (CSS + header controls)

- `player.html`: add `#role-chip` and `#help` buttons in the header, `#card-sheet` (player card), a sheet handle/pill in `.action-panel`, and a close button in `.personal`.
- CSS ≤ 760 px: body is a 100dvh flex column inside safe areas; sky background cropped (no frame); top bar ~52 px (small logo, phase, clock, **?**, role chip); `.players` a 9-column strip with seat numbers (names from 400 px); chat fills; footer hidden.
- Replace the previous ≤ 760 px stacked rules and the ≤ 420 px header rules.

### Task 2: Decision sheet

- When a stamp request is open, `.action-panel` is a fixed bottom sheet (~half height) with the tray and a 3×3 grid of large seat buttons (`.sheet-seats`) that accept stamps and show marks.
- Handle collapses to a pill "Vote · 0:32" / "Night actions · 0:41"; tapping the pill reopens. A new request opens the sheet.
- Tapping a strip token during a vote with nothing held places the vote stamp there and opens the sheet.

### Task 3: Player card sheet, You sheet, How to play

- Tapping a strip token otherwise (phone) opens `#card-sheet`: card art, name, seat, status/death cause, known role, Human/policy, this seat's votes from ballots.
- Role chip opens `.personal` as a sheet (role, teammates, journal, How to play). **?** opens How to play; the dialog is full-height on phones.

### Task 4: Seat identity cues (all sizes)

- Chat names carry a seat-number chip and a per-seat accent color.
- The host's current speaker gets a pulsing ring on their card/token.

### Task 5: Lobby, interstitial, game over on phones; verify; docs

- Lobby: join/you-have-a-seat card shown inline above chat; composer Join button unchanged.
- Interstitial: reduced margins, art scaled to width. Game over: two-column cards, actions pinned above the home indicator.
- Browser checks at all four sizes (lobby, discussion, vote stamping via sheet and strip, Wolf night with pack stamps, card sheet, You sheet, How to play, game over). Update `docs/testing/human-play.md`. Tests, tsc, build. Commit.
