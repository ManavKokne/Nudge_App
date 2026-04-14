import { syncAlertClusterForPostMutation } from "@/lib/db/disaster-queries";
import { syncSocialUrgencyForRecomputedClusters, updatePostProcessingMeta } from "@/lib/db/social-queries";
import { extractStructuredEntitiesWithLlm } from "@/lib/processing/llm";

export function getUrgencyFromSimilarCount(similarCountWithinHour) {
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

export async function runMockProcessing(post) {
  const { location, city, requestType, isInformative, confidence, alertContent } = await extractStructuredEntitiesWithLlm(
    post.content
  );

  const nextContent = alertContent || post.content;
  const oldCityHint = post.extracted_city;
  const oldRequestTypeHint = post.extracted_request_type;

  if (!isInformative) {
    const syncResult = await syncAlertClusterForPostMutation({
      sourcePostId: post.id,
      content: nextContent,
      location,
      city,
      requestType,
      isInformative: false,
      oldCityHint,
      oldRequestTypeHint,
    });

    await updatePostProcessingMeta(post.id, {
      location,
      city,
      requestType,
      isInformative: false,
      informativeConfidence: confidence,
      urgencyScore: null,
      urgencyLabel: null,
    });

    await syncSocialUrgencyForRecomputedClusters(syncResult.recomputedClusters);

    return {
      mode: "mock",
      alertContent: nextContent,
      location,
      city,
      requestType,
      isInformative: false,
      confidence,
      similarCountWithinHour: 0,
      urgencyScore: null,
      urgencyLabel: null,
      dashboardUrgency: null,
      insertedAlert: null,
    };
  }

  const syncResult = await syncAlertClusterForPostMutation({
    sourcePostId: post.id,
    content: nextContent,
    location,
    city,
    requestType,
    isInformative: true,
    oldCityHint,
    oldRequestTypeHint,
  });

  const focus = syncResult.focus;
  const similarCountWithinHour = focus?.similarCountWithinHour ?? 0;
  const urgencyScore = focus?.urgencyScore ?? 20;
  const urgencyLabel = focus?.urgencyLabel ?? "non-urgent";
  const dashboardUrgency = focus?.dashboardUrgency ?? "non-urgent";
  const insertedAlert = syncResult.alert;

  await updatePostProcessingMeta(post.id, {
    location,
    city,
    requestType,
    isInformative: true,
    informativeConfidence: confidence,
    urgencyScore,
    urgencyLabel,
  });

  await syncSocialUrgencyForRecomputedClusters(syncResult.recomputedClusters);

  return {
    mode: "mock",
    alertContent: nextContent,
    location,
    city,
    requestType,
    isInformative: true,
    confidence,
    similarCountWithinHour,
    urgencyScore,
    urgencyLabel,
    dashboardUrgency,
    insertedAlert,
  };
}
