import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";

export async function requirePageUser() {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function requireApiUser() {
  const user = await getSessionUser();

  if (!user) {
    const error = new Error("Unauthorized");
    error.status = 401;
    throw error;
  }

  return user;
}
