# Player screen graphics

Copied from the owner's Who Cried Wolf client under the reuse authorization
recorded in `../wcw/README.md`.

- Source repository: `/Users/jt/projects/tofu-tech`
- Source revision: `bd90913c4b506eda1985c78a4a5f85191a8158c5`
- Source directory: `apps/@hotpot-arcade/packages/games/mafia-client/src/images1x/`

Stamp and ability art added 2026-09-24 (source filenames preserved):

| File | Source | Used for |
| --- | --- | --- |
| `vote_banner_wolfs_claw.png` | `player-card/` | Wolf kill target stamp |
| `abstain_town.png` | `confirm-buttons/` | Skip vote (dove) |
| `guard_icon.png` | `player-card/` | Guard protect |
| `potion_icon.png` | `player-card/` | Alchemist block |
| `seer_icon.png` | `player-card/` | Seer inspect |
| `chef_icon.png` | `player-card/` | Chef jail |
| `milk_icon.png` | `player-card/` | Dairy Maid inform |
| `priest_icon.png` | `player-card/` | Priest track |
| `track_icon.png` | `player-card/` | Track Reader check |
| `knife_icon.png` | drawn for this project (`docs/design/art/knife_icon.svg`, rasterized with `sips`) | Wolf knife (who performs the kill) |

Derived layout images (2026-09-24), cut from `bg_day.png` / `bg_night.png` with
ffmpeg so the desktop frame can be 9-sliced and expand with the window:

| File | Crop of | Region (x, y, w, h) |
| --- | --- | --- |
| `frame_day.png` | `bg_day.png` | 0, 0, 1920, 1160 (frame and scene, above the table) |
| `frame_night.png` | `bg_night.png` | 0, 0, 1920, 1160 |
| `table.png` | `bg_day.png` | 0, 1202, 1920, 238 (wood table band) |

Frame bars: top y 29–47, bottom y 1117–1135, left x 40–57, right x 1854–1872;
corner ornaments stay within 175×160 (top) and 175×150 (bottom) slices.
