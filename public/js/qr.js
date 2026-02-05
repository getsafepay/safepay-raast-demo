// public/js/qr.js
// Depends on qrcodejs being loaded globally as window.QRCode

function cleanPayload(payload) {
  return String(payload || "").replace(/\r?\n/g, "").trim();
}

/**
 * Render the large "hero" QR on the left pane.
 */
export function renderQr(targetEl, payload, size = 300) {
  const text = cleanPayload(payload);
  targetEl.innerHTML = "";

  if (!text) return;

  // QRCode comes from the qrcodejs CDN script in raast.html
  // eslint-disable-next-line no-undef
  new QRCode(targetEl, {
    text,
    width: size,
    height: size,
    colorDark: "#000000",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.M
  });
}

/**
 * Render a smaller QR in the table cells for bulk QR.
 */
export function renderQrInto(targetEl, payload, size = 220) {
  const text = cleanPayload(payload);
  targetEl.innerHTML = "";

  if (!text) {
    targetEl.textContent = "—";
    return;
  }

  // eslint-disable-next-line no-undef
  new QRCode(targetEl, {
    text,
    width: size,
    height: size,
    colorDark: "#000000",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.M
  });

  // scanner friendly quiet zone
  targetEl.style.background = "#fff";
  targetEl.style.padding = "10px";
  targetEl.style.borderRadius = "10px";
  targetEl.style.display = "inline-block";
}
