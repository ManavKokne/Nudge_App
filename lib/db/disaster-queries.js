import { disasterQuery } from "@/lib/db/disaster";

let cachedColumns = null;
let cacheExpiration = 0;

function quoteIdentifier(identifier) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function pickColumn(columns, candidates) {
  return candidates.find((candidate) => columns.includes(candidate)) || null;
}

export async function getDisasterTweetColumns() {
  if (cachedColumns && cacheExpiration > Date.now()) {
    return cachedColumns;
  }

  const result = await disasterQuery(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'tweets'`
  );

  cachedColumns = result.rows.map((row) => row.column_name);
  cacheExpiration = Date.now() + 60 * 1000;

  return cachedColumns;
}

export async function countSimilarAlerts({ location, requestType }) {
  const columns = await getDisasterTweetColumns();
  const locationColumn = pickColumn(columns, ["location"]);
  const requestTypeColumn = pickColumn(columns, ["request_type", "category", "type"]);
  const createdAtColumn = pickColumn(columns, ["created_at", "timestamp", "inserted_at"]);

  if (!locationColumn || !requestTypeColumn || !createdAtColumn) {
    throw new Error(
      "The tweets table is missing one of the required columns: location, request_type/category, or created_at"
    );
  }

  const queryText = `SELECT COUNT(*)::int AS count
                     FROM public.tweets
                     WHERE ${quoteIdentifier(locationColumn)} = $1
                       AND ${quoteIdentifier(requestTypeColumn)} = $2
                       AND ${quoteIdentifier(createdAtColumn)} > NOW() - INTERVAL '1 hour'`;

  const result = await disasterQuery(queryText, [location, requestType]);

  return result.rows[0]?.count || 0;
}

export async function insertAlertFromPost({
  content,
  location,
  requestType,
  dashboardUrgency,
  urgencyScore,
  urgencyLabel,
  sourcePostId,
}) {
  const columns = await getDisasterTweetColumns();

  const contentColumn = pickColumn(columns, ["content", "tweet", "text", "body"]);
  const locationColumn = pickColumn(columns, ["location"]);
  const requestTypeColumn = pickColumn(columns, ["request_type", "category", "type"]);
  const urgencyColumn = pickColumn(columns, ["urgency"]);
  const createdAtColumn = pickColumn(columns, ["created_at", "timestamp", "inserted_at"]);
  const urgencyScoreColumn = pickColumn(columns, ["urgency_score", "score"]);
  const urgencyLabelColumn = pickColumn(columns, ["urgency_label", "label"]);
  const sourcePostColumn = pickColumn(columns, ["source_post_id", "post_id"]);

  if (!contentColumn || !locationColumn || !requestTypeColumn || !urgencyColumn) {
    throw new Error(
      "The tweets table must include content/tweet, location, request_type/category, and urgency columns"
    );
  }

  const columnValuePairs = [
    [contentColumn, content],
    [locationColumn, location],
    [requestTypeColumn, requestType],
    [urgencyColumn, dashboardUrgency],
  ];

  if (createdAtColumn) {
    columnValuePairs.push([createdAtColumn, new Date()]);
  }

  if (urgencyScoreColumn) {
    columnValuePairs.push([urgencyScoreColumn, urgencyScore]);
  }

  if (urgencyLabelColumn) {
    columnValuePairs.push([urgencyLabelColumn, urgencyLabel]);
  }

  if (sourcePostColumn) {
    columnValuePairs.push([sourcePostColumn, sourcePostId]);
  }

  const columnNames = columnValuePairs.map(([column]) => quoteIdentifier(column));
  const values = columnValuePairs.map(([, value]) => value);
  const placeholders = values.map((_, index) => `$${index + 1}`);

  const result = await disasterQuery(
    `INSERT INTO public.tweets (${columnNames.join(", ")})
     VALUES (${placeholders.join(", ")})
     RETURNING *`,
    values
  );

  return result.rows[0] || null;
}
