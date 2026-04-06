import {
  buildActiveInformativeClause,
  getDisasterTweetColumns,
  getTweetColumnMap,
  normalizeClusterKey,
  quoteIdentifier,
  runDisasterQuery,
} from "@/lib/db/disaster-query-shared";

function getUrgencyFromSimilarCount(similarCountWithinHour) {
  if (similarCountWithinHour <= 0) {
    return { urgencyScore: 20, urgencyLabel: "non-urgent" };
  }

  if (similarCountWithinHour === 1) {
    return { urgencyScore: 40, urgencyLabel: "potentially urgent" };
  }

  if (similarCountWithinHour === 2) {
    return { urgencyScore: 60, urgencyLabel: "likely urgent" };
  }

  if (similarCountWithinHour === 3) {
    return { urgencyScore: 80, urgencyLabel: "likely urgent" };
  }

  return { urgencyScore: 100, urgencyLabel: "urgent" };
}

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

export async function recomputeClusterUrgency({ city, requestType, focusSourcePostId, client }) {
  const similarCountWithinHour = await countSimilarAlerts({
    city,
    requestType,
    excludeSourcePostId: focusSourcePostId,
    client,
  });

  const { urgencyScore, urgencyLabel } = getUrgencyFromSimilarCount(similarCountWithinHour);
  const dashboardUrgency = urgencyScore >= 100 ? "urgent" : "non-urgent";

  return {
    city: normalizeClusterKey(city),
    requestType: normalizeClusterKey(requestType),
    clusterSize: similarCountWithinHour + (focusSourcePostId ? 1 : 0),
    updatedCount: 0,
    focus: focusSourcePostId
      ? {
          position: similarCountWithinHour + 1,
          similarCountWithinHour,
          urgencyScore,
          urgencyLabel,
          dashboardUrgency,
        }
      : null,
  };
}
