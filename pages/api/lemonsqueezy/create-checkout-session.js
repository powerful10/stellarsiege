import {
  getLemonConfig,
  lemonVariantForPack,
  priceForPack,
  requireFirebaseAuth,
  requestOrigin,
  setCors,
} from "../../../lib/server";

const API_URL = "https://api.lemonsqueezy.com/v1/checkouts";

async function postCheckout(payload, apiKey) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
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

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return;

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { apiKey, storeId, testMode } = getLemonConfig();
  if (!apiKey || !storeId) {
    res.status(501).json({ error: "Lemon Squeezy not configured on server." });
    return;
  }

  const user = await requireFirebaseAuth(req, res);
  if (!user) return;

  const { packId } = req.body || {};

  let pack;
  try {
    pack = priceForPack(packId);
  } catch {
    res.status(400).json({ error: "Invalid packId" });
    return;
  }

  const variantId = lemonVariantForPack(packId);
  if (!variantId) {
    res.status(501).json({ error: "Missing Lemon Squeezy variant ID for pack." });
    return;
  }

  const origin = requestOrigin(req);

  const payload = {
    data: {
      type: "checkouts",
      attributes: {
        product_options: {
          redirect_url: `${origin}/game/index.html?purchase=success`,
        },
        checkout_data: {
          custom: {
            uid: user.uid,
            packId,
            crystals: String(pack.crystals),
          },
        },
        ...(testMode ? { test_mode: true } : {}),
      },
      relationships: {
        store: { data: { type: "stores", id: storeId } },
        variant: { data: { type: "variants", id: variantId } },
      },
    },
  };

  const { res: apiRes, text, json } = await postCheckout(payload, apiKey);

  if (!apiRes.ok) {
    res.status(502).json({
      error: "Checkout creation failed",
      details: (json && json.errors) || text || "Unknown error",
    });
    return;
  }

  const url = json && json.data && json.data.attributes ? json.data.attributes.url : null;
  if (!url) {
    res.status(502).json({ error: "Checkout failed: missing URL" });
    return;
  }

  res.status(200).json({ url });
}
