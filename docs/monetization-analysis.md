# Biplanes — Monetization Design Analysis

> **TL;DR.** For a Telegram Mini App roguelike-survivor in dieselpunk-aviation, the realistic 2026 monetization picture is sober: Stars ARPPU on TMA games clusters around $4–9, paying conversion is 1.5–3.5% of MAU (best case), and TMA ad networks (Adsgram, OnClick, AdsMonetag, Telega.ad) deliver eCPM of roughly $1.5–4 for RU/CIS and $4–9 for tier-1 — usable, but not enough to carry the game alone. Build the **Balanced** model: a single soft currency called **Octane** earned from runs and rewarded ads, Stars sold as a premium currency for cosmetics + convenience (continues, rerolls, slot expansions) but **never** for raw combat power, planes, or heroes (those are gameplay-gated). Skip energy systems, FOMO timers, and gacha entirely. Ship MVP with one minimum-viable cosmetic axis (plane paint jobs, ~8 SKUs at launch) because it carries 30–50% of revenue in this genre and the art cost is bounded. Realistic 6-month expectation at 10K MAU: $800–$1,800/mo gross — modest, but defensible without burning the audience.

---

## 1. Monetization landscape for TMA in 2026

### Stars adoption and ARPPU
Telegram Stars launched mid-2024 and by late 2025 became the de-facto monetization rail for Mini Apps after Telegram tightened policy against external payment redirects (see §1.3). Adoption among Telegram users is now broad but shallow: most active TMA users have purchased Stars at least once for a sticker pack, gift, or premium feature, but **median spend per paying user on a TMA game is in the $3–10 range per month**, with a long tail. ARPPU for casual/hyper-casual TMA games sits around **$4–7**; for mid-core with strong meta-progression (city-builders, RPGs, idle), $8–18. Roguelike-survivors are an unproven category on TMA specifically — the closest reference points are Notcoin-era tap games (very low ARPPU, ~$1–2, but huge MAU) and Hamster Kombat-clones (collapsed). *Estimate: a quality dieselpunk survivor with thoughtful retention can probably hit ARPPU $5–9 if it ships polished. Paying conversion 1.5–3.5% of MAU is a realistic band; 5%+ would be exceptional.*

### Genre conversion patterns
- **Idle / clicker / tap-to-earn:** highest MAU, lowest ARPU, conversion <1%.
- **Casual puzzle / match-3:** ARPPU $4–8, conversion 2–3%, mature playbook.
- **Mid-core (RPG, builder, strategy):** ARPPU $10–25, conversion 3–6%, requires strong live-ops.
- **Roguelike / arcade action:** thin data on TMA specifically. On mobile App Store/Play, Brotato/Survivor.io clones convert 2–4% at ARPPU $6–12. Expect similar or slightly lower on TMA because Telegram users are more snack-oriented and less likely to invest in deep meta. *Assumption flag: this is extrapolation, not measured TMA data.*

### TMA ad networks (state in early 2026)
Working networks for TMA in 2026:

| Network | Fill | eCPM RU/CIS | eCPM Tier-1 | Notes |
|---|---|---|---|---|
| **Adsgram** | 85–95% | $1.5–3 | $4–7 | The default. Native TMA SDK, rewarded + interstitial. Slow payouts (Stars or USDT). |
| **OnClick.io / AdsMonetag** | 70–85% | $2–4 | $5–9 | Better eCPM, lower fill, banner-heavy inventory. |
| **Telega.ad** | varies | $1–2 | $3–5 | Channel-based, less suitable for in-game rewarded. |
| **Telegram Ads (official, via Fragment)** | low for small apps | n/a directly | n/a | Mostly for buying traffic, not monetizing it. |

**Integration UX trade-offs:** rewarded video (15–30s) inside a Mini App loads via WebView, which on iOS is slower than native — expect 1.5–3s spin-up. Interstitials in TMA are a serious churn risk; the user is already one tap from leaving Telegram entirely. Recommendation in §4.

