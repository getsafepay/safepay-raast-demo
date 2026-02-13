import { callRtp, callQr, callPayout, readRes } from "./api.js";
import { renderQrWithDownload } from "./qr.js";
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

function setResultCell(td, ok, text) {
  td.classList.remove("resultOk", "resultBad");
  td.classList.add(ok ? "resultOk" : "resultBad");
  td.textContent = `${ok ? "✅" : "❌"} ${text}`;
}

function normUpper(v) {
  return String(v || "").trim().toUpperCase();
}

/**
 * Bulk formats supported:
 *
 * PAYOUT (2 cols):
 *   amount, creditor_iban
 *
 * QR (4/5 cols):
 *   merchant, amount, DYNAMIC|STATIC, order_id, request_id(optional)
 *
 * RTP (unchanged):
 *   merchant, amount, RTP_NOW/RTP_LATER, debitor_type, debitor_value, order_id, request_id(optional)
 */
async function runBatch() {
  if (!csvFile.files?.[0]) return;

  const text = await csvFile.files[0].text();
  const allRows = parseDelimited(text);

  // Keep existing behavior: skip first row (assumed header)
  const rows = allRows.slice(1);

  if (csvStatus) csvStatus.textContent = `Running ${rows.length} row(s)…`;

  resultsTable.style.display = "";
  resultsBody.innerHTML = "";

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || [];

    // PAYOUT: exactly 2 columns
    const isPayoutRow = row.length === 2;

    // For non-payout rows, the "type" is at index 2
    const rawType = row[2];
    const t = normUpper(rawType);

    // QR rows are now:
    // merchant, amount, DYNAMIC|STATIC, order_id, request_id(optional)
    const isQrRow = !isPayoutRow && (t === "DYNAMIC" || t === "STATIC") && row.length >= 4 && row.length <= 5;

    // Build row with a nicer Mode/Type label
    const modeLabel = isPayoutRow
      ? "PAYOUT"
      : isQrRow
        ? `QR (${t})`
        : (rawType || "—"); // RTP shows RTP_NOW/RTP_LATER here already

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${modeLabel}</td>
      <td>${isPayoutRow ? "—" : (row[0] || "—")}</td>
      <td>${isPayoutRow ? (row[0] || "—") : (row[1] || "—")}</td>
      <td class="partyCell">…</td>
      <td>—</td>
      <td class="resultCell">—</td>
      <td class="qrCell">—</td>
    `;
    resultsBody.appendChild(tr);

    const partyCell = tr.querySelector(".partyCell");
    const resultCell = tr.querySelector(".resultCell");
    const qrEl = tr.querySelector(".qrCell");

    // Reset placeholders
    tr.children[5].textContent = "—";
    resultCell.textContent = "—";
    qrEl.textContent = "—";

    // -------------------------
    // PAYOUT rows (2 cols)
    // -------------------------
    if (isPayoutRow) {
      const amount = row[0];
      const creditor_iban = row[1];

      const a = Number(amount);
      const c = String(creditor_iban || "").trim();
      const rid = uuidv4();

      partyCell.textContent = c || "—";

      if (!Number.isFinite(a) || a <= 0) {
        setResultCell(resultCell, false, "Bad row: invalid amount");
        continue;
      }
      if (!c) {
        setResultCell(resultCell, false, "Bad row: missing creditor_iban");
        continue;
      }

      const res = await callPayout({
        request_id: rid,
        amount: String(amount).trim(),
        creditor_iban: c,
        type: "PAYOUT",
      });

      tr.children[5].textContent = res.status;

      const { json } = await readRes(res);
      setResultCell(
        resultCell,
        res.ok,
        res.ok ? "PAYOUT Success" : (json?.message || "PAYOUT Failed")
      );

      qrEl.textContent = "—";
      continue;
    }

    // -------------------------
    // QR / RTP parsing
    // -------------------------
    let merchant = "";
    let amount = "";
    let order_id = "";
    let request_id = "";
    let debitor_type = "";
    let debitor_value = "";

    if (isQrRow) {
      // merchant, amount, DYNAMIC|STATIC, order_id, request_id?
      merchant = row[0];
      amount = row[1];
      order_id = row[3];
      request_id = row[4];
    } else {
      // RTP: merchant, amount, RTP_NOW|RTP_LATER, debitor_type, debitor_value, order_id, request_id?
      [merchant, amount, /*type*/, debitor_type, debitor_value, order_id, request_id] = row;
    }

    const m = String(merchant || "").trim();
    const a = Number(amount);
    const o = String(order_id || "").trim();
    const rid = String(request_id || "").trim() || uuidv4();

    // Party column meaning
    partyCell.textContent = isQrRow ? "—" : `${debitor_type || "—"} / ${debitor_value || "—"}`;

    if (!m) {
      setResultCell(resultCell, false, "Bad row: missing merchant");
      continue;
    }

    // -------------------------
    // QR rows
    // -------------------------
    if (isQrRow) {
      const qrType = t; // STATIC or DYNAMIC from col 3

      if (!o) {
        setResultCell(resultCell, false, "Bad row: missing order_id");
        continue;
      }

      // Amount required only for DYNAMIC
      if (qrType === "DYNAMIC" && (!Number.isFinite(a) || a <= 0)) {
        setResultCell(resultCell, false, "Bad row: invalid amount for DYNAMIC QR");
        continue;
      }

      const payload = {
        aggregator_merchant_identifier: m,
        order_id: o,
        request_id: rid,
        qr_type: qrType,
      };
      if (qrType === "DYNAMIC") payload.amount = a;

      const res = await callQr(payload);

      tr.children[5].textContent = res.status;

      const { json } = await readRes(res);
      const code = json?.code ?? json?.data?.code ?? "";

      setResultCell(
        resultCell,
        !!code,
        code ? `QR ${qrType} Success` : `QR ${qrType} Failed`
      );

      renderQrWithDownload(
        qrEl,
        code,
        90, // preview
        300, // download
        `qr_${qrType}_${i + 1}_${rid}.png`
      );

      continue;
    }

    // -------------------------
    // RTP rows (unchanged)
    // -------------------------
    const dt = String(debitor_type || "").trim();
    const dv = String(debitor_value || "").trim();

    // For RTP, rawType is at col 3 already (RTP_NOW/RTP_LATER)
    const rtpType = normUpper(rawType);

    if (rtpType !== "RTP_NOW" && rtpType !== "RTP_LATER") {
      setResultCell(
        resultCell,
        false,
        `Bad row: type must be RTP_NOW/RTP_LATER (got: ${rawType || "—"})`
      );
      continue;
    }

    if (!Number.isFinite(a) || a <= 0) {
      setResultCell(resultCell, false, "Bad row: invalid amount");
      continue;
    }
    if (!dt || !dv) {
      setResultCell(resultCell, false, "Bad row: missing debitor_type/value");
      continue;
    }
    if (!o) {
      setResultCell(resultCell, false, "Bad row: missing order_id");
      continue;
    }

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

    const { json } = await readRes(res);
    setResultCell(
      resultCell,
      res.ok,
      res.ok ? "RTP Success" : (json?.message || "RTP Failed")
    );

    qrEl.textContent = "—";
  }

  if (csvStatus) csvStatus.textContent = `Done.\n${rows.length} row(s) processed.`;
}
