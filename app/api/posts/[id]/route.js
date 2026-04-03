import { requireApiUser } from "@/lib/auth/guards";
import {
  countSimilarAlerts,
  deleteAlertsBySourcePostId,
  updateAlertBySourcePostId,
} from "@/lib/db/disaster-queries";
import {
  deletePostById,
  getPostById,
  listCommentsByPost,
  updatePostContent,
  updatePostProcessingMeta,
} from "@/lib/db/social-queries";
import { fail, ok } from "@/lib/http/response";
import { getUrgencyFromSimilarCount } from "@/lib/processing/mock";
import { extractStructuredEntities } from "@/lib/processing/nlp";
import { formatApiError } from "@/lib/utils";
import { updatePostSchema } from "@/lib/validation/content";

function resolveProcessingMode(post) {
  return (post?.processing_mode || process.env.PROCESSING_MODE || "mock").toLowerCase();
}

export async function GET(_request, { params }) {
  try {
    await requireApiUser();
    const { id } = await params;
    const post = await getPostById(id);

    if (!post) {
      return fail("Post not found", 404);
    }

    const comments = await listCommentsByPost(id);

    return ok({ post, comments });
  } catch (error) {
    const status = error?.status || 500;
    return fail(formatApiError(error, "Unable to fetch post"), status);
  }
}

export async function PATCH(request, { params }) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    const existingPost = await getPostById(id);

    if (!existingPost) {
      return fail("Post not found", 404);
    }

    if (existingPost.user_id !== user.id) {
      return fail("You can edit only your own post", 403);
    }

    const body = await request.json();
    const parsed = updatePostSchema.safeParse(body);

    if (!parsed.success) {
      return fail("Invalid update payload", 422, parsed.error.flatten());
    }

    const nextContent = parsed.data.content.trim();
    const processingMode = resolveProcessingMode(existingPost);

    if (processingMode === "mock") {
      const { location, requestType, alertContent } = extractStructuredEntities(nextContent);
      const similarCountWithinHour = await countSimilarAlerts({
        location,
        requestType,
        excludeSourcePostId: id,
      });
      const { urgencyScore, urgencyLabel } = getUrgencyFromSimilarCount(similarCountWithinHour);
      const dashboardUrgency = urgencyScore >= 100 ? "urgent" : "non-urgent";

      await updateAlertBySourcePostId({
        sourcePostId: id,
        content: alertContent || nextContent,
        location,
        requestType,
        dashboardUrgency,
        urgencyScore,
        urgencyLabel,
      });

      await updatePostContent({
        postId: id,
        content: nextContent,
      });

      await updatePostProcessingMeta(id, {
        location,
        requestType,
        urgencyScore,
        urgencyLabel,
      });
    } else {
      await updatePostContent({
        postId: id,
        content: nextContent,
      });
    }

    const updatedPost = await getPostById(id);

    return ok({ post: updatedPost });
  } catch (error) {
    const status = error?.status || 500;
    return fail(formatApiError(error, "Unable to update post"), status);
  }
}

export async function DELETE(_request, { params }) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    const existingPost = await getPostById(id);

    if (!existingPost) {
      return fail("Post not found", 404);
    }

    if (existingPost.user_id !== user.id) {
      return fail("You can delete only your own post", 403);
    }

    const processingMode = resolveProcessingMode(existingPost);

    if (processingMode === "mock") {
      await deleteAlertsBySourcePostId(id);
    }

    await deletePostById(id);

    return ok({ message: "Post deleted" });
  } catch (error) {
    const status = error?.status || 500;
    return fail(formatApiError(error, "Unable to delete post"), status);
  }
}
