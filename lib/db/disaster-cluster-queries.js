import {
  applyClusterAdvisoryLock,
  buildActiveInformativeClause,
  getDisasterTweetColumns,
  getTweetColumnMap,
  getUrgencyFromClusterPosition,
  normalizeClusterValue,
  quoteIdentifier,
  runDisasterQuery,
  withDisasterTransaction,
} from "@/lib/db/disaster-query-shared";

async function recomputeClusterUrgencyTx({ client, columns, city, requestType, focusSourcePostId }) {
  const normalizedCity = normalizeClusterValue(city);
  const normalizedRequestType = normalizeClusterValue(requestType);

  if (!normalizedCity || !normalizedRequestType) {
    return {
      city: normalizedCity,
      requestType: normalizedRequestType,
      clusterSize: 0,
      updatedCount: 0,
      focus: null,
    };
  }

  const columnMap = getTweetColumnMap(columns);

  if (!columnMap.clusterCityColumn || !columnMap.requestTypeColumn || !columnMap.createdAtColumn || !columnMap.idColumn) {
    throw new Error(
      "Cluster recomputation requires city/location, request_type/category/type, created_at/timestamp, and id/tweet_id columns"
    );
  }

  await applyClusterAdvisoryLock(client, normalizedCity, normalizedRequestType);

  const activeClause = buildActiveInformativeClause(columnMap);
  const sourceSelect = columnMap.sourcePostColumn
    ? `, ${quoteIdentifier(columnMap.sourcePostColumn)}::text AS row_source_post`
    : "";

  const rowsResult = await runDisasterQuery(
    client,
    `SELECT ${quoteIdentifier(columnMap.idColumn)} AS row_id,
            ${quoteIdentifier(columnMap.createdAtColumn)} AS row_created_at${sourceSelect}
     FROM public.tweets
     WHERE ${quoteIdentifier(columnMap.clusterCityColumn)} = $1
       AND ${quoteIdentifier(columnMap.requestTypeColumn)} = $2
       AND ${quoteIdentifier(columnMap.createdAtColumn)} > NOW() - INTERVAL '1 hour'${activeClause}
     ORDER BY ${quoteIdentifier(columnMap.createdAtColumn)} ASC, ${quoteIdentifier(columnMap.idColumn)} ASC
     FOR UPDATE`,
    [normalizedCity, normalizedRequestType]
  );

  const rows = rowsResult.rows;
  let updatedCount = 0;
  let focus = null;

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const position = index + 1;
    const { urgencyScore, urgencyLabel } = getUrgencyFromClusterPosition(position);
    const dashboardUrgency = urgencyScore >= 100 ? "urgent" : "non-urgent";

    const setClauses = [];
    const values = [row.row_id];

    if (columnMap.urgencyScoreColumn) {
      values.push(urgencyScore);
      setClauses.push(`${quoteIdentifier(columnMap.urgencyScoreColumn)} = $${values.length}`);
    }

    if (columnMap.urgencyLabelColumn) {
      values.push(urgencyLabel);
      setClauses.push(`${quoteIdentifier(columnMap.urgencyLabelColumn)} = $${values.length}`);
    }

    if (columnMap.urgencyColumn) {
      values.push(dashboardUrgency);
      setClauses.push(`${quoteIdentifier(columnMap.urgencyColumn)} = $${values.length}`);
    }

    if (setClauses.length) {
      await runDisasterQuery(
        client,
        `UPDATE public.tweets
         SET ${setClauses.join(", ")}
         WHERE ${quoteIdentifier(columnMap.idColumn)} = $1`,
        values
      );

      updatedCount += 1;
    }

    if (
      focusSourcePostId &&
      columnMap.sourcePostColumn &&
      row.row_source_post &&
      String(row.row_source_post) === String(focusSourcePostId)
    ) {
      focus = {
        position,
        urgencyScore,
        urgencyLabel,
        dashboardUrgency,
        similarCountWithinHour: Math.max(0, position - 1),
      };
    }
  }

  return {
    city: normalizedCity,
    requestType: normalizedRequestType,
    clusterSize: rows.length,
    updatedCount,
    focus,
  };
}

export async function recomputeClusterUrgency({ city, requestType, focusSourcePostId, client }) {
  if (client?.query) {
    const columns = await getDisasterTweetColumns(client);
    return recomputeClusterUrgencyTx({
      client,
      columns,
      city,
      requestType,
      focusSourcePostId,
    });
  }

  return withDisasterTransaction(async (txClient) => {
    const columns = await getDisasterTweetColumns(txClient);
    return recomputeClusterUrgencyTx({
      client: txClient,
      columns,
      city,
      requestType,
      focusSourcePostId,
    });
  });
}

export async function countSimilarAlerts({ city, requestType, excludeSourcePostId, client }) {
  const columns = await getDisasterTweetColumns(client);
  const columnMap = getTweetColumnMap(columns);

  if (!columnMap.clusterCityColumn || !columnMap.requestTypeColumn || !columnMap.createdAtColumn) {
    throw new Error(
      "The tweets table is missing one of the required columns: city/location, request_type/category, or created_at"
    );
  }

  const values = [city, requestType];
  const activeClause = buildActiveInformativeClause(columnMap);
  let exclusionClause = "";

  if (excludeSourcePostId && columnMap.sourcePostColumn) {
    values.push(excludeSourcePostId);
    exclusionClause = ` AND ${quoteIdentifier(columnMap.sourcePostColumn)}::text <> $${values.length}::text`;
  }

  const queryText = `SELECT COUNT(*)::int AS count
                     FROM public.tweets
                     WHERE ${quoteIdentifier(columnMap.clusterCityColumn)} = $1
                       AND ${quoteIdentifier(columnMap.requestTypeColumn)} = $2
                       AND ${quoteIdentifier(columnMap.createdAtColumn)} > NOW() - INTERVAL '1 hour'${activeClause}${exclusionClause}`;

  const result = await runDisasterQuery(client, queryText, values);

  return result.rows[0]?.count || 0;
}
