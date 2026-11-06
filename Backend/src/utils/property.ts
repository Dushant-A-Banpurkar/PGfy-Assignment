import crypto from "crypto";

export function normalizePhoneLast10(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.slice(-10);
}

export function computeNormalizedDedupKey(
  ownerPhone: string,
  pincode: string,
  title: string,
): string {
  const cleanPhone = normalizePhoneLast10(ownerPhone);
  const cleanTitle = title.toLowerCase().replace(/[^a-z0-9]/g, "");
  const rawKey = `${cleanPhone}:${pincode.trim()}:${cleanTitle}`;
  return crypto.createHash("sha256").update(rawKey).digest("hex").slice(0, 40);
}

export function generatePropertySlug(
  title: string,
  locality: string,
  city: string,
): string {
  const base = `${title}-${locality}-${city}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 140);
  const randomSuffix = crypto.randomBytes(3).toString("hex");
  return `${base}-${randomSuffix}`;
}
