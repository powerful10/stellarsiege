# Stellar Siege (Web)

This folder contains a fully client-side game **plus** optional production integrations for:
- Google sign-in (Firebase Auth)
- Cloud saves + global leaderboard (Firestore)
- Paid crystal packs (Stripe Checkout + webhook fulfillment)
- Ads (Google AdSense)

## Run Locally

### 1) Simple (no backend)
Open `public/game/index.html` in a browser.
- Works offline.
- Google login, global leaderboard, and real purchases will be disabled.

### 2) Full dev server (recommended)
1. Install deps:
   - `npm install`
2. Copy env:
   - copy `.env.example` to `.env` and fill values (see below)
3. Start:
   - `npm run dev`
4. Open:
   - `http://localhost:8787`

Note: This project is now a **Next.js** app. The old `server.js` Express server is legacy and not used by `npm run dev`.

## Campaign / Missions
- Click **Campaign** from the main menu.
- Missions unlock sequentially.
- HUD shows the current objective.

## Google Sign-In + Cloud Save (Firebase)

### Required
- A Firebase project
- Enable **Authentication -> Google**
- Enable **Firestore**
- Enable **Realtime Database** (for online duels / rooms)

### Setup
1. Edit `public/game/firebase-config.js`:
   - Set `window.FIREBASE_CONFIG = { ... }` from Firebase console
   - Include `databaseURL` (Realtime Database URL)
2. Run via `http://localhost` (not `file://`).

### Firestore data model
- `users/{uid}`
  - `profile`: { name, xp, credits, crystals, updatedAt, ... }
  - `ships`: { [shipId]: { owned, upgrades } }
- `leaderboard_survival/{autoId}`
  - { uid, name, score, wave, createdAt }

### Security rules (example)
You must configure rules in Firebase console.
A basic starting point (tighten as needed):

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }

    match /leaderboard_survival/{docId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update, delete: if false;
    }
  }
}
```

## Payments (Stripe)

### What’s implemented
- Client calls `POST /api/stripe/create-checkout-session` with Firebase ID token.
- Server creates a Stripe Checkout session.
- Stripe webhook (`/api/stripe/webhook`) fulfills the purchase by incrementing `profile.crystals` in Firestore.

### What you must provide
- Stripe account
- Stripe secret key + webhook secret
- Firebase Admin service account JSON

### Setup
1. In `.env` set:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `FIREBASE_SERVICE_ACCOUNT_FILE` (or `_JSON`)
2. Add a Stripe webhook endpoint pointing to:
   - `https://YOUR_DOMAIN/api/stripe/webhook`
3. In `public/game/firebase-config.js`, set:
   - `window.PAYMENTS_API_BASE = ""` for same-origin, or your API domain.

## Ads (AdSense)

1. Apply for AdSense and get approved.
2. In `public/game/index.html`, uncomment the AdSense `<script>` and ad slots.
3. Replace:
   - `ca-pub-XXXXXXXXXXXXXXX`
   - `data-ad-slot="..."`

## Legal / Compliance (Important)
Before monetizing you typically need:
- Real **Privacy Policy** and **Terms** (`privacy.html`, `terms.html` are placeholders)
- Cookie consent (often required for ads/analytics depending on region)
- Clear disclosure for paid advantages ("pay-to-win")
- Refund policy compliance

## Deploy
This is a Next.js app (frontend + API routes). You can deploy to:
- Vercel (easiest)
- A Node host that can run `next start`

If you deploy frontend + backend separately, set `PAYMENTS_API_BASE` in `public/game/firebase-config.js`.

