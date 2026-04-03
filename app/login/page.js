import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { getSessionUser } from "@/lib/auth/session";

export const metadata = {
  title: "Nudge | Login",
};

export default async function LoginPage() {
  const user = await getSessionUser();

  if (user) {
    redirect("/home");
  }

  return (
    <main className="auth-screen">
      <div className="auth-glow auth-glow-left" />
      <div className="auth-glow auth-glow-right" />
      <div className="relative z-10 w-full px-4 sm:px-6">
        <AuthForm mode="login" />
      </div>
    </main>
  );
}
