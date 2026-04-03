import { requireApiUser } from "@/lib/auth/guards";
import { setSessionCookie } from "@/lib/auth/session";
import { findUserByEmail, updateUserProfile } from "@/lib/db/social-queries";
import { fail, ok } from "@/lib/http/response";
import { formatApiError } from "@/lib/utils";
import { updateProfileSchema } from "@/lib/validation/auth";

export async function PUT(request) {
  try {
    const currentUser = await requireApiUser();
    const body = await request.json();
    const parsed = updateProfileSchema.safeParse(body);

    if (!parsed.success) {
      return fail("Invalid profile payload", 422, parsed.error.flatten());
    }

    const { email, avatarUrl } = parsed.data;

    if (email) {
      const existing = await findUserByEmail(email);

      if (existing && existing.id !== currentUser.id) {
        return fail("Email is already used by another account", 409);
      }
    }

    const updatedUser = await updateUserProfile(currentUser.id, {
      email,
      avatarUrl,
    });

    if (!updatedUser) {
      return fail("Unable to update profile", 404);
    }

    await setSessionCookie({
      id: updatedUser.id,
      email: updatedUser.email,
      avatarUrl: updatedUser.avatar_url,
    });

    return ok({
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        avatarUrl: updatedUser.avatar_url,
      },
    });
  } catch (error) {
    const status = error?.status || 500;
    return fail(formatApiError(error, "Unable to update profile"), status);
  }
}
