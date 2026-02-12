import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import net from "net";

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

// -----------------------------
// Health + Debug
// -----------------------------

app.get("/health", (_, res) => {
  res.json({ ok: true });
});

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

// -----------------------------
// RTP endpoint
// -----------------------------

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

    if (!aggregator_merchant_identifier) {
      return res
        .status(400)
        .json({ error: "Missing aggregator_merchant_identifier" });
    }

    const payload = {
      aggregator_merchant_identifier,
      amount,
      order_id,
      request_id,
      type,
    };

    // Map debitor field correctly
    if (debitor_type === "IBAN") {
      payload.debitor_iban = debitor_value;
    }

    if (debitor_type === "RAAST_ID") {
      payload.debitor_raast_id = debitor_value;
    }

    if (debitor_type === "VAULT_TOKEN") {
      payload.debitor_vault_token = debitor_value;
    }

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

    // Forward upstream content-type
    const ct = upstream.headers.get("content-type");
    if (ct) {
      res.setHeader("content-type", ct);
    }

    res.status(upstream.status).send(text);
  } catch (e) {
    res.status(500).json({
      error: "RTP failed",
      detail: String(e),
    });
  }
});

// -----------------------------
// QR endpoint
// -----------------------------

app.post("/api/qr", async (req, res) => {
  try {
    const {
      aggregator_merchant_identifier,
      amount,
      order_id,
      request_id,
      qr_type = "DYNAMIC",
    } = req.body;

    if (!aggregator_merchant_identifier) {
      return res
        .status(400)
        .json({ error: "Missing aggregator_merchant_identifier" });
    }

    const qt = String(qr_type).toUpperCase();

    // DYNAMIC requires amount
    if (qt !== "STATIC") {
      if (
        amount === undefined ||
        amount === null ||
        Number(amount) <= 0
      ) {
        return res
          .status(400)
          .json({ error: "Missing/invalid amount for DYNAMIC QR" });
      }
    }

    const body = {
      type: qt,
      aggregator_merchant_identifier,
      order_id,
      request_id,
    };

    // Only include amount for DYNAMIC
    if (qt === "DYNAMIC") {
      body.amount = amount;
    }

    const upstream = await fetch(
      `https://api.getsafepay.com/raastwire/v1/aggregators/${process.env.RAAST_AGGREGATOR_ID}/qrs`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-SFPY-AGGREGATOR-SECRET-KEY": process.env.RAAST_SECRET_KEY,
        },
        body: JSON.stringify(body),
      }
    );

    const text = await upstream.text();

    // ✅ FIX: Forward upstream content-type so frontend parses JSON
    const ct = upstream.headers.get("content-type");
    if (ct) {
      res.setHeader("content-type", ct);
    }

    res.status(upstream.status).send(text);
  } catch (e) {
    res.status(500).json({
      error: "QR failed",
      detail: String(e),
    });
  }
});

// -----------------------------
// Auto free-port finder
// -----------------------------

function findFreePort(startPort, cb) {
  const server = net.createServer();

  server.once("error", (err) => {
    if (err.code === "EADDRINUSE") {
      findFreePort(startPort + 1, cb);
    } else {
      cb(err);
    }
  });

  server.once("listening", () => {
    const port = server.address().port;
    server.close(() => cb(null, port));
  });

  server.listen(startPort);
}

const START_PORT = Number(process.env.PORT) || 3000;

findFreePort(START_PORT, (err, port) => {
  if (err) {
    console.error("Failed to find free port:", err);
    process.exit(1);
  }

  app.listen(port, () => {
    console.log(`\n✅ Server running on http://localhost:${port}`);
    console.log(`✅ RAAST Demo → http://localhost:${port}/raast`);
    console.log(`✅ Health → http://localhost:${port}/health`);
    console.log(`✅ Debug → http://localhost:${port}/debug/public\n`);
  });
});
