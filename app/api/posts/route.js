import { requireApiUser } from "@/lib/auth/guards";
import { createPost, getPostById, listPosts } from "@/lib/db/social-queries";
import { fail, ok } from "@/lib/http/response";
import { processPost } from "@/lib/processing";
import { formatApiError } from "@/lib/utils";
import { createPostSchema } from "@/lib/validation/content";

export async function GET() {
  try {
    await requireApiUser();
    const posts = await listPosts({ limit: 100, offset: 0 });
    return ok({ posts });
  } catch (error) {
    const status = error?.status || 500;
    return fail(formatApiError(error, "Unable to fetch posts"), status);
  }
}

export async function POST(request) {
  try {
    const user = await requireApiUser();
    const body = await request.json();
    const parsed = createPostSchema.safeParse(body);

    if (!parsed.success) {
      return fail("Invalid post payload", 422, parsed.error.flatten());
    }

    const processingMode = (process.env.PROCESSING_MODE || "mock").toLowerCase();
    const phoneNumber = parsed.data.phoneNumber?.trim() || undefined;

    const post = await createPost({
      userId: user.id,
      content: parsed.data.content,
      processingMode,
      phoneNumber,
    });

    let processing = null;
    let processingError = null;

    try {
      processing = await processPost(post);
    } catch (pipelineError) {
      processingError = formatApiError(pipelineError, "Unable to process post for downstream pipeline");
    }

    const hydratedPost = await getPostById(post.id);

    return ok(
      {
        post: hydratedPost,
        processing,
        processingError,
      },
      201
    );
  } catch (error) {
    const status = error?.status || 500;
    return fail(formatApiError(error, "Unable to create post"), status);
  }
}