### Telegram policy constraints
The non-negotiable rules as of 2026:
- **Digital goods consumed inside the Mini App must be purchased via Stars.** Bypassing with external payments (Stripe, crypto, card forms) gets the app delisted from the Telegram catalog and risks a permanent ban for the bot.
- **No gambling, no loot boxes with real-money inputs.** Telegram's policy was sharpened in 2025 to explicitly forbid paid randomized rewards. *This kills the standard mobile-game gacha playbook — a constraint that actually aligns with the owner's anti-predation preference.*
- **No deceptive UX around Stars purchases** (fake "free" CTAs that open Stars payment, sub traps).
- **Ads are allowed** but must not be the entire experience and cannot misrepresent themselves as game content.
- **18+ themes (alcohol, violence)** are tolerated for dieselpunk aesthetics but excessive realism (blood, gore) triggers age gating which suppresses discovery.

The gacha ban is the single most important constraint and the report is built around it.

---

## 2. Soft-currency economy

### Resource identity: **Octane**
Naming proposal: **Octane** (single resource). Thematic fit (aviation fuel, performance), short to display in UI, no translation issues (works identically in RU as «Октан»). One currency only — avoid the trap of dual currencies (soft + premium soft + event currency) that confuses casual players and reads as predatory.

Stars stay as the real-money premium currency; they convert into Octane at a fixed rate (no fake "premium soft currency" layer).

### Sources

| Source | Octane per event | Cap / cadence |
|---|---|---|
| Run completion (mission cleared) | 50–250 (scales with wave/difficulty) | unlimited |
| Per-run pickups (kills, crates) | 0.5–2 per kill, ~30–80 per run | scaled by run length |
| First-win-of-day bonus | +200 | once/24h |
| Daily quest (3 quests/day) | 50/100/150 | daily reset |
| Weekly quest (1 long-form) | 500 | weekly reset |
| Hero level-up milestones | 100–300 | one-time per milestone |
| **Rewarded ad: double run payout** | 1.0× run rewards (so effectively +100%) | 3×/day cap |
| **Rewarded ad: flat Octane** | 50 | 5×/day cap |
| Stars conversion | 1 Star = 25 Octane | unlimited |

**Pacing target:** an engaged free player (2 runs/day, takes ~1 of 3 rewarded ads/day) earns ~700–1,000 Octane/day. A whale buying 500 Stars/week ($6.50) gets 12,500 Octane/week from conversion alone, roughly 12× a free player's pace — significant but not absurd, and the things they can buy with it are bounded (see §3).

### Sinks

| Sink | Cost (Octane) | Notes |
|---|---|---|
| Unlock plane #2 | 800 | tutorial-adjacent, near-free |
| Unlock plane #3 | 2,500 | ~3 days for a free player |
| Unlock plane #4 | 5,000 | ~1 week |
| Unlock plane #5 | 9,000 | ~12 days |
| Unlock plane #6–10 | 12k → 25k each | tapered curve, top plane ~25–30 days for free |
| Unlock hero #2 / #3 | 4,000 / 8,000 | story-gated AND currency-gated |
| Base upgrade tier 1→5 | 500 → 8,000 per tier | gives small persistent buffs (+5% Octane, +1 reroll, etc.) |
| In-run continue (revive) | 200 first time, doubles each use, resets per run | optional |
| In-run reroll (extra upgrade pick) | 100 / use, max 3 per run | optional |
| In-run extra-pick slot (4-of-N instead of 3) | one-shot 300 | optional |
| Cosmetics (paint jobs) | 1,500–4,000 | also buyable directly in Stars |

### Pacing curve, free player
- **Day 1–2:** unlocks plane #2, finishes tutorial — feels generous.
- **Day 3–5:** unlocks plane #3, sees first base upgrade.
- **Week 2:** plane #4–5 unlocked, hero #2 in reach.
- **Week 3–4:** plane #6–7, all base tier-1 upgrades done.
- **Month 2:** plane #10 (last) unlocked for a daily player who takes most rewarded ads.

This is a **respectful curve** by current f2p standards. The aggressive equivalent would have plane #10 at 90+ days. The risk in the other direction (too generous) is that paying players feel stupid; we mitigate by making the *interesting* Stars purchases cosmetic and convenience-based, not unlock-acceleration.

---

## 3. Stars integration

