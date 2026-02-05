import { getStripe, priceForPack, requireFirebaseAuth, requestOrigin, setCors } from "../../../lib/server";

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return;

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const stripe = getStripe();
  if (!stripe) {
    res.status(501).json({ error: "Stripe not configured on server." });
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

  const origin = requestOrigin(req);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    success_url: `${origin}/game/index.html?purchase=success`,
    cancel_url: `${origin}/game/index.html?purchase=cancel`,
    client_reference_id: user.uid,
    line_items: [
      {
        price_data: {
          currency: pack.currency,
          product_data: { name: pack.name },
          unit_amount: pack.amount,
        },
        quantity: 1,
      },
    ],
    metadata: {
      uid: user.uid,
      packId,
      crystals: String(pack.crystals),
    },
  });

  res.status(200).json({ url: session.url });
}
