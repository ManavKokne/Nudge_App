import {
  ALLOWED_REQUEST_TYPES,
  FALLBACK_CITY,
  FALLBACK_LOCATION,
  FALLBACK_REQUEST_TYPE,
  REQUEST_TYPE_LOOKUP,
} from "@/lib/processing/llm-config";

export function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function toTitleCase(value) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/\b[a-z]/g, (match) => match.toUpperCase());
}

export function normalizeCity(value) {
  const normalized = normalizeWhitespace(value);

  if (!normalized) {
    return FALLBACK_CITY;
  }

  if (/\b(unknown|unavailable|n\/a|na|none)\b/i.test(normalized)) {
    return FALLBACK_CITY;
  }

  return toTitleCase(normalized);
}

export function normalizeLocation(value) {
  const normalized = normalizeWhitespace(value).replace(/[.,;:!?]+$/, "");

  if (!normalized) {
    return FALLBACK_LOCATION;
  }

  if (/\b(unknown|unavailable|n\/a|na|none)\b/i.test(normalized)) {
    return FALLBACK_LOCATION;
  }

  return normalized;
}

export function normalizeRequestType(value) {
  const compact = normalizeWhitespace(value);

  if (!compact) {
    return FALLBACK_REQUEST_TYPE;
  }

  const normalized = REQUEST_TYPE_LOOKUP[compact.toLowerCase()];

  if (normalized && ALLOWED_REQUEST_TYPES.includes(normalized)) {
    return normalized;
  }

  return FALLBACK_REQUEST_TYPE;
}

export function normalizeConfidence(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.max(0, Math.min(1, parsed));
}