import { requireApiUser } from "@/lib/auth/guards";
import { createComment, getPostById, listCommentsByPost } from "@/lib/db/social-queries";
import { fail, ok } from "@/lib/http/response";
import { formatApiError } from "@/lib/utils";
import { createCommentSchema } from "@/lib/validation/content";

export async function GET(_request, { params }) {
  try {
    await requireApiUser();
    const comments = await listCommentsByPost(params.id);
    return ok({ comments });
  } catch (error) {
    const status = error?.status || 500;
    return fail(formatApiError(error, "Unable to fetch comments"), status);
  }
}

export async function POST(request, { params }) {
  try {
    const user = await requireApiUser();
    const post = await getPostById(params.id);

    if (!post) {
      return fail("Post not found", 404);
    }

    const body = await request.json();
    const parsed = createCommentSchema.safeParse(body);

    if (!parsed.success) {
      return fail("Invalid comment payload", 422, parsed.error.flatten());
    }

    const comment = await createComment({
      postId: params.id,
      userId: user.id,
      content: parsed.data.content,
    });

    const enriched = {
      ...comment,
      author_email: user.email,
      author_avatar: user.avatarUrl,
    };

    return ok({ comment: enriched }, 201);
  } catch (error) {
    const status = error?.status || 500;
    return fail(formatApiError(error, "Unable to create comment"), status);
  }
}
