# Stellar Siege Redesign Baseline (Phase 0)

## Production entrypoints
- Next homepage: `pages/index.js` (`/`)
- Static game shell: `public/game/index.html` via `next.config.js` rewrites for `/game/*`
- API routes:
  - `pages/api/health.js`
  - `pages/api/lemonsqueezy/create-checkout-session.js`
  - `pages/api/lemonsqueezy/webhook.js`
  - `pages/api/rewards/token.js`
  - `pages/api/rewards/claim.js`

## Critical flows to preserve
- Survival, Campaign (12 missions), Online Duel (RTDB rooms)
- Firebase Google sign-in, cloud save merge, leaderboard updates
- Lemon checkout create + webhook fulfillment idempotency
- Rewarded ad flows (game over, hangar, daily double)

## Baseline checks before rollout
- `npm run build` succeeds
- `/game/survival/start` boots and starts run
- Hangar renders and upgrades/purchases buttons are reachable
- Online screen opens, room create/join actions still wired
- API health endpoint reports config state

## Feature flags (gradual rollout)
- `window.STELLAR_FLAGS` (runtime defaults in `public/game/core/feature-flags.js`)
- Query override format: `?ff_<flag>=1` or `0`
- Local override key: `stellar_feature_flags_v1`

## Rollout intent
1. Stabilize runtime and canonical/domain handling
2. Introduce modular helpers without changing mode behavior
3. Layer gameplay/economy/ads integrity redesign behind flags
