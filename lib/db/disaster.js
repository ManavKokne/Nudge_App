import { Pool } from "pg";

function sanitizeConnectionString(rawConnectionString) {
  try {
    const parsed = new URL(rawConnectionString);

    // pg can ignore explicit ssl object when SSL-related params are in URL.
    const keys = Array.from(parsed.searchParams.keys());

    keys.forEach((key) => {
      if (key.toLowerCase().startsWith("ssl")) {
        parsed.searchParams.delete(key);
      }
    });

    return parsed.toString();
  } catch {
    return rawConnectionString;
  }
}

function resolveSslConfig(connectionString) {
  const forceDisableSsl = process.env.PG_DISABLE_SSL === "true";
  const forceStrictSsl = process.env.PG_STRICT_SSL === "true";
  const isLocalConnection =
    connectionString.includes("localhost") ||
    connectionString.includes("127.0.0.1") ||
    connectionString.includes("::1");

  if (forceDisableSsl || isLocalConnection) {
    return false;
  }

  return { rejectUnauthorized: forceStrictSsl };
}

function buildPoolConfig(connectionString, label) {
  if (!connectionString) {
    throw new Error(`${label} is not configured`);
  }

  const sanitizedConnectionString = sanitizeConnectionString(connectionString);

  return {
    connectionString: sanitizedConnectionString,
    ssl: resolveSslConfig(sanitizedConnectionString),
  };
}

const globalForDisaster = globalThis;
const disasterPoolConfig = buildPoolConfig(process.env.DATABASE_URL_DISASTER, "DATABASE_URL_DISASTER");

function getOrCreateDisasterPool() {
  const currentSslSignature = JSON.stringify(disasterPoolConfig.ssl);
  const cachedState = globalForDisaster.__nudgeDisasterPoolState;

  if (
    cachedState?.pool &&
    cachedState.connectionString === disasterPoolConfig.connectionString &&
    cachedState.sslSignature === currentSslSignature
  ) {
    return cachedState.pool;
  }

  if (cachedState?.pool) {
    cachedState.pool.end().catch(() => undefined);
  }

  if (globalForDisaster.__nudgeDisasterPool?.end) {
    globalForDisaster.__nudgeDisasterPool.end().catch(() => undefined);
  }

  const pool = new Pool(disasterPoolConfig);

  if (process.env.NODE_ENV !== "production") {
    globalForDisaster.__nudgeDisasterPoolState = {
      pool,
      connectionString: disasterPoolConfig.connectionString,
      sslSignature: currentSslSignature,
    };
  }

  return pool;
}

export const disasterPool =
  process.env.NODE_ENV === "production"
    ? new Pool(disasterPoolConfig)
    : getOrCreateDisasterPool();

if (process.env.NODE_ENV !== "production") {
  globalForDisaster.__nudgeDisasterPool = disasterPool;
}

export async function disasterQuery(text, params = []) {
  return disasterPool.query(text, params);
}
