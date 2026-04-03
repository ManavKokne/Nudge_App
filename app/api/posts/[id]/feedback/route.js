import { requireApiUser } from "@/lib/auth/guards";
import { incrementPostFeedback } from "@/lib/db/social-queries";
import { fail, ok } from "@/lib/http/response";
import { formatApiError } from "@/lib/utils";
import { feedbackSchema } from "@/lib/validation/content";

export async function POST(request, { params }) {
  try {
    await requireApiUser();

    const body = await request.json();
    const parsed = feedbackSchema.safeParse(body);

    if (!parsed.success) {
      return fail("Invalid feedback payload", 422, parsed.error.flatten());
    }

    const feedback = await incrementPostFeedback(params.id, parsed.data.direction);

    if (!feedback) {
      return fail("Post not found", 404);
    }

    return ok({ feedback });
  } catch (error) {
    const status = error?.status || 500;
    return fail(formatApiError(error, "Unable to submit feedback"), status);
  }
}
