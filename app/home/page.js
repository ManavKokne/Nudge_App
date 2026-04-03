import { FeedClient } from "@/components/feed/feed-client";
import { TopNavbar } from "@/components/layout/top-navbar";
import { requirePageUser } from "@/lib/auth/guards";
import { listPosts } from "@/lib/db/social-queries";

export const metadata = {
  title: "Nudge | Community Feed",
};

export default async function HomePage() {
  const user = await requirePageUser();
  const posts = await listPosts({ limit: 50, offset: 0 });

  return (
    <div className="min-h-screen">
      <TopNavbar user={user} />
      <FeedClient initialPosts={posts} />
    </div>
  );
}
