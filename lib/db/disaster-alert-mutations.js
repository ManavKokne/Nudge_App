import {
  getDisasterTweetColumns,
  getTweetColumnMap,
  normalizeClusterValue,
  quoteIdentifier,
  runDisasterQuery,
} from "@/lib/db/disaster-query-shared";

export async function insertAlertFromPost({
  content,
  location,
  city,
  requestType,
  dashboardUrgency,
  urgencyScore,
  urgencyLabel,
  sourcePostId,
  isInformative = true,
  isClosed = false,
  client,
}) {
  const columns = await getDisasterTweetColumns(client);
  const columnMap = getTweetColumnMap(columns);

  if (!columnMap.contentColumn || !columnMap.locationColumn || !columnMap.requestTypeColumn || !columnMap.urgencyColumn) {
    throw new Error(
      "The tweets table must include content/tweet, location, request_type/category, and urgency columns"
    );
  }

  const columnValuePairs = [
    [columnMap.contentColumn, content],
    [columnMap.locationColumn, location],
    [columnMap.requestTypeColumn, requestType],
    [columnMap.urgencyColumn, dashboardUrgency],
  ];

  if (columnMap.cityColumn) {
    columnValuePairs.push([columnMap.cityColumn, city]);
  }

  if (columnMap.createdAtColumn) {
    columnValuePairs.push([columnMap.createdAtColumn, new Date()]);
  }

  if (columnMap.urgencyScoreColumn) {
    columnValuePairs.push([columnMap.urgencyScoreColumn, urgencyScore]);
  }

  if (columnMap.urgencyLabelColumn) {
    columnValuePairs.push([columnMap.urgencyLabelColumn, urgencyLabel]);
  }

  if (columnMap.sourcePostColumn) {
    columnValuePairs.push([columnMap.sourcePostColumn, sourcePostId]);
  }

  if (columnMap.isInformativeColumn) {
    columnValuePairs.push([columnMap.isInformativeColumn, isInformative === true]);
  }

  if (columnMap.isClosedColumn) {
    columnValuePairs.push([columnMap.isClosedColumn, isClosed === true]);
  }

  const columnNames = columnValuePairs.map(([column]) => quoteIdentifier(column));
  const values = columnValuePairs.map(([, value]) => value);
  const placeholders = values.map((_, index) => `$${index + 1}`);

  const result = await runDisasterQuery(
    client,
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
  city,
  requestType,
  dashboardUrgency,
  urgencyScore,
  urgencyLabel,
  isInformative,
  isClosed,
  client,
}) {
  const columns = await getDisasterTweetColumns(client);
  const columnMap = getTweetColumnMap(columns);

  if (!columnMap.contentColumn || !columnMap.locationColumn || !columnMap.requestTypeColumn || !columnMap.urgencyColumn) {
    throw new Error(
      "The tweets table must include content/tweet, location, request_type/category, and urgency columns"
    );
  }

  if (!columnMap.sourcePostColumn) {
    throw new Error(
      "The tweets table needs source_post_id or post_id to keep edit/delete operations synced with social posts"
    );
  }

  const setPairs = [
    [columnMap.contentColumn, content],
    [columnMap.locationColumn, location],
    [columnMap.requestTypeColumn, requestType],
    [columnMap.urgencyColumn, dashboardUrgency],
  ];

  if (columnMap.cityColumn) {
    setPairs.push([columnMap.cityColumn, city]);
  }

  if (columnMap.urgencyScoreColumn) {
    setPairs.push([columnMap.urgencyScoreColumn, urgencyScore]);
  }

  if (columnMap.urgencyLabelColumn) {
    setPairs.push([columnMap.urgencyLabelColumn, urgencyLabel]);
  }

  if (columnMap.isInformativeColumn && isInformative !== undefined) {
    setPairs.push([columnMap.isInformativeColumn, isInformative === true]);
  }

  if (columnMap.isClosedColumn && isClosed !== undefined) {
    setPairs.push([columnMap.isClosedColumn, isClosed === true]);
  }

  const values = [sourcePostId];
  const setClauses = setPairs.map(([column, value]) => {
    values.push(value);
    return `${quoteIdentifier(column)} = $${values.length}`;
  });

  const result = await runDisasterQuery(
    client,
    `UPDATE public.tweets
     SET ${setClauses.join(", ")}
     WHERE ${quoteIdentifier(columnMap.sourcePostColumn)}::text = $1::text
     RETURNING *`,
    values
  );

  if (result.rows[0]) {
    return result.rows[0];
  }

  return insertAlertFromPost({
    content,
    location,
    city,
    requestType,
    dashboardUrgency,
    urgencyScore,
    urgencyLabel,
    sourcePostId,
    isInformative,
    isClosed,
    client,
  });
}

