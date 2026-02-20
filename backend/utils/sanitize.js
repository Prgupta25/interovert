export function sanitizeText(value, maxLength = 5000) {
  const text = String(value ?? '').trim();
  return text.replace(/<[^>]+>/g, '').slice(0, maxLength);
}

export function toSafeInt(value, fallback = 0) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}
