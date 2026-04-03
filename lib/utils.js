import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatApiError(error, fallbackMessage = "Something went wrong") {
  if (!error) {
    return fallbackMessage;
  }

  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallbackMessage;
}

export function deriveNameFromEmail(email) {
  if (!email || typeof email !== "string") {
    return "User";
  }

  const localPart = email.split("@")[0]?.trim();

  if (!localPart) {
    return "User";
  }

  return `${localPart.charAt(0).toUpperCase()}${localPart.slice(1)}`;
}

export function extractCityFromLocationString(location) {
  const normalized = String(location || "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.,;:!?]+$/, "");

  if (!normalized || /\b(unknown|unavailable)\b/i.test(normalized)) {
    return "Unknown City";
  }

  const hasLetters = (value) => /[A-Za-z]/.test(value || "");

  const commaParts = normalized
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (commaParts.length >= 2 && hasLetters(commaParts[1])) {
    return commaParts[1];
  }

  const wordParts = normalized.split(/\s+/).filter(Boolean);
  const alphaWords = wordParts.filter(hasLetters);

  if (alphaWords.length >= 2) {
    return alphaWords[alphaWords.length - 1];
  }

  if (alphaWords.length === 1) {
    return alphaWords[0];
  }

  return "Unknown City";
}
