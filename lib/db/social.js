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

const globalForSocial = globalThis;
const socialPoolConfig = buildPoolConfig(process.env.DATABASE_URL_SOCIAL, "DATABASE_URL_SOCIAL");

function getOrCreateSocialPool() {
  const currentSslSignature = JSON.stringify(socialPoolConfig.ssl);
  const cachedState = globalForSocial.__nudgeSocialPoolState;

  if (
    cachedState?.pool &&
    cachedState.connectionString === socialPoolConfig.connectionString &&
    cachedState.sslSignature === currentSslSignature
  ) {
    return cachedState.pool;
  }

  if (cachedState?.pool) {
    cachedState.pool.end().catch(() => undefined);
  }

  if (globalForSocial.__nudgeSocialPool?.end) {
    globalForSocial.__nudgeSocialPool.end().catch(() => undefined);
  }

  const pool = new Pool(socialPoolConfig);

  if (process.env.NODE_ENV !== "production") {
    globalForSocial.__nudgeSocialPoolState = {
      pool,
      connectionString: socialPoolConfig.connectionString,
      sslSignature: currentSslSignature,
    };
  }

  return pool;
}

export const socialPool =
  process.env.NODE_ENV === "production"
    ? new Pool(socialPoolConfig)
    : getOrCreateSocialPool();

if (process.env.NODE_ENV !== "production") {
  globalForSocial.__nudgeSocialPool = socialPool;
}

export async function socialQuery(text, params = []) {
  return socialPool.query(text, params);
}
