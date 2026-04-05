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
    return { urgencyScore: 60, urgencyLabel: "likely urgent" };
  }

  if (similarCountWithinHour === 3) {
    return { urgencyScore: 80, urgencyLabel: "likely urgent" };
  }

  return { urgencyScore: 100, urgencyLabel: "urgent" };
}

export async function runMockProcessing(post) {
  const { location, city, requestType, alertContent } = extractStructuredEntities(post.content);

  const similarCountWithinHour = await countSimilarAlerts({
    city,
    requestType,
  });

  const { urgencyScore, urgencyLabel } = getUrgencyFromSimilarCount(similarCountWithinHour);

  const dashboardUrgency = urgencyScore >= 100 ? "urgent" : "non-urgent";

  const insertedAlert = await insertAlertFromPost({
    content: alertContent || post.content,
    location,
    city,
    requestType,
    dashboardUrgency,
    urgencyScore,
    urgencyLabel,
    sourcePostId: post.id,
  });

  await updatePostProcessingMeta(post.id, {
    location,
    city,
    requestType,
    urgencyScore,
    urgencyLabel,
  });

  return {
    mode: "mock",
    alertContent: alertContent || post.content,
    location,
    city,
    requestType,
    similarCountWithinHour,
    urgencyScore,
    urgencyLabel,
    dashboardUrgency,
    insertedAlert,
  };
}
