import { REQUEST_TYPE_OPTIONS } from "@/lib/constants";

export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3-flash-preview";
export const GEMINI_TIMEOUT_MS = Number.parseInt(process.env.GEMINI_TIMEOUT_MS || "", 10) || 60000;
export const MAX_EXTRACTION_ATTEMPTS = 2;

export const FALLBACK_CITY = "Unknown City";
export const FALLBACK_LOCATION = "Unknown Location";
export const FALLBACK_REQUEST_TYPE = "General";

export const DEFAULT_MODEL_CANDIDATES = [
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite-preview",
  "gemini-3.1-pro-preview",
  "gemini-1.5-flash",
];

export const ALLOWED_REQUEST_TYPES = REQUEST_TYPE_OPTIONS.includes(FALLBACK_REQUEST_TYPE)
  ? REQUEST_TYPE_OPTIONS
  : [...REQUEST_TYPE_OPTIONS, FALLBACK_REQUEST_TYPE];

export const REQUEST_TYPE_LOOKUP = {
  medical: "Medical",
  rescue: "Rescue",
  food: "Food",
  shelter: "Shelter",
  emergency: "Emergency",
  general: "General",
  "food & supplies": "Food",
  "food and supplies": "Food",
  humanitarian: "Rescue",
};