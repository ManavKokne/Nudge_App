import { getSessionUser, setSessionCookie } from "@/lib/auth/session";
import { findUserById } from "@/lib/db/social-queries";
import { fail, ok } from "@/lib/http/response";
import { deriveNameFromEmail, formatApiError } from "@/lib/utils";

export async function GET() {
  try {
    const sessionUser = await getSessionUser();

    if (!sessionUser) {
      return fail("Unauthorized", 401);
    }

    const latestUser = await findUserById(sessionUser.id);

    if (!latestUser) {
      return fail("Unauthorized", 401);
    }

    const name = latestUser.name || deriveNameFromEmail(latestUser.email);

    await setSessionCookie({
      id: latestUser.id,
      name,
      email: latestUser.email,
      avatarUrl: latestUser.avatar_url,
    });

    return ok({
      user: {
        id: latestUser.id,
        name,
        email: latestUser.email,
        avatarUrl: latestUser.avatar_url,
      },
    });
  } catch (error) {
    return fail(formatApiError(error, "Unable to fetch session"), 500);
  }
}
