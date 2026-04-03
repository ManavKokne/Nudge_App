"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Flame, MapPinned, Radar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreatePostDialog } from "@/components/feed/create-post-dialog";
import { PostCard } from "@/components/feed/post-card";

async function requestFeedback(postId, direction) {
  await fetch(`/api/posts/${postId}/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ direction }),
  });
}

export function FeedClient({ initialPosts }) {
  const [posts, setPosts] = useState(initialPosts || []);
  const [processingHint, setProcessingHint] = useState("");

  const totals = useMemo(() => {
    const urgent = posts.filter((post) => post.urgency_score >= 100).length;
    const potential = posts.filter((post) => post.urgency_score >= 40 && post.urgency_score < 100).length;
    return { urgent, potential };
  }, [posts]);

  function handleCreated(post, processing, processingError) {
    setPosts((previous) => [post, ...previous]);

    if (processingError) {
      setProcessingHint(`Post saved in social DB. Dashboard load warning: ${processingError}`);
      return;
    }

    if (processing?.mode === "mock") {
      setProcessingHint(
        `Mock pipeline: ${processing.location} | ${processing.requestType} | score ${processing.urgencyScore} (${processing.urgencyLabel}).`
      );
      return;
    }

    if (processing?.mode === "ml") {
      setProcessingHint("ML mode active: raw post stored for asynchronous ML pipeline ingestion.");
    }
  }

  async function handleFeedback(postId, direction) {
    setPosts((previous) =>
      previous.map((post) => {
        if (post.id !== postId) {
          return post;
        }

        return {
          ...post,
          upvotes: direction === "up" ? (post.upvotes || 0) + 1 : post.upvotes,
          downvotes: direction === "down" ? (post.downvotes || 0) + 1 : post.downvotes,
        };
      })
    );

    try {
      await requestFeedback(postId, direction);
    } catch {
      setProcessingHint("Could not persist feedback right now. Please refresh.");
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-4 px-4 pb-10 pt-5 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)_300px] lg:px-8">
      <aside className="hidden lg:block">
        <Card className="sticky top-24">
          <CardHeader>
            <CardTitle className="text-base">Signal Lens</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-[var(--muted)]">
            <div className="flex items-center gap-2">
              <Radar className="h-4 w-4 text-[var(--accent)]" />
              Community ingestion stream is live.
            </div>
            <div className="flex items-center gap-2">
              <MapPinned className="h-4 w-4 text-[var(--accent)]" />
              Location-tagged alerts feed dashboard analytics.
            </div>
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-[var(--danger)]" />
              {totals.urgent} urgent, {totals.potential} escalated posts.
            </div>
          </CardContent>
        </Card>
      </aside>

      <main className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Community Feed</h1>
            <p className="text-sm text-[var(--muted)]">
              Twitter x Reddit inspired signal board for disaster request ingestion.
            </p>
          </div>
          <CreatePostDialog onCreated={handleCreated} />
        </div>

        {processingHint ? (
          <div className="rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-2 text-sm text-[var(--accent-strong)]">
            {processingHint}
          </div>
        ) : null}

        {posts.length ? (
          <div className="space-y-3">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} onFeedback={handleFeedback} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex items-center gap-2 p-6 text-sm text-[var(--muted)]">
              <AlertTriangle className="h-4 w-4" />
              No posts yet. Create the first one to trigger ingestion.
            </CardContent>
          </Card>
        )}
      </main>

      <aside className="hidden lg:block space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Trends For You</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="rounded-xl bg-[var(--panel)] p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Trending location</p>
              <p className="mt-1 font-semibold">Bengaluru</p>
            </div>
            <div className="rounded-xl bg-[var(--panel)] p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Rising request</p>
              <p className="mt-1 font-semibold">Medical</p>
            </div>
            <div className="rounded-xl bg-[var(--panel)] p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Status</p>
              <p className="mt-1 font-semibold">Live ingestion active</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Score Legend</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-[var(--muted)]">
            <div className="flex items-center justify-between">
              <span>1st match (count 0)</span>
              <Badge>20</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>2nd match (count 1)</span>
              <Badge>40</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>3rd match (count 2)</span>
              <Badge>60</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>4th match (count 3)</span>
              <Badge>80</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>5th+ match (count 4+)</span>
              <Badge variant="urgent">100</Badge>
            </div>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
