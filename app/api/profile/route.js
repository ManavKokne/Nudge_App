import { requireApiUser } from "@/lib/auth/guards";
import { setSessionCookie } from "@/lib/auth/session";
import { updateUserProfile } from "@/lib/db/social-queries";
import { fail, ok } from "@/lib/http/response";
import { deriveNameFromEmail, formatApiError } from "@/lib/utils";
import { updateProfileSchema } from "@/lib/validation/auth";

export async function PUT(request) {
  try {
    const currentUser = await requireApiUser();
    const body = await request.json();
    const parsed = updateProfileSchema.safeParse(body);

    if (!parsed.success) {
      return fail("Invalid profile payload", 422, parsed.error.flatten());
    }

    const { name, avatarUrl } = parsed.data;
    const nextName = name?.trim();

    const updatedUser = await updateUserProfile(currentUser.id, {
      name: nextName,
      avatarUrl,
    });

    if (!updatedUser) {
      return fail("Unable to update profile", 404);
    }

    const resolvedName = updatedUser.name || deriveNameFromEmail(updatedUser.email);

    await setSessionCookie({
      id: updatedUser.id,
      name: resolvedName,
      email: updatedUser.email,
      avatarUrl: updatedUser.avatar_url,
    });

    return ok({
      user: {
        id: updatedUser.id,
        name: resolvedName,
        email: updatedUser.email,
        avatarUrl: updatedUser.avatar_url,
      },
    });
  } catch (error) {
    const status = error?.status || 500;
    return fail(formatApiError(error, "Unable to update profile"), status);
  }
}
