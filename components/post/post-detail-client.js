"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { LoaderCircle, MessageCircle, PencilLine, Send, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PostCard } from "@/components/feed/post-card";

function initials(name, email) {
  const source = name?.trim() || email?.split("@")[0]?.trim();

  if (!source) {
    return "NU";
  }

  const parts = source.split(/[\s._-]+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

export function PostDetailClient({ initialPost, initialComments, currentUser }) {
  const router = useRouter();
  const [post, setPost] = useState(initialPost);
  const [comments, setComments] = useState(initialComments || []);
  const [commentText, setCommentText] = useState("");
  const [editContent, setEditContent] = useState(initialPost?.content || "");
  const [isEditing, setIsEditing] = useState(false);
  const [isSavingPost, setIsSavingPost] = useState(false);
  const [isDeletingPost, setIsDeletingPost] = useState(false);
  const [error, setError] = useState("");
  const [isHydrated, setIsHydrated] = useState(false);

  const isOwner = currentUser?.id && post?.user_id && currentUser.id === post.user_id;

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  async function handleFeedback(postId, direction) {
    setError("");

    try {
      const response = await fetch(`/api/posts/${postId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ direction }),
      });

      const payload = await response.json();

      if (!response.ok || !payload?.success || !payload?.data?.feedback) {
        throw new Error(payload?.error || "Unable to submit feedback");
      }

      const feedback = payload.data.feedback;

      setPost((previous) => ({
        ...previous,
        upvotes: feedback.upvotes,
        downvotes: feedback.downvotes,
        my_feedback: feedback.direction,
      }));
    } catch (feedbackError) {
      setError(feedbackError.message || "Unable to submit feedback");
    }
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

  async function handlePostUpdate() {
    if (!editContent.trim()) {
      setError("Post content cannot be empty");
      return;
    }

    setError("");
    setIsSavingPost(true);

    try {
      const response = await fetch(`/api/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content: editContent }),
      });

      const payload = await response.json();

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "Unable to update post");
      }

      setPost(payload.data.post);
      setEditContent(payload.data.post.content || editContent);
      setIsEditing(false);
      router.refresh();
    } catch (updateError) {
      setError(updateError.message || "Unable to update post");
    } finally {
      setIsSavingPost(false);
    }
  }

  async function handlePostDelete() {
    const confirmed = window.confirm("Delete this post permanently?");

    if (!confirmed) {
      return;
    }

    setError("");
    setIsDeletingPost(true);

    try {
      const response = await fetch(`/api/posts/${post.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      const payload = await response.json();

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "Unable to delete post");
      }

      router.push("/home");
      router.refresh();
    } catch (deleteError) {
      setError(deleteError.message || "Unable to delete post");
      setIsDeletingPost(false);
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-4 px-4 pb-10 pt-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-8">
      <div className="space-y-4">
        {isOwner ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Post Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isEditing ? (
                <div className="space-y-2">
                  <Textarea
                    value={editContent}
                    onChange={(event) => setEditContent(event.target.value)}
                    maxLength={3000}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" onClick={handlePostUpdate} disabled={isSavingPost}>
                      {isSavingPost ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <PencilLine className="h-4 w-4" />}
                      Save Edit
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsEditing(false);
                        setEditContent(post.content || "");
                        setError("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="secondary" onClick={() => setIsEditing(true)}>
                    <PencilLine className="h-4 w-4" />
                    Edit Post
                  </Button>
                  <Button type="button" variant="danger" onClick={handlePostDelete} disabled={isDeletingPost}>
                    {isDeletingPost ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    Delete Post
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}

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
                      <AvatarImage
                        src={comment.author_avatar || "/avatar/av_1.png"}
                        alt={comment.author_name || comment.author_email}
                      />
                      <AvatarFallback>{initials(comment.author_name, comment.author_email)}</AvatarFallback>
                    </Avatar>
                    <span className="font-semibold text-[var(--text)]">{comment.author_name || comment.author_email}</span>
                    <span>
                      {isHydrated ? formatDistanceToNow(new Date(comment.created_at), { addSuffix: true }) : "just now"}
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
