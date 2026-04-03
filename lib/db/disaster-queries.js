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

export async function countSimilarAlerts({ location, requestType, excludeSourcePostId }) {
  const columns = await getDisasterTweetColumns();
  const locationColumn = pickColumn(columns, ["location"]);
  const requestTypeColumn = pickColumn(columns, ["request_type", "category", "type"]);
  const createdAtColumn = pickColumn(columns, ["created_at", "timestamp", "inserted_at"]);
  const sourcePostColumn = pickColumn(columns, ["source_post_id", "post_id"]);

  if (!locationColumn || !requestTypeColumn || !createdAtColumn) {
    throw new Error(
      "The tweets table is missing one of the required columns: location, request_type/category, or created_at"
    );
  }

  const values = [location, requestType];
  let exclusionClause = "";

  if (excludeSourcePostId && sourcePostColumn) {
    values.push(excludeSourcePostId);
    exclusionClause = ` AND ${quoteIdentifier(sourcePostColumn)}::text <> $${values.length}::text`;
  }

  const queryText = `SELECT COUNT(*)::int AS count
                     FROM public.tweets
                     WHERE ${quoteIdentifier(locationColumn)} = $1
                       AND ${quoteIdentifier(requestTypeColumn)} = $2
                       AND ${quoteIdentifier(createdAtColumn)} > NOW() - INTERVAL '1 hour'${exclusionClause}`;

  const result = await disasterQuery(queryText, values);

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

export async function updateAlertBySourcePostId({
  sourcePostId,
  content,
  location,
  requestType,
  dashboardUrgency,
  urgencyScore,
  urgencyLabel,
}) {
  const columns = await getDisasterTweetColumns();

  const contentColumn = pickColumn(columns, ["content", "tweet", "text", "body"]);
  const locationColumn = pickColumn(columns, ["location"]);
  const requestTypeColumn = pickColumn(columns, ["request_type", "category", "type"]);
  const urgencyColumn = pickColumn(columns, ["urgency"]);
  const urgencyScoreColumn = pickColumn(columns, ["urgency_score", "score"]);
  const urgencyLabelColumn = pickColumn(columns, ["urgency_label", "label"]);
  const sourcePostColumn = pickColumn(columns, ["source_post_id", "post_id"]);

  if (!contentColumn || !locationColumn || !requestTypeColumn || !urgencyColumn) {
    throw new Error(
      "The tweets table must include content/tweet, location, request_type/category, and urgency columns"
    );
  }

  if (!sourcePostColumn) {
    throw new Error(
      "The tweets table needs source_post_id or post_id to keep edit/delete operations synced with social posts"
    );
  }

  const setPairs = [
    [contentColumn, content],
    [locationColumn, location],
    [requestTypeColumn, requestType],
    [urgencyColumn, dashboardUrgency],
  ];

  if (urgencyScoreColumn) {
    setPairs.push([urgencyScoreColumn, urgencyScore]);
  }

  if (urgencyLabelColumn) {
    setPairs.push([urgencyLabelColumn, urgencyLabel]);
  }

  const values = [sourcePostId];
  const setClauses = setPairs.map(([column, value]) => {
    values.push(value);
    return `${quoteIdentifier(column)} = $${values.length}`;
  });

  const result = await disasterQuery(
    `UPDATE public.tweets
     SET ${setClauses.join(", ")}
     WHERE ${quoteIdentifier(sourcePostColumn)}::text = $1::text
     RETURNING *`,
    values
  );

  if (result.rows[0]) {
    return result.rows[0];
  }

  return insertAlertFromPost({
    content,
    location,
    requestType,
    dashboardUrgency,
    urgencyScore,
    urgencyLabel,
    sourcePostId,
  });
}

export async function deleteAlertsBySourcePostId(sourcePostId) {
  const columns = await getDisasterTweetColumns();
  const sourcePostColumn = pickColumn(columns, ["source_post_id", "post_id"]);

  if (!sourcePostColumn) {
    throw new Error(
      "The tweets table needs source_post_id or post_id to keep edit/delete operations synced with social posts"
    );
  }

  const result = await disasterQuery(
    `DELETE FROM public.tweets
     WHERE ${quoteIdentifier(sourcePostColumn)}::text = $1::text
     RETURNING 1`,
    [sourcePostId]
  );

  return result.rowCount || 0;
}
