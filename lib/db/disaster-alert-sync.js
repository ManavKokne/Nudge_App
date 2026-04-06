import { countSimilarAlerts } from "@/lib/db/disaster-cluster-queries";
import {
  deactivateAlertBySourcePostId,
  deleteAlertsBySourcePostId,
  updateAlertBySourcePostId,
} from "@/lib/db/disaster-alert-mutations";
import { normalizeClusterKey } from "@/lib/db/disaster-query-shared";

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

export async function syncAlertClusterForPostMutation({
  sourcePostId,
  content,
  location,
  city,
  requestType,
  isInformative,
}) {
  if (!sourcePostId) {
    throw new Error("sourcePostId is required to synchronize alert clustering");
  }

  const normalizedCity = normalizeClusterKey(city);
  const normalizedRequestType = normalizeClusterKey(requestType);
  const shouldBeActive = Boolean(isInformative && normalizedCity && normalizedRequestType);

  if (!shouldBeActive) {
    await deactivateAlertBySourcePostId(sourcePostId);

    return {
      alert: null,
      active: false,
      oldCluster: null,
      newCluster: null,
      recomputedClusters: [],
      focus: null,
    };
  }

  const similarCountWithinHour = await countSimilarAlerts({
    city: normalizedCity,
    requestType: normalizedRequestType,
    excludeSourcePostId: sourcePostId,
  });

  const { urgencyScore, urgencyLabel } = getUrgencyFromSimilarCount(similarCountWithinHour);
  const dashboardUrgency = urgencyScore >= 100 ? "urgent" : "non-urgent";

  const syncedAlert = await updateAlertBySourcePostId({
    sourcePostId,
    content,
    location,
    city: normalizedCity,
    requestType: normalizedRequestType,
    dashboardUrgency,
    urgencyScore,
    urgencyLabel,
    isInformative: true,
    isClosed: false,
  });

  return {
    alert: syncedAlert,
    active: true,
    oldCluster: null,
    newCluster: { city: normalizedCity, requestType: normalizedRequestType },
    recomputedClusters: [],
    focus: {
      position: similarCountWithinHour + 1,
      similarCountWithinHour,
      urgencyScore,
      urgencyLabel,
      dashboardUrgency,
    },
  };
}

export async function deleteAlertAndRecomputeClusterBySourcePostId(sourcePostId) {
  if (!sourcePostId) {
    throw new Error("sourcePostId is required to delete linked alert row");
  }

  const deletedCount = await deleteAlertsBySourcePostId(sourcePostId);

  return {
    deletedCount,
    oldCluster: null,
    recomputeResult: null,
  };
}
