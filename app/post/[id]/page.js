import { notFound } from "next/navigation";
import { TopNavbar } from "@/components/layout/top-navbar";
import { PostDetailClient } from "@/components/post/post-detail-client";
import { requirePageUser } from "@/lib/auth/guards";
import { getPostById, listCommentsByPost } from "@/lib/db/social-queries";

export async function generateMetadata({ params }) {
  const post = await getPostById(params.id);

  return {
    title: post ? `Nudge | ${post.author_email}` : "Nudge | Post",
  };
}

export default async function PostDetailPage({ params }) {
  const user = await requirePageUser();
  const post = await getPostById(params.id);

  if (!post) {
    notFound();
  }

  const comments = await listCommentsByPost(params.id);

  return (
    <div className="min-h-screen">
      <TopNavbar user={user} />
      <PostDetailClient initialPost={post} initialComments={comments} />
    </div>
  );
}
