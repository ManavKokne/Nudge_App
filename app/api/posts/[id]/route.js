import { requireApiUser } from "@/lib/auth/guards";
import {
  deletePostById,
  getPostById,
  listCommentsByPost,
  updatePostContent,
} from "@/lib/db/social-queries";
import { fail, ok } from "@/lib/http/response";
import { formatApiError } from "@/lib/utils";
import { updatePostSchema } from "@/lib/validation/content";

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

    await updatePostContent({
      postId: id,
      content: parsed.data.content,
    });

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

    await deletePostById(id);

    return ok({ message: "Post deleted" });
  } catch (error) {
    const status = error?.status || 500;
    return fail(formatApiError(error, "Unable to delete post"), status);
  }
}
