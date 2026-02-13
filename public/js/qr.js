// public/js/qr.js
// Uses qrcodejs loaded globally via script tag (QRCode)

export function renderQr(targetEl, text, size = 300) {
  if (!targetEl) return;
  targetEl.innerHTML = "";
  if (!text) return;

  // eslint-disable-next-line no-undef
  new QRCode(targetEl, {
    text,
    width: size,
    height: size,
    correctLevel: QRCode.CorrectLevel.M,
  });
}

export function renderQrInto(targetEl, text, size = 160) {
  return renderQr(targetEl, text, size);
}

export function renderQrWithDownload(
  targetCellEl,
  text,
  previewSize = 90,
  downloadSize = 300,
  filename = "qr.png"
) {
  if (!targetCellEl) return;

  targetCellEl.innerHTML = "";
  if (!text) {
    targetCellEl.textContent = "—";
    return;
  }

  const wrap = document.createElement("div");
  wrap.style.display = "flex";
  wrap.style.flexDirection = "column";
  wrap.style.alignItems = "center";
  wrap.style.gap = "6px";

  const preview = document.createElement("div");
  preview.style.cursor = "pointer";

  const dl = document.createElement("a");
  dl.textContent = "Download";
  dl.href = "#";
  dl.style.fontSize = "12px";
  dl.style.textDecoration = "underline";
  dl.style.cursor = "pointer";

  wrap.appendChild(preview);
  wrap.appendChild(dl);
  targetCellEl.appendChild(wrap);

  // eslint-disable-next-line no-undef
  new QRCode(preview, {
    text,
    width: previewSize,
    height: previewSize,
    correctLevel: QRCode.CorrectLevel.M,
  });

  const tmp = document.createElement("div");
  tmp.style.position = "fixed";
  tmp.style.left = "-99999px";
  tmp.style.top = "-99999px";
  document.body.appendChild(tmp);

  // eslint-disable-next-line no-undef
  new QRCode(tmp, {
    text,
    width: downloadSize,
    height: downloadSize,
    correctLevel: QRCode.CorrectLevel.M,
  });

  const canvas = tmp.querySelector("canvas");
  const img = tmp.querySelector("img");

  let dataUrl = null;
  if (canvas) dataUrl = canvas.toDataURL("image/png");
  else if (img && img.src) dataUrl = img.src;

  document.body.removeChild(tmp);

  if (!dataUrl) {
    dl.textContent = "Download unavailable";
    dl.style.textDecoration = "none";
    dl.style.cursor = "default";
    preview.style.cursor = "default";
    return;
  }

  dl.href = dataUrl;
  dl.download = filename;

  const triggerDownload = (e) => {
    e?.preventDefault?.();
    dl.click();
  };

  preview.addEventListener("click", triggerDownload);
  dl.addEventListener("click", (e) => e.stopPropagation());
}
