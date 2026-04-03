export const SESSION_COOKIE_NAME = "nudge_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
export const PROCESSING_MODE = (process.env.PROCESSING_MODE || "mock").toLowerCase();
export const AVATAR_COUNT = Number(process.env.AVATAR_COUNT || 8);
export const DEFAULT_AVATAR = "/avatar/av_1.png";

export const REQUEST_TYPE_OPTIONS = [
  "Medical",
  "Food & Supplies",
  "Shelter",
  "Humanitarian",
  "General",
];
