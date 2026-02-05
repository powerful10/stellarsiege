const path = require('path');
const fs = require('fs');

require('dotenv').config();

const express = require('express');
const cors = require('cors');

const Stripe = require('stripe');
const admin = require('firebase-admin');

const PORT = Number(process.env.PORT || 8787);
const ALLOWED_ORIGIN = (process.env.ALLOWED_ORIGIN || '').trim();

function hasStripe() {
  return Boolean((process.env.STRIPE_SECRET_KEY || '').trim());
}

function hasFirebaseAdminConfig() {
  return Boolean((process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim() || (process.env.FIREBASE_SERVICE_ACCOUNT_FILE || '').trim());
}

function initFirebaseAdmin() {
  if (admin.apps && admin.apps.length > 0) return;

  let creds = null;

  const jsonInline = (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
  if (jsonInline) {
    creds = JSON.parse(jsonInline);
  } else {
    const file = (process.env.FIREBASE_SERVICE_ACCOUNT_FILE || '').trim();
    if (file) {
      const full = path.isAbsolute(file) ? file : path.join(process.cwd(), file);
      const raw = fs.readFileSync(full, 'utf8');
      creds = JSON.parse(raw);
    }
  }

  if (!creds) throw new Error('Missing Firebase Admin credentials (FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_FILE).');

  admin.initializeApp({
    credential: admin.credential.cert(creds),
  });
}

function createStripe() {
  if (!hasStripe()) return null;
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-06-20',
  });
}

const stripe = createStripe();

const app = express();

app.disable('x-powered-by');

app.use(
  cors({
    origin: ALLOWED_ORIGIN || false,
    credentials: true,
  })
);

// Serve only the frontend files we need (avoid exposing the whole folder).
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/styles.css', (req, res) => res.sendFile(path.join(__dirname, 'styles.css')));
app.get('/script.js', (req, res) => res.sendFile(path.join(__dirname, 'script.js')));
app.get('/firebase-config.js', (req, res) => res.sendFile(path.join(__dirname, 'firebase-config.js')));
app.get('/privacy.html', (req, res) => res.sendFile(path.join(__dirname, 'privacy.html')));
app.get('/terms.html', (req, res) => res.sendFile(path.join(__dirname, 'terms.html')));

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    stripe: Boolean(stripe),
    firebaseAdmin: hasFirebaseAdminConfig(),
  });
});

function requireFirebaseAuth(req, res, next) {
  try {
    initFirebaseAdmin();
  } catch (err) {
    res.status(501).json({ error: 'Firebase Admin not configured on server.' });
    return;
  }

  const auth = req.headers.authorization || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    res.status(401).json({ error: 'Missing Authorization: Bearer <idToken>' });
    return;
  }

  const token = match[1];
  admin
    .auth()
    .verifyIdToken(token)
    .then((decoded) => {
      req.user = decoded;
      next();
    })
    .catch(() => {
      res.status(401).json({ error: 'Invalid auth token' });
    });
}

function priceForPack(packId) {
  // You can move these to Stripe Products + Prices later.
  if (packId === 'crystals_100') return { name: '100 Crystals', amount: 99, currency: 'usd', crystals: 100 };
  if (packId === 'crystals_550') return { name: '550 Crystals', amount: 499, currency: 'usd', crystals: 550 };
  throw new Error('Unknown packId');
}

app.post('/api/stripe/create-checkout-session', express.json(), requireFirebaseAuth, async (req, res) => {
  if (!stripe) {
    res.status(501).json({ error: 'Stripe not configured on server.' });
    return;
  }

  const { packId } = req.body || {};

  let pack;
  try {
    pack = priceForPack(packId);
  } catch {
    res.status(400).json({ error: 'Invalid packId' });
    return;
  }

  const origin = req.headers.origin || `http://localhost:${PORT}`;

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    success_url: `${origin}/?purchase=success`,
    cancel_url: `${origin}/?purchase=cancel`,
    client_reference_id: req.user.uid,
    line_items: [
      {
        price_data: {
          currency: pack.currency,
          product_data: {
            name: pack.name,
          },
          unit_amount: pack.amount,
        },
        quantity: 1,
      },
    ],
    metadata: {
      uid: req.user.uid,
      packId,
      crystals: String(pack.crystals),
    },
  });

  res.json({ url: session.url });
});

// Stripe webhooks need the raw body.
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe) {
    res.status(501).send('Stripe not configured');
    return;
  }

  const sig = req.headers['stripe-signature'];
  const secret = (process.env.STRIPE_WEBHOOK_SECRET || '').trim();
  if (!secret) {
    res.status(501).send('Missing STRIPE_WEBHOOK_SECRET');
    return;
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, secret);
  } catch (err) {
    res.status(400).send(`Webhook signature verification failed.`);
    return;
  }

  if (event.type === 'checkout.session.completed') {
    try {
      initFirebaseAdmin();
      const session = event.data.object;
      const uid = session.metadata && session.metadata.uid;
      const crystals = Number(session.metadata && session.metadata.crystals);

      if (uid && Number.isFinite(crystals) && crystals > 0) {
        const db = admin.firestore();
        const ref = db.collection('users').doc(uid);

        await db.runTransaction(async (tx) => {
          const snap = await tx.get(ref);
          const data = snap.exists ? snap.data() : {};
          const profile = (data && data.profile) || {};

          const current = Number(profile.crystals || 0);
          const next = current + crystals;

          tx.set(
            ref,
            {
              profile: {
                ...profile,
                crystals: next,
                updatedAt: Date.now(),
              },
              upgrades: (data && data.upgrades) || {},
              version: 1,
            },
            { merge: true }
          );
        });
      }
    } catch (err) {
      // Don't fail the webhook, just log.
      console.error('[webhook] fulfill failed', err);
    }
  }

  res.json({ received: true });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Stripe: ${stripe ? 'enabled' : 'disabled'}`);
  console.log(`Firebase Admin: ${hasFirebaseAdminConfig() ? 'configured' : 'disabled'}`);
});
