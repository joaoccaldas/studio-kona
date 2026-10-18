# Living island and rewards (2026-09-28)

The island changes with the race-week day you are playing, and rewards bring you back each day.
Screenshots: `renders/life/` (phone 390×844 and desktop 1440×900, headless Chrome on this Mac, 60 fps).
Asset previews: `renders/kit_preview_big.jpg`, `renders/kit_preview_life.jpg`.

## Assets (`blender/kit.py` → `web/public/assets/kit/kona_kit.glb`, 0.63 MB, 4,854 faces)

Built headless: `blender -b --factory-startup --python-exit-code 1 -P blender/kit.py` (`KIT_PREVIEW=1` renders previews).
One mesh per asset, colours in a vertex-colour attribute. Pure white parts are tinted per instance in the game.

| Asset | Used for |
|---|---|
| `arch_frame`, `arch_final` | Finish arch on Aliʻi Drive: scaffolding in the build-up days, finished with plain "FINISH" text (no race logo) |
| `barrier`, `grandstand`, `flagpole`, `flag` | Finishing stretch; flags wave in a vertex shader |
| `tent`, `expo_tent`, `aid` | Expo on the King Kamehameha lot; aid stations on race day |
| `person`, `person_cheer`, `runner`, `cyclist`, `swimmer` | Crowds and athletes (instanced, moving along the routed courses) |
| `honu`, `canoe`, `umbrella`, `surfboard`, `shave_ice`, `lei` | Beach and town life; leis at the finish after the race |
| `shell`, `coral_stone` | Daily collectible; white coral messages on the Queen K lava |

## Phases (`web/src/islandLife.js`)

| Phase | Days | What you see |
|---|---|---|
| Quiet island | Day 1 before anything is done | Honu, paddlers, beach umbrellas, a few athletes |
| Race week builds | Sat 3 – Wed 7 | Arch scaffolding, expo tents, flags going up day by day, athletes training, coral messages accumulating |
| Final days | Thu 8 – Fri 9 | Finished arch, barriers, grandstand, crowds (Underpants Run on Thu 8), bike check-in fills the pier racks on Fri 9 |
| Race day | Sat 10 | Swimmers in the bay, cyclists on the Queen K, runners and finishers, aid stations, full crowds, a coral message with the player's name |
| After the race | Sun 11 – Mon 12 | Leis at the finish, barriers coming down, quiet town |

Evidence: positions from data (run route end = finish; routed bike/run courses; King Kamehameha lot; Kamakahonu and
Kahaluʻu beaches). Spacing of aid stations (16 km bike, 1.6 km run), flags, barriers and crowd density is inferred (I).
Coral messages are a real Queen K tradition; the wording is generic.

## Rewards (`web/src/rewards.js`, `web/src/lifeHud.js`)

- **XP** (level) and **Credits** (spendable once the town shop exists, issue #12). Step +40 XP +10, day +150 XP +50.
- **Daily check-in**: gift + item roll; the streak multiplies everything earned (+10% per day, max ×1.5); a ticket every 3rd day.
- **Days open** one per day played, or on the real Hawaiʻi date (2–12 Oct 2026). **Fast-forward tickets** open one early.
  When the next day is closed the player free-roams, with the compass on the nearest shell.
- **Shells**: 5 a day on open ground (beaches, seawall, lot, finish, Aliʻi Drive), same for everyone on a date; 8% golden.
- **Honu**: spotting one from 3–15 m gives a reward once; closer than 3 m (10 ft) shows the beach rule instead.
- **Items** by rarity (common → legendary), shown in the bag (tap the wallet chip).
- Saved locally under `kona-rewards-v1`; shaped to sync to an account later (#13).

## Known gaps

- Ground at street level is still the coarse DEM + orthophoto; buildings are untextured (#14, #19).
- Items are collectibles only; Credits have nothing to buy yet (#12).
- Rewards are client-side and trust the device until the server ledger exists (#10, #13).
- Not tested on a real phone.
