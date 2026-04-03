import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";

export default async function IndexPage() {
  const user = await getSessionUser();
  redirect(user ? "/home" : "/login");
}