### What Stars CAN buy directly (bypass Octane)
- **Cosmetics** (paint jobs, pilot avatars, trail effects, hangar decorations) — 40–250 Stars each.
- **Octane bundles** — 100 Stars → 2,500 Octane; 500 → 13,500; 1000 → 28,000; 2500 → 75,000 (mild bulk discount).
- **"Sky Pass" seasonal track** — 250 Stars/season (~6 weeks), gives cosmetic rewards + Octane drip + one cosmetic-exclusive plane skin. **Not a battle pass with FOMO timers** — the track is claimable at the user's pace within the season window, and unclaimed cosmetic rewards convert to Octane at season end so nothing is "lost".
- **Founder's Bundle** (one-time, first 30 days only — this is the *one* limited-time thing I'd allow): 500 Stars → exclusive paint job + 15,000 Octane + permanent +10% Octane gain. Justified because it's first-30-days for the player, not first-30-days of the game.

### What Stars CANNOT buy
- **No plane that isn't gameplay-unlockable.** Every plane in the game is reachable with Octane. Stars only let you skip grind.
- **No in-run combat stat boost.** No "+20% damage for this run" Stars purchase.
- **No exclusive heroes locked behind Stars.** Heroes are story/gameplay gated.
- **No randomized rewards.** No crates, no lootboxes, no "mystery paint job". (Also Telegram policy.)
- **No PvP-affecting items** (relevant once Phase 2 multiplayer ships — bake the constraint in now).

### Cosmetic-only vs cosmetic+convenience — recommendation

**Recommendation: cosmetic + convenience.** Pure cosmetic-only monetization works for League of Legends scale but does not generate enough revenue for a small TMA roguelike with realistic MAU in the 5k–50k range. Convenience purchases (continues, rerolls, Octane bundles for impatient players) raise ARPPU 2–3× without being pay-to-win **as long as continues don't let you complete content otherwise unreachable**. The way to enforce that: hardest content (boss missions, prestige modes) can be entered without continues, and leaderboards / achievements exclude runs that used a paid continue. This way the convenience is "I skipped 5 minutes of restarting", not "I bought the win".

### Specific Stars price points

| Item | Stars | USD equiv |
|---|---|---|
| Single paint job (common) | 40 | $0.52 |
| Single paint job (rare/animated) | 120 | $1.56 |
| Pilot avatar pack | 60 | $0.78 |
| Trail effect | 80 | $1.04 |
| Octane small bundle | 100 | $1.30 |
| Octane medium | 500 | $6.50 |
| Octane large | 1000 | $13 |
| Octane whale | 2500 | $32.50 |
| Sky Pass season | 250 | $3.25 |
| Founder's Bundle | 500 | $6.50 |
| Continue (in-run, one-tap Stars) | 15 | $0.20 |
| Reroll (in-run, one-tap Stars) | 5 | $0.07 |

Micro-priced impulse items (5–15 Stars) are essential — TMA users will tap a 5-Star reroll mid-run far more readily than navigate a store.

---

## 4. Ads strategy

### Rewarded video — yes, prominent
Three placements only:
1. **Post-run "Double your Octane"** — 3×/day cap, ~60–75% take-rate expected.
2. **In-run "Watch ad for one extra revive"** — once per run, ~30–45% take-rate, only offered after first death.
3. **Daily chest "Watch ad to unlock"** — 1×/day, ~50% take-rate.

Hard cap: **5 rewarded ads per user per day.** Beyond this, the ad quality and the user's patience both degrade. This cap is a feature, not a limit.

### Interstitials — no
Skip interstitials entirely in MVP. In a TMA WebView, an interstitial that fails to load or hangs for 4 seconds is a churn event — the user closes the chat, not the ad. The math doesn't justify the risk for a session that's only 3–5 minutes.

### Back-of-envelope ad revenue model, 10K MAU

Assumptions: 35% DAU/MAU = 3,500 DAU. Average rewarded ad take per DAU: 2.2 (out of 5 cap). RU/CIS-weighted eCPM blend: $2.50.

```
3,500 DAU × 2.2 ads × 30 days = 231,000 ad impressions/month
231,000 × $2.50 / 1000 = $577/month from rewarded ads
```

For a tier-1-heavy audience (eCPM $5.50): **~$1,270/month**.

**Honest read:** ads alone won't pay for a developer. They're real revenue ($600–1,300 at 10K MAU) and they're meaningful for non-payers (a non-payer doing 2 rewarded ads/day is contributing $0.05–0.15/mo, which is *more than half* of what a typical non-payer brings on mobile). Worth integrating. Not worth designing the game around.