export async function deactivateAlertBySourcePostId(sourcePostId, { client } = {}) {
  const columns = await getDisasterTweetColumns(client);
  const columnMap = getTweetColumnMap(columns);

  if (!columnMap.sourcePostColumn) {
    throw new Error(
      "The tweets table needs source_post_id or post_id to keep edit/delete operations synced with social posts"
    );
  }

  const clusterCitySelect = columnMap.clusterCityColumn
    ? `${quoteIdentifier(columnMap.clusterCityColumn)} AS cluster_city`
    : `NULL::text AS cluster_city`;
  const requestTypeSelect = columnMap.requestTypeColumn
    ? `${quoteIdentifier(columnMap.requestTypeColumn)} AS cluster_request_type`
    : `NULL::text AS cluster_request_type`;

  const existingResult = await runDisasterQuery(
    client,
    `SELECT ${clusterCitySelect}, ${requestTypeSelect}
     FROM public.tweets
     WHERE ${quoteIdentifier(columnMap.sourcePostColumn)}::text = $1::text
     LIMIT 1
     FOR UPDATE`,
    [sourcePostId]
  );

  const existing = existingResult.rows[0];

  if (!existing) {
    return {
      rowCount: 0,
      oldCluster: null,
    };
  }

  const oldCity = normalizeClusterValue(existing.cluster_city);
  const oldRequestType = normalizeClusterValue(existing.cluster_request_type);
  const oldCluster = oldCity && oldRequestType ? { city: oldCity, requestType: oldRequestType } : null;

  if (columnMap.isClosedColumn || columnMap.isInformativeColumn) {
    const values = [sourcePostId];
    const setClauses = [];

    if (columnMap.isClosedColumn) {
      values.push(true);
      setClauses.push(`${quoteIdentifier(columnMap.isClosedColumn)} = $${values.length}`);
    }

    if (columnMap.isInformativeColumn) {
      values.push(false);
      setClauses.push(`${quoteIdentifier(columnMap.isInformativeColumn)} = $${values.length}`);
    }

    await runDisasterQuery(
      client,
      `UPDATE public.tweets
       SET ${setClauses.join(", ")}
       WHERE ${quoteIdentifier(columnMap.sourcePostColumn)}::text = $1::text`,
      values
    );

    return {
      rowCount: 1,
      oldCluster,
      mode: "soft-close",
    };
  }

  const deletedResult = await runDisasterQuery(
    client,
    `DELETE FROM public.tweets
     WHERE ${quoteIdentifier(columnMap.sourcePostColumn)}::text = $1::text
     RETURNING 1`,
    [sourcePostId]
  );

  return {
    rowCount: deletedResult.rowCount || 0,
    oldCluster,
    mode: "hard-delete",
  };
}

export async function deleteAlertsBySourcePostId(sourcePostId, { client } = {}) {
  const columns = await getDisasterTweetColumns(client);
  const columnMap = getTweetColumnMap(columns);

  if (!columnMap.sourcePostColumn) {
    throw new Error(
      "The tweets table needs source_post_id or post_id to keep edit/delete operations synced with social posts"
    );
  }

  const result = await runDisasterQuery(
    client,
    `DELETE FROM public.tweets
     WHERE ${quoteIdentifier(columnMap.sourcePostColumn)}::text = $1::text
     RETURNING 1`,
    [sourcePostId]
  );

  return result.rowCount || 0;
}
