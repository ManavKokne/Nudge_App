import { recomputeClusterUrgency } from "@/lib/db/disaster-cluster-queries";
import {
  deactivateAlertBySourcePostId,
  deleteAlertsBySourcePostId,
  getAlertClusterBySourcePostId,
  updateAlertBySourcePostId,
} from "@/lib/db/disaster-alert-mutations";
import {
  applyClusterAdvisoryLock,
  getUrgencyFromClusterSize,
  isSameCluster,
  normalizeClusterKey,
  withDisasterTransaction,
} from "@/lib/db/disaster-query-shared";

function normalizeCluster(cluster) {
  if (!cluster) {
    return null;
  }

  const city = normalizeClusterKey(cluster.city);
  const requestType = normalizeClusterKey(cluster.requestType);

  if (!city || !requestType) {
    return null;
  }

  return { city, requestType };
}

function getClusterLockKey(cluster) {
  return `${cluster.city}::${cluster.requestType}`;
}

function getUniqueClusters(clusters) {
  const seen = new Set();
  const unique = [];

  clusters
    .filter(Boolean)
    .forEach((cluster) => {
      const key = getClusterLockKey(cluster);

      if (seen.has(key)) {
        return;
      }

      seen.add(key);
      unique.push(cluster);
    });

  return unique.sort((a, b) => {
    const cityDiff = a.city.localeCompare(b.city);

    if (cityDiff !== 0) {
      return cityDiff;
    }

    return a.requestType.localeCompare(b.requestType);
  });
}

function buildFocusFromClusterResult(result) {
  if (!result?.clusterSize || !result?.urgencyScore || !result?.urgencyLabel || !result?.dashboardUrgency) {
    return null;
  }

  return {
    position: result.clusterSize,
    clusterSize: result.clusterSize,
    similarCountWithinHour: Math.max(result.clusterSize - 1, 0),
    urgencyScore: result.urgencyScore,
    urgencyLabel: result.urgencyLabel,
    dashboardUrgency: result.dashboardUrgency,
  };
}

export async function syncAlertClusterForPostMutation({
  sourcePostId,
  content,
  location,
  city,
  requestType,
  isInformative,
  forceSourceUrgency,
}) {
  if (!sourcePostId) {
    throw new Error("sourcePostId is required to synchronize alert clustering");
  }

  const targetCluster = normalizeCluster({ city, requestType });
  const shouldBeActive = Boolean(isInformative && targetCluster);
  const hasForcedUrgency =
    forceSourceUrgency &&
    Number.isFinite(forceSourceUrgency.urgencyScore) &&
    typeof forceSourceUrgency.urgencyLabel === "string" &&
    forceSourceUrgency.urgencyLabel.trim();
  const forcedDashboardUrgency =
    forceSourceUrgency?.dashboardUrgency || (forceSourceUrgency?.urgencyScore >= 100 ? "urgent" : "non-urgent");

  return withDisasterTransaction(async (client) => {
    const oldCluster = normalizeCluster(
      await getAlertClusterBySourcePostId(sourcePostId, {
        client,
        forUpdate: true,
      })
    );
    const lockTargets = getUniqueClusters([oldCluster, targetCluster]);

    for (const lockTarget of lockTargets) {
      await applyClusterAdvisoryLock(client, lockTarget.city, lockTarget.requestType);
    }

    if (!shouldBeActive) {
      const deactivated = await deactivateAlertBySourcePostId(sourcePostId, { client });
      const resolvedOldCluster = normalizeCluster(deactivated.oldCluster || oldCluster);
      const recomputedClusters = [];

      if (resolvedOldCluster) {
        recomputedClusters.push(
          await recomputeClusterUrgency({
            city: resolvedOldCluster.city,
            requestType: resolvedOldCluster.requestType,
            client,
          })
        );
      }

      return {
        alert: null,
        active: false,
        oldCluster: resolvedOldCluster,
        newCluster: null,
        recomputedClusters,
        focus: null,
      };
    }

    const provisionalUrgency = hasForcedUrgency
      ? {
          urgencyScore: forceSourceUrgency.urgencyScore,
          urgencyLabel: forceSourceUrgency.urgencyLabel,
          dashboardUrgency: forcedDashboardUrgency,
        }
      : getUrgencyFromClusterSize(1);

    let syncedAlert = await updateAlertBySourcePostId({
      sourcePostId,
      content,
      location,
      city: targetCluster.city,
      requestType: targetCluster.requestType,
      dashboardUrgency: provisionalUrgency.dashboardUrgency,
      urgencyScore: provisionalUrgency.urgencyScore,
      urgencyLabel: provisionalUrgency.urgencyLabel,
      isInformative: true,
      isClosed: false,
      client,
    });

    const recomputedClusters = [];

    if (oldCluster && !isSameCluster(oldCluster, targetCluster)) {
      recomputedClusters.push(
        await recomputeClusterUrgency({
          city: oldCluster.city,
          requestType: oldCluster.requestType,
          client,
        })
      );
    }

    const newClusterResult = await recomputeClusterUrgency({
      city: targetCluster.city,
      requestType: targetCluster.requestType,
      client,
    });

    recomputedClusters.push(newClusterResult);

    if (hasForcedUrgency) {
      syncedAlert = await updateAlertBySourcePostId({
        sourcePostId,
        content,
        location,
        city: targetCluster.city,
        requestType: targetCluster.requestType,
        dashboardUrgency: forcedDashboardUrgency,
        urgencyScore: forceSourceUrgency.urgencyScore,
        urgencyLabel: forceSourceUrgency.urgencyLabel,
        isInformative: true,
        isClosed: false,
        client,
      });
    }

    const focus = buildFocusFromClusterResult(newClusterResult);

    if (hasForcedUrgency) {
      return {
        alert: syncedAlert,
        active: true,
        oldCluster,
        newCluster: targetCluster,
        recomputedClusters,
        focus: {
          position: focus?.position ?? 1,
          clusterSize: focus?.clusterSize ?? 1,
          similarCountWithinHour: focus?.similarCountWithinHour ?? 0,
          urgencyScore: forceSourceUrgency.urgencyScore,
          urgencyLabel: forceSourceUrgency.urgencyLabel,
          dashboardUrgency: forcedDashboardUrgency,
        },
      };
    }

    return {
      alert: syncedAlert,
      active: true,
      oldCluster,
      newCluster: targetCluster,
      recomputedClusters,
      focus,
    };
  });
}

export async function deleteAlertAndRecomputeClusterBySourcePostId(sourcePostId) {
  if (!sourcePostId) {
    throw new Error("sourcePostId is required to delete linked alert row");
  }

  return withDisasterTransaction(async (client) => {
    const oldCluster = normalizeCluster(
      await getAlertClusterBySourcePostId(sourcePostId, {
        client,
        forUpdate: true,
      })
    );

    if (oldCluster) {
      await applyClusterAdvisoryLock(client, oldCluster.city, oldCluster.requestType);
    }

    const deletedCount = await deleteAlertsBySourcePostId(sourcePostId, { client });
    const recomputeResult = oldCluster
      ? await recomputeClusterUrgency({
          city: oldCluster.city,
          requestType: oldCluster.requestType,
          client,
        })
      : null;

    return {
      deletedCount,
      oldCluster,
      recomputeResult,
    };
  });
}
