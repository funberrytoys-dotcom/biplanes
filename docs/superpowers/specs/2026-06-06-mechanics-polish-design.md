# Biplanes Mechanics Polish Design

**Date:** 2026-06-06
**Status:** v1 - approved direction from critical audit

## Goal

Turn the current playable prototype into a mechanics-first vertical slice where the first minute teaches flight, stall recovery, and combat through play. The project should stop expanding content until the core loop feels repeatable, readable, and worth replaying.

## Product Direction

Campaign is the primary player path. Arena remains a fast test and replay mode, but it should not compete with campaign as the main entry for new players.

The immediate polish slice focuses on three player truths:

- The plane is readable: the player understands speed, throttle, stall risk, and recovery.
- The first flight is forgiving: mistakes teach instead of ending interest.
- Repeat play has a reason: arena and mission results show progress, medals, or "almost had it" feedback.

## Flight Lab

Add an internal flight-lab mode for fast calibration. It starts with only the player plane, no enemy pressure, no campaign fail conditions, and a short on-screen objective stack:

- Add throttle and take off.
- Climb until stall warning appears.
- Recover by diving.
- Fire once after stable recovery.

This is not a public game mode yet. It is a tuning tool for playtests and can later become a tutorial segment.

## HUD And Readability

The HUD should keep the atmospheric gauges, but debug-like telemetry must become optional. Player-facing alerts should be short and actionable:

- GAS
- STALL - DIVE
- RECOVERED
- TARGET AHEAD
- CARAVAN UNDER FIRE

The plane and enemies need stronger contrast against cloud-heavy arenas.

## Mechanics Priorities

1. Prove stall recovery feels skillful.
2. Make boost a clear risk-reward action.
3. Restore a survivor-style pressure curve in arena after the flight basics are readable.
4. Make upgrade choices change flight/combat style instead of only raising numbers.
5. Add lightweight run metrics for playtest review.

## Release Hygiene

Before release work, the project needs:

- A clean working tree.
- A passing quality check.
- A browser smoke test.
- Mobile landscape checks.
- Asset weight budgets and loading discipline.

## Out Of Scope For This Slice

- New campaign levels.
- Monetization.
- Telegram SDK integration.
- Supabase.
- Full economy.
- New art direction.
