import bcrypt from "bcryptjs";
import { ok, fail } from "@/lib/http/response";
import { loginSchema } from "@/lib/validation/auth";
import { findUserByEmail } from "@/lib/db/social-queries";
import { deriveNameFromEmail, formatApiError } from "@/lib/utils";
import { setSessionCookie } from "@/lib/auth/session";

export async function POST(request) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return fail("Invalid login payload", 422, parsed.error.flatten());
    }

    const { email, password } = parsed.data;
    const user = await findUserByEmail(email);

    if (!user) {
      return fail("Invalid email or password", 401);
    }

    const passwordValid = await bcrypt.compare(password, user.password_hash);

    if (!passwordValid) {
      return fail("Invalid email or password", 401);
    }

    const name = user.name || deriveNameFromEmail(user.email);

    await setSessionCookie({
      id: user.id,
      name,
      email: user.email,
      avatarUrl: user.avatar_url,
    });

    return ok({
      user: {
        id: user.id,
        name,
        email: user.email,
        avatarUrl: user.avatar_url,
      },
    });
  } catch (error) {
    return fail(formatApiError(error, "Unable to login"), 500);
  }
}
