import { Pool } from "pg";

function createPool(connectionString, label) {
  if (!connectionString) {
    throw new Error(`${label} is not configured`);
  }

  return new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
}

const globalForSocial = globalThis;

export const socialPool =
  globalForSocial.__nudgeSocialPool ||
  createPool(process.env.DATABASE_URL_SOCIAL, "DATABASE_URL_SOCIAL");

if (process.env.NODE_ENV !== "production") {
  globalForSocial.__nudgeSocialPool = socialPool;
}

export async function socialQuery(text, params = []) {
  return socialPool.query(text, params);
}
