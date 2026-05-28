# Biplanes: Campaign Dialogue Popups Design

**Date:** 2026-05-27  
**Status:** Approved conversation design, pending implementation plan  
**Scope:** Narrative dialogue layer for single-player campaign missions.

## Goal

Add campaign dialogue popups that make each mission feel like a cartoon adventure episode without slowing down the arcade dogfight loop.

The tone is **child-friendly cartoon adventure**: warm, funny, brave, and mysterious, but not grim. Characters can joke under pressure; danger exists, but the story stays suitable for a toy-driven family audience.

## Narrative Structure

Each campaign mission has three dialogue phases:

1. **Pre-mission briefing**
   - 3-5 click-through lines before launch.
   - Explains the mission objective and emotional setup.

2. **In-combat radio popups**
   - 1-line radio messages appearing during gameplay.
   - Auto-dismiss after a short time.
   - Do not pause the game.
   - Triggered by mission timing, boss arrival, objective progress, or danger.

3. **Post-mission scene**
   - 2-4 click-through lines after victory.
   - Gives emotional payoff and a hook into the next mission.

## UI Behavior

### Briefing / Victory Window

- Centered or lower-third modal.
- Shows speaker portrait, speaker name, and text.
- Player advances line by line.
- Has a clear "continue" action.
- Blocks gameplay until dismissed.

### Radio Popup

- Small panel near a screen edge, away from the aiming/action area.
- Shows portrait, name, and one short line.
- Auto-fades after 3-5 seconds.
- New important messages can replace older non-critical messages.
- Should never cover the player plane, level-up choices, or death/victory screen.

## Content Rules

- One line should fit in one or two short rows.
- Dialogue must be readable while the player is flying.
- No lore dumps in combat.
- No cruelty, horror, or adult war tone.
- The lighthouse and lumen mystery should appear as recurring wonder, not exposition.

## Character Voices

- **Chico:** brave, warm, playful, never cynical.
- **Totti the turtle dispatcher:** calm, dry, slow, unintentionally funny.
- **Iskrik the hedgehog mechanic:** fast, technical, enthusiastic, often overexplains.
- **Mira the radio mouse:** clear mission information, emotional when stakes rise.
- **Old Ace:** short, calm, meaningful.
- **Bublik the cat cook:** comic relief and emotional warmth.
- **Jackals:** cheeky pack villains, stylish and theatrical.
- **Cartel:** polite, contractual, absurdly bureaucratic.
- **Order:** mysterious, poetic, not scary.

## First Implementation Slice

Implement only mission 1 first:

- Enable Story/Campaign entry from main menu.
- Start "Caravan in the Fog".
- Show pre-mission briefing.
- During battle, show three radio popups:
  - red dots on radar;
  - Iskrik mechanic joke;
  - Scar taunt / Chico reply.
- On victory, show post-mission scene.
- End with "To be continued" or return to menu.

This validates the dialogue presentation before writing mission-specific mechanics for all 15 levels.

## Canon Dialogue Source

The full campaign draft lives in `ДИАЛОГИ_КАМПАНИИ.md`.

## Risks

- Dialogue can distract from dogfighting if too large or too frequent.
- Text can become unreadable on small Telegram screens.
- Radio popups must not feel like tutorial spam.

## Acceptance Criteria

- Mission 1 feels like a story episode, not just arena mode.
- Player can start the campaign from the main menu.
- Dialogue is readable, short, and visually distinct from combat HUD.
- Combat remains playable while radio popups appear.
- Briefing and victory scenes are skippable by quick clicking/tapping.
