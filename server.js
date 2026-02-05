import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env explicitly from this folder
dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
app.use(express.json());

const PUBLIC_DIR = path.join(__dirname, "public");

if (!fs.existsSync(PUBLIC_DIR)) {
  console.error("❌ public folder not found at:", PUBLIC_DIR);
}

// Serve frontend (so /css/* and /js/* work)
app.use(express.static(PUBLIC_DIR));

// Simple health + debug
app.get("/health", (_, res) => res.json({ ok: true }));
app.get("/debug/public", (_, res) => {
  res.json({
    publicDir: PUBLIC_DIR,
    files: fs.readdirSync(PUBLIC_DIR),
  });
});

// UI route
app.get("/raast", (_, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "raast.html"));
});

// RTP endpoint
app.post("/api/rtp", async (req, res) => {
  try {
    const {
      aggregator_merchant_identifier,
      amount,
      order_id,
      request_id,
      type,
      debitor_type,
      debitor_value,
    } = req.body;

    if (!aggregator_merchant_identifier)
      return res.status(400).json({ error: "Missing aggregator_merchant_identifier" });

    const payload = {
      aggregator_merchant_identifier,
      amount,
      order_id,
      request_id,
      type,
    };

    // map debitor field correctly
    if (debitor_type === "IBAN") payload.debitor_iban = debitor_value;
    if (debitor_type === "RAAST_ID") payload.debitor_raast_id = debitor_value;
    if (debitor_type === "VAULT_TOKEN") payload.debitor_vault_token = debitor_value;

    const url = `https://api.getsafepay.com/raastwire/v1/aggregators/${process.env.RAAST_AGGREGATOR_ID}/payments`;


    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-SFPY-AGGREGATOR-SECRET-KEY": process.env.RAAST_SECRET_KEY,
      },
      body: JSON.stringify(payload),
    });

    const text = await upstream.text();

    // ✅ FIX: forward upstream content-type so frontend parses JSON correctly
    const ct = upstream.headers.get("content-type");
    if (ct) res.setHeader("content-type", ct);

    res.status(upstream.status).send(text);
  } catch (e) {
    res.status(500).json({ error: "RTP failed", detail: String(e) });
  }
});

// QR endpoint
app.post("/api/qr", async (req, res) => {
  try {
    const {
      aggregator_merchant_identifier,
      amount,
      order_id,
      request_id,
      qr_type = "DYNAMIC",
    } = req.body;

    if (!aggregator_merchant_identifier)
      return res.status(400).json({ error: "Missing aggregator_merchant_identifier" });

    const url = `https://api.getsafepay.com/raastwire/v1/aggregators/${process.env.RAAST_AGGREGATOR_ID}/qrs`;
 

    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-SFPY-AGGREGATOR-SECRET-KEY": process.env.RAAST_SECRET_KEY,
      },
      body: JSON.stringify({
        type: qr_type,
        aggregator_merchant_identifier,
        order_id,
        request_id,
        amount,
      }),
    });

    const text = await upstream.text();

    // ✅ FIX: forward upstream content-type so frontend parses JSON correctly
    const ct = upstream.headers.get("content-type");
    if (ct) res.setHeader("content-type", ct);

    res.status(upstream.status).send(text);
  } catch (e) {
    res.status(500).json({ error: "QR failed", detail: String(e) });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`\n✅ Server running on http://localhost:${PORT}`);
  console.log(`✅ RAAST Demo → http://localhost:${PORT}/raast`);
  console.log(`✅ Health     → http://localhost:${PORT}/health`);
  console.log(`✅ Debug      → http://localhost:${PORT}/debug/public\n`);
});
