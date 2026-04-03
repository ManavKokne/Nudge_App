"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { MessageCircle, Send, ThumbsDown, ThumbsUp } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PostCard } from "@/components/feed/post-card";

function initials(email) {
  return email?.slice(0, 2).toUpperCase() || "NU";
}

export function PostDetailClient({ initialPost, initialComments }) {
  const [post, setPost] = useState(initialPost);
  const [comments, setComments] = useState(initialComments || []);
  const [commentText, setCommentText] = useState("");
  const [error, setError] = useState("");

  async function handleFeedback(postId, direction) {
    setPost((previous) => ({
      ...previous,
      upvotes: direction === "up" ? (previous.upvotes || 0) + 1 : previous.upvotes,
      downvotes: direction === "down" ? (previous.downvotes || 0) + 1 : previous.downvotes,
    }));

    await fetch(`/api/posts/${postId}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ direction }),
    });
  }

  async function handleCommentSubmit(event) {
    event.preventDefault();

    if (!commentText.trim()) {
      return;
    }

    setError("");

    try {
      const response = await fetch(`/api/posts/${post.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content: commentText }),
      });

      const payload = await response.json();

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "Unable to add comment");
      }

      setComments((previous) => [...previous, payload.data.comment]);
      setCommentText("");
    } catch (submitError) {
      setError(submitError.message || "Unable to add comment");
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-4 px-4 pb-10 pt-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-8">
      <div className="space-y-4">
        <PostCard post={post} onFeedback={handleFeedback} />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageCircle className="h-4 w-4" />
              Comments ({comments.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleCommentSubmit} className="flex gap-2">
              <Input
                value={commentText}
                onChange={(event) => setCommentText(event.target.value)}
                placeholder="Add a comment..."
                maxLength={1000}
              />
              <Button type="submit" size="icon">
                <Send className="h-4 w-4" />
              </Button>
            </form>
            {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

            <div className="space-y-3">
              {comments.map((comment) => (
                <div key={comment.id} className="rounded-xl border border-[var(--border)] p-3">
                  <div className="mb-2 flex items-center gap-2 text-xs text-[var(--muted)]">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={comment.author_avatar || "/avatar/av_1.png"} alt={comment.author_email} />
                      <AvatarFallback>{initials(comment.author_email)}</AvatarFallback>
                    </Avatar>
                    <span className="font-semibold text-[var(--text)]">{comment.author_email}</span>
                    <span>
                      {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed">{comment.content}</p>
                </div>
              ))}

              {!comments.length ? <p className="text-sm text-[var(--muted)]">No comments yet.</p> : null}
            </div>
          </CardContent>
        </Card>
      </div>

      <aside className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Urgency Snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span>Label</span>
              <Badge variant={post.urgency_score >= 100 ? "urgent" : "default"}>
                {post.urgency_label || "non-urgent"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Score</span>
              <Badge>{post.urgency_score || 0}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Request Type</span>
              <Badge variant="accent">{post.extracted_request_type || "General"}</Badge>
            </div>
            <div className="rounded-xl bg-[var(--panel)] p-3 text-xs text-[var(--muted)]">
              In dashboard compatibility mode, only score 100 maps to urgent. Scores below 100 map to non-urgent.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Engagement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-[var(--muted)]">
            <div className="flex items-center justify-between rounded-lg bg-[var(--panel)] px-3 py-2">
              <span className="inline-flex items-center gap-2">
                <ThumbsUp className="h-4 w-4 text-[var(--accent)]" /> Upvotes
              </span>
              <span className="font-semibold text-[var(--text)]">{post.upvotes || 0}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-[var(--panel)] px-3 py-2">
              <span className="inline-flex items-center gap-2">
                <ThumbsDown className="h-4 w-4 text-[var(--danger)]" /> Downvotes
              </span>
              <span className="font-semibold text-[var(--text)]">{post.downvotes || 0}</span>
            </div>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
