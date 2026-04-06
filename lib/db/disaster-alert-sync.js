import {
  getDisasterTweetColumns,
  getTweetColumnMap,
  isSameCluster,
  normalizeClusterValue,
  quoteIdentifier,
  runDisasterQuery,
  withDisasterTransaction,
} from "@/lib/db/disaster-query-shared";
import { recomputeClusterUrgency } from "@/lib/db/disaster-cluster-queries";
import { deactivateAlertBySourcePostId, updateAlertBySourcePostId } from "@/lib/db/disaster-alert-mutations";

async function getExistingAlertClusterBySourcePostId({ sourcePostId, columnMap, client }) {
  if (!sourcePostId || !columnMap.sourcePostColumn || !columnMap.clusterCityColumn || !columnMap.requestTypeColumn) {
    return null;
  }

  const result = await runDisasterQuery(
    client,
    `SELECT ${quoteIdentifier(columnMap.clusterCityColumn)} AS cluster_city,
            ${quoteIdentifier(columnMap.requestTypeColumn)} AS cluster_request_type
     FROM public.tweets
     WHERE ${quoteIdentifier(columnMap.sourcePostColumn)}::text = $1::text
     LIMIT 1
     FOR UPDATE`,
    [sourcePostId]
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  const city = normalizeClusterValue(row.cluster_city);
  const requestType = normalizeClusterValue(row.cluster_request_type);

  if (!city || !requestType) {
    return null;
  }

  return { city, requestType };
}

export async function syncAlertClusterForPostMutation({
  sourcePostId,
  content,
  location,
  city,
  requestType,
  isInformative,
  oldCityHint,
  oldRequestTypeHint,
}) {
  if (!sourcePostId) {
    throw new Error("sourcePostId is required to synchronize alert clustering");
  }

  return withDisasterTransaction(async (client) => {
    const columns = await getDisasterTweetColumns(client);
    const columnMap = getTweetColumnMap(columns);

    if (!columnMap.sourcePostColumn) {
      throw new Error(
        "The tweets table needs source_post_id or post_id to keep edit/delete operations synced with social posts"
      );
    }

    const previousClusterFromAlert = await getExistingAlertClusterBySourcePostId({
      sourcePostId,
      columnMap,
      client,
    });

    const normalizedOldCityHint = normalizeClusterValue(oldCityHint);
    const normalizedOldRequestTypeHint = normalizeClusterValue(oldRequestTypeHint);

    const previousClusterFromHints =
      normalizedOldCityHint && normalizedOldRequestTypeHint
        ? {
            city: normalizedOldCityHint,
            requestType: normalizedOldRequestTypeHint,
          }
        : null;

    const oldCluster = previousClusterFromAlert || previousClusterFromHints;

    const normalizedCity = normalizeClusterValue(city);
    const normalizedRequestType = normalizeClusterValue(requestType);
    const shouldBeActive = Boolean(isInformative && normalizedCity && normalizedRequestType);

    let syncedAlert = null;

    if (shouldBeActive) {
      syncedAlert = await updateAlertBySourcePostId({
        sourcePostId,
        content,
        location,
        city: normalizedCity,
        requestType: normalizedRequestType,
        dashboardUrgency: "non-urgent",
        urgencyScore: 20,
        urgencyLabel: "non-urgent",
        isInformative: true,
        isClosed: false,
        client,
      });
    } else {
      await deactivateAlertBySourcePostId(sourcePostId, { client });
    }

    const recomputedClusters = [];
    const newCluster = shouldBeActive ? { city: normalizedCity, requestType: normalizedRequestType } : null;

    if (oldCluster && (!newCluster || !isSameCluster(oldCluster, newCluster))) {
      recomputedClusters.push(
        await recomputeClusterUrgency({
          city: oldCluster.city,
          requestType: oldCluster.requestType,
          client,
        })
      );
    }

    let newClusterResult = null;

    if (newCluster) {
      newClusterResult = await recomputeClusterUrgency({
        city: newCluster.city,
        requestType: newCluster.requestType,
        focusSourcePostId: sourcePostId,
        client,
      });

      recomputedClusters.push(newClusterResult);
    }

    return {
      alert: syncedAlert,
      active: shouldBeActive,
      oldCluster,
      newCluster,
      recomputedClusters,
      focus: newClusterResult?.focus || null,
    };
  });
}
