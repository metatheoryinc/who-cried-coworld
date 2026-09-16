# Stage screens and original death markers

Restored original `tofu-tech` mafia-client assets for town elimination (meat icon), Wolf kill (claw scratches), day/night summaries, and day/night game-over scenes. Replaced the provisional generic X. Live cards remain coloured; dead role portraits on the ending screen are grey beneath their coloured death marker, matching the reference.

Human mode uses five-second server-owned dusk/dawn periods. Pending requests are empty and chat is disabled during them. The next phase gets its full duration, including after reconnect. Fast policy mode is unchanged. Full roles appear in human snapshots only when the game has ended. Winners follow result scores, including Trickster and draw outcomes.

Validation: 162 tests passed across 25 files; typecheck and build passed. Tests cover no-majority and survival summaries, public death causes, no action requests during transitions, complete next-phase timers, terminal role reveal, and fractional monotonic clocks. Browser verified the original tie illustration followed by night coordination, and completed-game cards with both death markers and role reveals. No paid model calls were used for this verification.

The backend timing change applies to newly started servers. An already-running match keeps its existing clock; it is not restarted by an asset rebuild. Updated clients can read role reveals from its completed replay when connecting to an older server.
