# Stellar Siege Redesign Balance Notes (Phase 2-5)

## Core tuning constants

| System | Constant | Value |
|---|---|---|
| Ability | Scout Dash cooldown | 12s |
| Ability | Striker Overdrive cooldown / duration | 22s / 6s |
| Ability | Ranger Rail Shot cooldown | 16s |
| Ability | Astra Drone Swarm cooldown / duration | 30s / 12s |
| Ability | Warden Fortress cooldown / duration | 28s / 5.5s |
| Ability | Valkyrie Heal Pulse cooldown / max uses | 32s / 3 uses |
| Adaptive difficulty | early run scalar | 0.92 |
| Adaptive difficulty | strong performance scalar | 1.08 |
| Adaptive difficulty | low HP scalar | 0.90 |
| Rewarded ads | cooldown | 90s |
| Rewarded ads | session cap | 6 |
| Rewarded ads | daily cap | 15 |
| Rewarded ads | min away time for direct-link claim | 12s client / 12s server |
| Guest claim | daily cap | 6 |
| Guest claim | max credits per claim | 180 |
| Auth claim | daily cap | 15 |
| Auth claim | max credits per claim | 1200 |

## Economy tuning

| Placement | Credits | Crystals | XP |
|---|---:|---:|---:|
| Survival reward ad | 320 | 0 | 80 |
| Campaign reward ad | 440 | 0 | 120 |
| Duel reward ad | 560 | 0 | 140 |
| Hangar reward ad A | 380 | 0 | 0 |
| Hangar reward ad B | 920 | 0 | 0 |

## Why these values

- Early waves are less punishing by reducing initial spawn pressure and using adaptive softening.
- Mid/late waves gain variety via lancer/bulwark/leech archetypes and elite modifiers.
- Ability cooldowns are short enough to feel active, but long enough to avoid spam.
- Rewarded ads are capped and cooldown-gated to reduce farming while keeping utility.
- Guest claims are stricter than authenticated claims for integrity.

## Quick balance test cases

1. Survival wave pacing:
   - Start a new run, verify first 3 waves feel survivable with base Scout and no upgrades.
2. Mid-game enemy variety:
   - Reach wave 12+, verify lancer/bulwark/leech appear and are visually distinct.
3. Boss phase readability:
   - Reach a boss wave and confirm phase shifts alter attack pattern and pressure.
4. Ability impact:
   - Trigger each ship ability at least once and confirm clear combat impact + cooldown feedback.
5. Reward integrity:
   - Attempt rapid repeated ad claims and verify cooldown/session/daily caps enforce.
6. Direct-link short-watch defense:
   - Open/close ad quickly (<12s) and verify reward does not grant.
