const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

require('dotenv').config();

const express = require('express');
const cors = require('cors');

const admin = require('firebase-admin');

const PORT = Number(process.env.PORT || 8787);
const ALLOWED_ORIGIN = (process.env.ALLOWED_ORIGIN || '').trim();

function getLemonConfig() {
  return {
    apiKey: (process.env.LEMON_API_KEY || '').trim(),
    storeId: (process.env.LEMON_STORE_ID || '').trim(),
    webhookSecret: (process.env.LEMON_WEBHOOK_SECRET || '').trim(),
    testMode: /^(1|true|yes)$/i.test((process.env.LEMON_TEST_MODE || '').trim()),
  };
}

function hasLemonSqueezy() {
  const { apiKey, storeId } = getLemonConfig();
  return Boolean(apiKey && storeId);
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
    lemonSqueezy: hasLemonSqueezy(),
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
  // You can move these to Lemon Squeezy variants later.
  if (packId === 'crystals_100') return { name: '100 Crystals', amount: 99, currency: 'usd', crystals: 100 };
  if (packId === 'crystals_550') return { name: '550 Crystals', amount: 499, currency: 'usd', crystals: 550 };
  throw new Error('Unknown packId');
}

function lemonVariantForPack(packId) {
  if (packId === 'crystals_100') return (process.env.LEMON_VARIANT_CRYSTALS_100 || '').trim();
  if (packId === 'crystals_550') return (process.env.LEMON_VARIANT_CRYSTALS_550 || '').trim();
  throw new Error('Unknown packId');
}

async function postCheckout(payload, apiKey) {
  const res = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return { res, text, json };
}

app.post('/api/lemonsqueezy/create-checkout-session', express.json(), requireFirebaseAuth, async (req, res) => {
  const { apiKey, storeId, testMode } = getLemonConfig();
  if (!apiKey || !storeId) {
    res.status(501).json({ error: 'Lemon Squeezy not configured on server.' });
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

  const variantId = lemonVariantForPack(packId);
  if (!variantId) {
    res.status(501).json({ error: 'Missing Lemon Squeezy variant ID for pack.' });
    return;
  }

  const origin = req.headers.origin || `http://localhost:${PORT}`;

  const payload = {
    data: {
      type: 'checkouts',
      attributes: {
        product_options: {
          redirect_url: `${origin}/?purchase=success`,
        },
        checkout_data: {
          custom: {
            uid: req.user.uid,
            packId,
            crystals: String(pack.crystals),
          },
        },
        ...(testMode ? { test_mode: true } : {}),
      },
      relationships: {
        store: { data: { type: 'stores', id: storeId } },
        variant: { data: { type: 'variants', id: variantId } },
      },
    },
  };

  const { res: apiRes, text, json } = await postCheckout(payload, apiKey);

  if (!apiRes.ok) {
    res.status(502).json({
      error: 'Checkout creation failed',
      details: (json && json.errors) || text || 'Unknown error',
    });
    return;
  }

  const url = json && json.data && json.data.attributes ? json.data.attributes.url : null;
  if (!url) {
    res.status(502).json({ error: 'Checkout failed: missing URL' });
    return;
  }

  res.json({ url });
});

// Lemon Squeezy webhooks need the raw body.
app.post('/api/lemonsqueezy/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const { webhookSecret } = getLemonConfig();
  if (!webhookSecret) {
    res.status(501).send('Missing LEMON_WEBHOOK_SECRET');
    return;
  }

  const sig = req.headers['x-signature'];
  if (!sig) {
    res.status(400).send('Missing X-Signature header');
    return;
  }

  const expected = crypto.createHmac('sha256', webhookSecret).update(req.body).digest('hex');
  const sigStr = String(sig || '');
  if (!sigStr || sigStr.length !== expected.length) {
    res.status(400).send('Webhook signature verification failed.');
    return;
  }

  const expectedBuf = Buffer.from(expected, 'utf8');
  const sigBuf = Buffer.from(sigStr, 'utf8');
  if (!crypto.timingSafeEqual(expectedBuf, sigBuf)) {
    res.status(400).send('Webhook signature verification failed.');
    return;
  }

  let payload;
  try {
    payload = JSON.parse(req.body.toString('utf8'));
  } catch {
    res.status(400).send('Invalid JSON payload.');
    return;
  }

  const eventName = req.headers['x-event-name'] || (payload.meta && payload.meta.event_name);

  if (eventName === 'order_created') {
    try {
      initFirebaseAdmin();
      const custom = (payload.meta && payload.meta.custom_data) || {};
      const uid = custom.uid;
      const crystals = Number(custom.crystals);

      const status = payload.data && payload.data.attributes ? payload.data.attributes.status : null;
      if (status && status !== 'paid') {
        res.json({ received: true });
        return;
      }

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
  console.log(`Lemon Squeezy: ${hasLemonSqueezy() ? 'enabled' : 'disabled'}`);
  console.log(`Firebase Admin: ${hasFirebaseAdminConfig() ? 'configured' : 'disabled'}`);
});
