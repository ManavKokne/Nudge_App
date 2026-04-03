import { countSimilarAlerts, insertAlertFromPost } from "@/lib/db/disaster-queries";
import { updatePostProcessingMeta } from "@/lib/db/social-queries";
import { extractStructuredEntities } from "@/lib/processing/nlp";

export function getUrgencyFromSimilarCount(similarCountWithinHour) {
  if (similarCountWithinHour <= 0) {
    return { urgencyScore: 20, urgencyLabel: "non-urgent" };
  }

  if (similarCountWithinHour === 1) {
    return { urgencyScore: 40, urgencyLabel: "potentially urgent" };
  }

  if (similarCountWithinHour === 2) {
    return { urgencyScore: 60, urgencyLabel: "semi-urgent" };
  }

  if (similarCountWithinHour === 3) {
    return { urgencyScore: 80, urgencyLabel: "semi-urgent" };
  }

  return { urgencyScore: 100, urgencyLabel: "urgent" };
}

export async function runMockProcessing(post) {
  const { location, requestType, alertContent } = extractStructuredEntities(post.content);

  const similarCountWithinHour = await countSimilarAlerts({
    location,
    requestType,
  });

  const { urgencyScore, urgencyLabel } = getUrgencyFromSimilarCount(similarCountWithinHour);

  const dashboardUrgency = urgencyScore >= 100 ? "urgent" : "non-urgent";

  const insertedAlert = await insertAlertFromPost({
    content: alertContent || post.content,
    location,
    requestType,
    dashboardUrgency,
    urgencyScore,
    urgencyLabel,
    sourcePostId: post.id,
  });

  await updatePostProcessingMeta(post.id, {
    location,
    requestType,
    urgencyScore,
    urgencyLabel,
  });

  return {
    mode: "mock",
    alertContent: alertContent || post.content,
    location,
    requestType,
    similarCountWithinHour,
    urgencyScore,
    urgencyLabel,
    dashboardUrgency,
    insertedAlert,
  };
}
