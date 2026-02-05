export async function callRtp(payload) {
     return fetch("/api/rtp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function callQr(payload) {
  return fetch("/api/qr", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

/**
 * Unified response reader
 * Keeps UI code clean
 */
export async function readRes(res) {
  const ct = res.headers.get("content-type") || "";
  const raw = await res.text();

  if (ct.includes("application/json")) {
    try {
      return { json: JSON.parse(raw), raw };
    } catch {
      return { json: null, raw };
    }
  }

  return { json: null, raw };
}
