import {
  buildActiveInformativeClause,
  getDisasterTweetColumns,
  getTweetColumnMap,
  getUrgencyFromClusterSize,
  normalizeClusterKey,
  quoteIdentifier,
  runDisasterQuery,
} from "@/lib/db/disaster-query-shared";

export async function countSimilarAlerts({ city, requestType, excludeSourcePostId, client }) {
  const columns = await getDisasterTweetColumns(client);
  const columnMap = getTweetColumnMap(columns);

  if (!columnMap.clusterCityColumn || !columnMap.requestTypeColumn || !columnMap.createdAtColumn) {
    throw new Error(
      "The tweets table is missing one of the required columns: city/location, request_type/category, or created_at"
    );
  }

  const normalizedCity = normalizeClusterKey(city);
  const normalizedRequestType = normalizeClusterKey(requestType);

  if (!normalizedCity || !normalizedRequestType) {
    return 0;
  }

  const values = [normalizedCity, normalizedRequestType];
  const activeClause = buildActiveInformativeClause(columnMap);
  let exclusionClause = "";

  if (excludeSourcePostId && columnMap.sourcePostColumn) {
    values.push(excludeSourcePostId);
    exclusionClause = ` AND ${quoteIdentifier(columnMap.sourcePostColumn)}::text <> $${values.length}::text`;
  }

  const queryText = `SELECT COUNT(*)::int AS count
                     FROM public.tweets
                     WHERE LOWER(${quoteIdentifier(columnMap.clusterCityColumn)}::text) = $1
                       AND LOWER(${quoteIdentifier(columnMap.requestTypeColumn)}::text) = $2
                       AND ${quoteIdentifier(columnMap.createdAtColumn)} > NOW() - INTERVAL '1 hour'${activeClause}${exclusionClause}`;

  const result = await runDisasterQuery(client, queryText, values);

  return result.rows[0]?.count || 0;
}

export async function recomputeClusterUrgency({ city, requestType, client }) {
  const columns = await getDisasterTweetColumns(client);
  const columnMap = getTweetColumnMap(columns);

  if (!columnMap.clusterCityColumn || !columnMap.requestTypeColumn || !columnMap.createdAtColumn) {
    throw new Error(
      "The tweets table is missing one of the required columns: city/location, request_type/category, or created_at"
    );
  }

  const normalizedCity = normalizeClusterKey(city);
  const normalizedRequestType = normalizeClusterKey(requestType);

  if (!normalizedCity || !normalizedRequestType) {
    return {
      city: normalizedCity,
      requestType: normalizedRequestType,
      clusterSize: 0,
      updatedCount: 0,
      urgencyScore: null,
      urgencyLabel: null,
      dashboardUrgency: null,
    };
  }

  const activeClause = buildActiveInformativeClause(columnMap);

  const countResult = await runDisasterQuery(
    client,
    `SELECT COUNT(*)::int AS count
     FROM public.tweets
     WHERE LOWER(${quoteIdentifier(columnMap.clusterCityColumn)}::text) = $1
       AND LOWER(${quoteIdentifier(columnMap.requestTypeColumn)}::text) = $2
       AND ${quoteIdentifier(columnMap.createdAtColumn)} > NOW() - INTERVAL '1 hour'${activeClause}`,
    [normalizedCity, normalizedRequestType]
  );

  const clusterSize = countResult.rows[0]?.count || 0;

  if (clusterSize <= 0) {
    return {
      city: normalizedCity,
      requestType: normalizedRequestType,
      clusterSize: 0,
      updatedCount: 0,
      urgencyScore: null,
      urgencyLabel: null,
      dashboardUrgency: null,
    };
  }

  const { urgencyScore, urgencyLabel, dashboardUrgency } = getUrgencyFromClusterSize(clusterSize);
  const updateValues = [normalizedCity, normalizedRequestType];
  const setClauses = [];

  if (columnMap.urgencyScoreColumn) {
    updateValues.push(urgencyScore);
    setClauses.push(`${quoteIdentifier(columnMap.urgencyScoreColumn)} = $${updateValues.length}`);
  }

  if (columnMap.urgencyLabelColumn) {
    updateValues.push(urgencyLabel);
    setClauses.push(`${quoteIdentifier(columnMap.urgencyLabelColumn)} = $${updateValues.length}`);
  }

  if (columnMap.urgencyColumn) {
    updateValues.push(dashboardUrgency);
    setClauses.push(`${quoteIdentifier(columnMap.urgencyColumn)} = $${updateValues.length}`);
  }

  if (columnMap.updatedAtColumn) {
    setClauses.push(`${quoteIdentifier(columnMap.updatedAtColumn)} = NOW()`);
  }

  if (!setClauses.length) {
    return {
      city: normalizedCity,
      requestType: normalizedRequestType,
      clusterSize,
      updatedCount: 0,
      urgencyScore,
      urgencyLabel,
      dashboardUrgency,
    };
  }

  const updateResult = await runDisasterQuery(
    client,
    `UPDATE public.tweets
     SET ${setClauses.join(", ")}
     WHERE LOWER(${quoteIdentifier(columnMap.clusterCityColumn)}::text) = $1
       AND LOWER(${quoteIdentifier(columnMap.requestTypeColumn)}::text) = $2
       AND ${quoteIdentifier(columnMap.createdAtColumn)} > NOW() - INTERVAL '1 hour'${activeClause}`,
    updateValues
  );

  return {
    city: normalizedCity,
    requestType: normalizedRequestType,
    clusterSize,
    updatedCount: updateResult.rowCount || 0,
    urgencyScore,
    urgencyLabel,
    dashboardUrgency,
  };
}
