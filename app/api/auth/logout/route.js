import { clearSessionCookie } from "@/lib/auth/session";
import { fail, ok } from "@/lib/http/response";
import { formatApiError } from "@/lib/utils";

export async function POST() {
  try {
    await clearSessionCookie();
    return ok({ message: "Logged out" });
  } catch (error) {
    return fail(formatApiError(error, "Unable to logout"), 500);
  }
}
