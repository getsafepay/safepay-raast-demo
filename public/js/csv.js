import { callRtp, callQr, readRes } from "./api.js";
import { renderQrInto } from "./qr.js";
import { uuidv4 } from "./helpers/uuid.js";
import { parseDelimited } from "./helpers/parseDelimited.js";

const csvFile = document.getElementById("csvFile");
const resultsBody = document.getElementById("resultsBody");
const resultsTable = document.getElementById("resultsTable");
const csvStatus = document.getElementById("csvStatus");

export function initCSV() {
  document.getElementById("csvRun").onclick = runBatch;
  document.getElementById("csvClear").onclick = () => {
    resultsBody.innerHTML = "";
    resultsTable.style.display = "none";
    if (csvStatus) csvStatus.textContent = "";
  };
}

function normType(type) {
  return String(type || "").trim().toUpperCase();
}

async function runBatch() {
  if (!csvFile.files?.[0]) return;

  const text = await csvFile.files[0].text();
  const rows = parseDelimited(text).slice(1);

  if (csvStatus) csvStatus.textContent = `Running ${rows.length} row(s)…`;

  resultsTable.style.display = "";
  resultsBody.innerHTML = "";

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || [];
    const rawType = row[2];
    const t = normType(rawType);

    // QR batch: merchant, amount, QR, order_id, request_id(optional)
    const isQrRow = t === "QR" && row.length <= 5;

    let merchant = "";
    let amount = "";
    let order_id = "";
    let request_id = "";

    let debitor_type = "";
    let debitor_value = "";

    if (isQrRow) {
      [merchant, amount, /*type*/, order_id, request_id] = row;
    } else {
      // RTP batch: merchant, amount, RTP_NOW/RTP_LATER, debitor_type, debitor_value, order_id, request_id(optional)
      [merchant, amount, /*type*/, debitor_type, debitor_value, order_id, request_id] = row;
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${rawType || "—"}</td>
      <td>${merchant || "—"}</td>
      <td>${amount || "—"}</td>
      <td>${isQrRow ? "—" : (debitor_type || "—")}</td>
      <td>…</td>
      <td>…</td>
      <td><div class="qrCell"></div></td>
    `;
    resultsBody.appendChild(tr);

    const qrEl = tr.querySelector(".qrCell");
    tr.children[5].textContent = "—";
    tr.children[6].textContent = "—";
    qrEl.textContent = "—";

    const m = String(merchant || "").trim();
    const a = Number(amount);
    const o = String(order_id || "").trim();
    const rid = String(request_id || "").trim() || uuidv4();

    if (!m) { tr.children[6].textContent = "Bad row: missing merchant"; continue; }
    if (!Number.isFinite(a) || a <= 0) { tr.children[6].textContent = "Bad row: invalid amount"; continue; }

    if (isQrRow) {
      if (!o) { tr.children[6].textContent = "Bad row: missing order_id"; continue; }

      const res = await callQr({
        aggregator_merchant_identifier: m,
        amount: a,
        order_id: o,
        request_id: rid,
        qr_type: "DYNAMIC",
      });

      tr.children[5].textContent = res.status;

      const { json } = await readRes(res);
      const code = json?.code ?? json?.data?.code ?? "";

      tr.children[6].textContent = code ? "QR ✓" : "QR ✗";
      renderQrInto(qrEl, code, 160);
      continue;
    }

    // RTP rows
    const dt = String(debitor_type || "").trim();
    const dv = String(debitor_value || "").trim();

    if (t !== "RTP_NOW" && t !== "RTP_LATER") {
      tr.children[6].textContent = `Bad row: type must be RTP_NOW/RTP_LATER (got: ${rawType || "—"})`;
      continue;
    }
    if (!dt || !dv) { tr.children[6].textContent = "Bad row: missing debitor_type/value"; continue; }
    if (!o) { tr.children[6].textContent = "Bad row: missing order_id"; continue; }

    const res = await callRtp({
      aggregator_merchant_identifier: m,
      amount: a,
      type: String(rawType || "").trim(),
      order_id: o,
      request_id: rid,
      debitor_type: dt,
      debitor_value: dv,
    });

    tr.children[5].textContent = res.status;
    tr.children[6].textContent = res.ok ? "RTP ✓" : "RTP ✗";
    qrEl.textContent = "—";
  }

  if (csvStatus) csvStatus.textContent = `Done. ${rows.length} row(s) processed.`;
}