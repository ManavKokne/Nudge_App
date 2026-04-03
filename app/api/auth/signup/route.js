import bcrypt from "bcryptjs";
import { AVATAR_COUNT, DEFAULT_AVATAR } from "@/lib/constants";
import { ok, fail } from "@/lib/http/response";
import { signupSchema } from "@/lib/validation/auth";
import { createUser, findUserByEmail } from "@/lib/db/social-queries";
import { formatApiError } from "@/lib/utils";
import { setSessionCookie } from "@/lib/auth/session";

function getRandomAvatar() {
  const index = Math.max(1, Math.floor(Math.random() * AVATAR_COUNT) + 1);
  return `/avatar/av_${index}.png`;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const parsed = signupSchema.safeParse(body);

    if (!parsed.success) {
      return fail("Invalid signup payload", 422, parsed.error.flatten());
    }

    const { email, password } = parsed.data;
    const existingUser = await findUserByEmail(email);

    if (existingUser) {
      return fail("Email already registered", 409);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const avatarUrl = getRandomAvatar() || DEFAULT_AVATAR;

    const user = await createUser({
      email,
      passwordHash,
      avatarUrl,
    });

    await setSessionCookie({
      id: user.id,
      email: user.email,
      avatarUrl: user.avatar_url,
    });

    return ok(
      {
        user: {
          id: user.id,
          email: user.email,
          avatarUrl: user.avatar_url,
        },
      },
      201
    );
  } catch (error) {
    return fail(formatApiError(error, "Unable to create account"), 500);
  }
}
