import { requireApiUser } from "@/lib/auth/guards";
import { getPostById, listCommentsByPost } from "@/lib/db/social-queries";
import { fail, ok } from "@/lib/http/response";
import { formatApiError } from "@/lib/utils";

export async function GET(_request, { params }) {
  try {
    await requireApiUser();
    const post = await getPostById(params.id);

    if (!post) {
      return fail("Post not found", 404);
    }

    const comments = await listCommentsByPost(params.id);

    return ok({ post, comments });
  } catch (error) {
    const status = error?.status || 500;
    return fail(formatApiError(error, "Unable to fetch post"), status);
  }
}
