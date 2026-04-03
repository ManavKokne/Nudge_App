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

const globalForDisaster = globalThis;

export const disasterPool =
  globalForDisaster.__nudgeDisasterPool ||
  createPool(process.env.DATABASE_URL_DISASTER, "DATABASE_URL_DISASTER");

if (process.env.NODE_ENV !== "production") {
  globalForDisaster.__nudgeDisasterPool = disasterPool;
}

export async function disasterQuery(text, params = []) {
  return disasterPool.query(text, params);
}
