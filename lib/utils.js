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
