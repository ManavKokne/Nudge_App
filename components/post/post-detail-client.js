"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PostCard } from "@/components/feed/post-card";
import { CommentsThreadCard } from "@/components/post/detail/comments-thread-card";
import { PostActionsCard } from "@/components/post/detail/post-actions-card";
import { PostDetailSidebarCards } from "@/components/post/detail/sidebar-cards";
import { normalizeUrgencyLabel } from "@/lib/utils";

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
  const urgencyLabel = normalizeUrgencyLabel(post.urgency_label);

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

  function handleCancelEdit(nextContent) {
    setIsEditing(false);
    setEditContent(nextContent);
    setError("");
  }

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-4 px-4 pb-10 pt-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-8">
      <div className="space-y-4">
        <PostActionsCard
          currentContent={post.content}
          editContent={editContent}
          isDeletingPost={isDeletingPost}
          isEditing={isEditing}
          isOwner={isOwner}
          isSavingPost={isSavingPost}
          onCancelEdit={handleCancelEdit}
          onDeletePost={handlePostDelete}
          onEditContentChange={setEditContent}
          onSaveEdit={handlePostUpdate}
          onStartEdit={() => setIsEditing(true)}
        />

        <PostCard post={post} onFeedback={handleFeedback} />

        <CommentsThreadCard
          commentText={commentText}
          comments={comments}
          error={error}
          isHydrated={isHydrated}
          onCommentSubmit={handleCommentSubmit}
          onCommentTextChange={setCommentText}
        />
      </div>

      <aside className="space-y-4">
        <PostDetailSidebarCards post={post} urgencyLabel={urgencyLabel} />
      </aside>
    </div>
  );
}