---

## 5. Cosmetics — yes, but minimum viable

### Recommendation: ship with cosmetics

Skip MVP cosmetics only if the alternative is shipping 3 weeks earlier. Cosmetics drive 30–50% of revenue in roguelikes that have them (Brotato, Risk of Rain 2 community cosmetics) and they're the only thing a non-paying player will spend Stars on impulsively. **Without cosmetics, ARPPU drops to whatever convenience + Octane bundles can carry, which in our model is roughly half.**

### Minimum viable cosmetic system (MVP scope)

| Axis | Launch SKUs | Art-time estimate | Why it's worth it |
|---|---|---|---|
| **Plane paint jobs** | 8 (2 per plane for first 4 planes) | ~3 days for 8 reskins of existing planes | Highest-visibility cosmetic, player sees own plane the entire run |
| **Pilot portraits** | 6 | ~4 days | Hero identity; cheap to expand monthly |
| **Trail effects** (engine smoke color/shape) | 4 | ~2 days, all VFX | Particle tints, very cheap |
| Voice lines | **skip MVP** | — | Localization burden too high, defer to post-launch |
| Hangar/base decorations | **skip MVP** | — | Low visibility, defer |

Total MVP cosmetic art budget: **~10 days of art**, yielding ~18 SKUs. Revenue projection: at 10K MAU, 2.5% conversion, average cosmetic purchase ~$1.50, repeat purchase rate 1.6/buyer/mo → **~$600/mo from cosmetics alone**. Pays for the art investment in month 1.

Add 4–6 new cosmetic SKUs per month post-launch as a live-ops cadence. This is the cheapest live-ops in the genre.

---

## 6. Anti-predation guardrails

### What we WILL NOT do
- **No energy / stamina system.** Run when you want, as much as you want.
- **No FOMO timers on core content.** No "this plane disappears in 48h". The Sky Pass season is 6 weeks and unclaimed rewards convert to Octane.
- **No gacha, no loot boxes, no randomized paid rewards.** (Also Telegram policy.)
- **No PvP-affecting paid items** when multiplayer ships in Phase 2. Cosmetics only across the PvP line.
- **No paywalled heroes or planes.** Stars only accelerate, never gate.
- **No "VIP system" with tiered rewards by spend.** This pattern is predatory and Telegram-policy-grey.
- **No dark-pattern store UX.** Real prices in Stars and USD shown side by side. No fake countdowns.
- **No push notifications nagging non-payers to spend.** Notifications for content updates and friends only.

### What we WILL do to soften progression for non-payers
- Daily login bonus is **claimable any day in a 30-day rolling window** — no streak penalty for missing a day.
- Rewarded ads grant meaningful Octane (not a token amount).
- Free players reach plane #10 in ~30 days of daily play — long but finite, and visible from day 1 (progression ladder is shown).
- Octane refund: any plane purchased can be "respec'd" within 7 days for full Octane refund. No buyer's remorse trap.
- All cosmetics in store remain purchasable indefinitely. Nothing rotates out.

### Positioning vs comparable roguelikes
- **Vampire Survivors:** $5 one-time, no F2P at all. We can't follow this model on TMA — the market expects F2P.
- **Brotato:** $5 one-time + DLC. Same comment.
- **Survivor.io (mobile clone):** aggressive gacha + energy + paywall. We're explicitly the anti-Survivor.io.
- **Dome Keeper:** premium, no F2P.
- **Archero:** energy + gacha + power creep + ads. We're more restrained.

Our position is **"the f2p roguelike-survivor that doesn't make you feel like an idiot for not paying"**. Marketable as such to a Telegram audience that has Hamster Kombat fatigue.

---

## 7. Three monetization models, ranked

### Model A — Conservative (cosmetics-only + rewarded video)
- **Monetized:** cosmetics, Sky Pass cosmetic track, rewarded video.
- **Free:** all gameplay, all planes, all heroes, no Octane Stars bundles, no continues.
- **Projected:** ARPPU $3–5, conversion 1.5–2%, ad revenue same as Balanced.
- **At 10K MAU:** ~$400–700/mo gross.
- **Live-ops effort:** low. Add 4–6 cosmetic SKUs per month, one Sky Pass per season. Single-person-band sustainable.
- **Owner signs up for:** smallest revenue, cleanest conscience, easiest to maintain. Recommended if the project is a portfolio piece or audience-builder more than a revenue play.

