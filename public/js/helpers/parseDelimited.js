export function parseDelimited(text) {
  text = text.replace(/^\uFEFF/, "");
  const delim = text.includes("\t") ? "\t" : ",";
  return text.split(/\r?\n/).filter(Boolean).map(r => r.split(delim).map(c => c.trim()));
}
