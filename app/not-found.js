import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center shadow-lg">
        <h1 className="text-2xl font-bold">Post not found</h1>
        <p className="text-sm text-[var(--muted)]">
          The requested content may have been removed or the link is incorrect.
        </p>
        <Button asChild>
          <Link href="/home">Back to feed</Link>
        </Button>
      </div>
    </main>
  );
}
