# Progress tracker — Kona game

Race week opens **Fri 2 Oct 2026**; race day **Sat 10 Oct, 06:25 HST**. Kona is the only active world.
St. George and Las Vegas are paused (`docs/PAUSED_WORLDS.md`).

## How progress is tracked

- **Source of truth:** GitHub milestones and issues in `joaoccaldas/studio-kona`
  (`gh issue list --milestone "Phase 0 · Live + playable on a phone"`).
- **Every PR** names the issues it closes (`Closes #N`) and states what was verified (browser capture, phone, tests).
- **This file** is the dated snapshot: update the status column and the log at the end of each work session.
- **Audit:** `docs/AUDIT_2026-09-28.md` is the baseline scorecard. Re-score it at the end of each phase.

Status: `todo` · `doing` · `done` (verified) · `blocked`.

## Phase 0 · Live + playable on a phone (due Tue 29 Sep)

| Issue | Item | Status |
|---|---|---|
| #3 | B1 public site 404: untrack node_modules symlink, CI build, Pages deploy | doing: symlink untracked in 374c6aa |
| #4 | B3 phone HUD covers ~70% of the screen | todo |
| #5 | B5 one quest system (real-date week) | todo |
| #6 | B6 one versioned save schema | todo |
| #7 | B7/B14 desktop HUD overlap + copy bugs | todo |
| #8 | Loading screen + first-load budget | todo |

## Phase 1 · The loop (due Thu 1 Oct)

| Issue | Item | Status |
|---|---|---|
| #9 | Level 0: Pack for Kona | todo |
| #10 | XP, Credits, medals, ledger | todo |
| #11 | Pier racks fill with unlocked bikes | todo |
| #12 | Locker + Kona town shop | todo |
| #13 | Guest play + account save (Supabase) | blocked: owner picks the Supabase project |
| #14 | KOA terminal kit + pier lighting pass | todo |

## Phase 2 · Race week live (2–10 Oct)

| Issue | Item | Status |
|---|---|---|
| #15 | Real-date days, daily challenge, streak, events | todo |
| #16 | Race-day live mode | todo |
| #17 | Museum labels match evidence | todo |
| #18 | Commit NAIP/USGS imagery swap; remove Esri | doing: `tools/imagery.py` committed, assets not rebuilt |

## Phase 3 and later

#19 graphics depth · #20 new regions · #21 repo consolidation · #22 paused worlds.

## Log

- **2026-09-28** Baseline audit (overall ≈35%). Uncommitted game work (airport, fog of war, gate, flights,
  winners hall, week campaign) committed as 374c6aa on `feat/raceweek-live` and pushed. Milestones and
  issues #3–#22 created. Screenshots: headless Chrome, 60 fps desktop + phone viewport on this Mac; no real
  phone tested.
