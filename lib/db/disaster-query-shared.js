import { disasterPool, disasterQuery } from "@/lib/db/disaster";

let cachedColumns = null;
let cacheExpiration = 0;

export function quoteIdentifier(identifier) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

export function pickColumn(columns, candidates) {
  return candidates.find((candidate) => columns.includes(candidate)) || null;
}

export function runDisasterQuery(queryable, text, params = []) {
  if (queryable?.query) {
    return queryable.query(text, params);
  }

  return disasterQuery(text, params);
}

export function normalizeClusterValue(value) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

export function normalizeClusterKey(value) {
  const normalized = normalizeClusterValue(value);
  return normalized ? normalized.toLowerCase() : null;
}

export function isSameCluster(a, b) {
  if (!a || !b) {
    return false;
  }

  return a.city === b.city && a.requestType === b.requestType;
}

export function getUrgencyFromClusterPosition(position) {
  if (position <= 1) {
    return { urgencyScore: 20, urgencyLabel: "non-urgent" };
  }

  if (position === 2) {
    return { urgencyScore: 40, urgencyLabel: "potentially urgent" };
  }

  if (position === 3) {
    return { urgencyScore: 60, urgencyLabel: "likely urgent" };
  }

  if (position === 4) {
    return { urgencyScore: 80, urgencyLabel: "likely urgent" };
  }

  return { urgencyScore: 100, urgencyLabel: "urgent" };
}

export function getUrgencyFromClusterSize(clusterSize) {
  const normalizedSize = Number.isFinite(clusterSize) ? Math.max(0, Number(clusterSize)) : 0;
  const urgencyScore = Math.min(normalizedSize * 20, 100);

  if (urgencyScore <= 20) {
    return {
      urgencyScore: 20,
      urgencyLabel: "non-urgent",
      dashboardUrgency: "non-urgent",
    };
  }

  if (urgencyScore === 40) {
    return {
      urgencyScore,
      urgencyLabel: "potentially urgent",
      dashboardUrgency: "non-urgent",
    };
  }

  if (urgencyScore === 60 || urgencyScore === 80) {
    return {
      urgencyScore,
      urgencyLabel: "likely urgent",
      dashboardUrgency: "non-urgent",
    };
  }

  return {
    urgencyScore: 100,
    urgencyLabel: "urgent",
    dashboardUrgency: "urgent",
  };
}

export function getTweetColumnMap(columns) {
  const contentColumn = pickColumn(columns, ["content", "tweet", "text", "body"]);
  const locationColumn = pickColumn(columns, ["location"]);
  const cityColumn = pickColumn(columns, ["city"]);
  const clusterCityColumn = cityColumn || locationColumn;
  const requestTypeColumn = pickColumn(columns, ["request_type", "category", "type"]);
  const geocodeStatusColumn = pickColumn(columns, ["geocode_status"]);
  const latitudeColumn = pickColumn(columns, ["latitude", "lat"]);
  const longitudeColumn = pickColumn(columns, ["longitude", "lon", "lng", "long"]);
  const urgencyColumn = pickColumn(columns, ["urgency"]);
  const createdAtColumn = pickColumn(columns, ["created_at", "timestamp", "inserted_at"]);
  const updatedAtColumn = pickColumn(columns, ["updated_at"]);
  const urgencyScoreColumn = pickColumn(columns, ["urgency_score", "score"]);
  const urgencyLabelColumn = pickColumn(columns, ["urgency_label", "label"]);
  const sourcePostColumn = pickColumn(columns, ["source_post_id", "post_id"]);
  const isInformativeColumn = pickColumn(columns, ["is_informative", "informative"]);
  const isClosedColumn = pickColumn(columns, ["is_closed", "closed"]);
  const idColumn = pickColumn(columns, ["id", "tweet_id"]);

  return {
    contentColumn,
    locationColumn,
    cityColumn,
    clusterCityColumn,
    requestTypeColumn,
    geocodeStatusColumn,
    latitudeColumn,
    longitudeColumn,
    urgencyColumn,
    createdAtColumn,
    updatedAtColumn,
    urgencyScoreColumn,
    urgencyLabelColumn,
    sourcePostColumn,
    isInformativeColumn,
    isClosedColumn,
    idColumn,
  };
}

export function buildActiveInformativeClause(columnMap) {
  const clauses = [];

  if (columnMap.isInformativeColumn) {
    clauses.push(`COALESCE(${quoteIdentifier(columnMap.isInformativeColumn)}, TRUE) = TRUE`);
  }

  if (columnMap.isClosedColumn) {
    clauses.push(`COALESCE(${quoteIdentifier(columnMap.isClosedColumn)}, FALSE) = FALSE`);
  }

  if (!clauses.length) {
    return "";
  }

  return ` AND ${clauses.join(" AND ")}`;
}

export async function withDisasterTransaction(work) {
  const client = await disasterPool.connect();

  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function applyClusterAdvisoryLock(client, city, requestType) {
  await runDisasterQuery(
    client,
    `SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))`,
    [String(city), String(requestType)]
  );
}

export async function getDisasterTweetColumns(queryable) {
  if (cachedColumns && cacheExpiration > Date.now()) {
    return cachedColumns;
  }

  const result = await runDisasterQuery(
    queryable,
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'tweets'`
  );

  cachedColumns = result.rows.map((row) => row.column_name);
  cacheExpiration = Date.now() + 60 * 1000;

  return cachedColumns;
}