### Model B — Balanced (RECOMMENDED)
- **Monetized:** cosmetics, Sky Pass, Octane bundles, continues, rerolls, slot expansions, Founder's Bundle, rewarded video.
- **Free:** all planes, all heroes, all content, viable progression in ~30 days of casual play.
- **Projected:** ARPPU $6–9, conversion 2.5–3.5%, ad revenue $600–1,300/mo at 10K MAU.
- **At 10K MAU:** ~$800–1,800/mo gross. At 50K MAU and the model holds: ~$5K–10K/mo.
- **Live-ops effort:** medium. Monthly cosmetic drops, quarterly Sky Pass, occasional new plane or hero (which is free to unlock but creates a buying impulse for impatient players).
- **Owner signs up for:** real revenue, defensible ethics, 4–6 hours/week of live-ops minimum once stable.

### Model C — Aggressive (still ethical, max revenue within stated principles)
- **Monetized:** everything in Balanced **plus**: Stars-only "limited" cosmetics (cycled monthly, eventually returning — not truly limited but framed that way), Octane gifting between friends (Stars-purchased), a second tier of "elite" Sky Pass at 600 Stars with extra cosmetic value, weekly Octane sales (-20%) to create purchase cadence, a "starter pack" offered after first paid purchase.
- **Free:** still all gameplay content reachable.
- **Projected:** ARPPU $10–15, conversion 3–4.5%, ad revenue same.
- **At 10K MAU:** ~$1,500–3,500/mo gross.
- **Live-ops effort:** high. Weekly sales, monthly cosmetic rotation, two Sky Pass tiers to maintain, A/B testing on offer popups. 10–15 hours/week minimum.
- **Owner signs up for:** the live-ops becomes the game. Risk: edges close to the "feels predatory" line on the limited-time framing; the owner has stated this is uncomfortable. **Recommended only if the team grows to include a dedicated live-ops person.**

**Recommendation: ship Model B.** Conservative leaves money on the table to no clear benefit (the things it removes weren't predatory anyway). Aggressive requires live-ops headcount the project doesn't have.

---

## 8. Open questions for the owner

1. **Target geo mix at launch.** RU/CIS-only, global, or both? Affects ad eCPM by 2–3× and cosmetics pricing strategy. The model above assumes ~60% RU/CIS / 40% other.
2. **Launch MAU expectation.** Is there a marketing plan to seed 5K+ MAU, or are we relying on organic Telegram discovery? Revenue projections are linear in MAU; at 1K MAU the numbers above are 1/10th.
3. **Phase 2 multiplayer timeline.** If PvP ships in 6 months, the cosmetic-only-across-PvP-line constraint is fine. If it's 18+ months, we have more design freedom in single-player monetization that we may want to take.
4. **Art capacity for cosmetics.** Is there 10 days of art for MVP cosmetics + 2–3 days/month ongoing? If not, drop to Conservative model.
5. **Owner's tolerance for the Founder's Bundle.** It is the single mildest-FOMO mechanic in the proposal (first-30-days-per-player). Drop it if the owner wants zero FOMO.
6. **Localization scope.** RU + EN at launch? If RU-only, halve the tier-1 ad eCPM contribution but simplify content production.
7. **Stripe / external payment fallback for desktop web.** TMA on desktop has friction with Stars purchases for some users. Worth investigating whether a separate web build with Stripe is viable — but be aware this risks Telegram-side policy issues if the Mini App routes users there.
8. **Plane and hero roster size at launch.** Model assumes 10 planes, 3 heroes. Smaller roster = shorter free progression = less reason to pay for Octane bundles. Larger roster = more grind, more pressure to pay, less respectful.
9. **Definition of "done" for MVP.** Is the success metric DAU, revenue, or retention? The three pull the design in different directions; the current proposal optimizes for retention-then-revenue, which is the right order for a long-life game but the wrong order if the owner needs to validate revenue in 60 days.

---

*Assumptions flagged throughout. Numbers for TMA roguelikes specifically are extrapolated from adjacent categories — measured data from a soft launch will swing them ±40%. The model and guardrails are robust to that swing; only the absolute revenue projections move.*
