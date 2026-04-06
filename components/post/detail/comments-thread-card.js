import { formatDistanceToNow } from "date-fns";
import { MessageCircle, Send } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

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

export function CommentsThreadCard({
  commentText,
  comments,
  error,
  isHydrated,
  onCommentSubmit,
  onCommentTextChange,
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageCircle className="h-4 w-4" />
          Comments ({comments.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={onCommentSubmit} className="flex gap-2">
          <Input
            value={commentText}
            onChange={(event) => onCommentTextChange(event.target.value)}
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
                  <AvatarImage src={comment.author_avatar || "/avatar/av_1.png"} alt={comment.author_name || comment.author_email} />
                  <AvatarFallback>{initials(comment.author_name, comment.author_email)}</AvatarFallback>
                </Avatar>
                <span className="font-semibold text-[var(--text)]">{comment.author_name || comment.author_email}</span>
                <span>{isHydrated ? formatDistanceToNow(new Date(comment.created_at), { addSuffix: true }) : "just now"}</span>
              </div>
              <p className="text-sm leading-relaxed">{comment.content}</p>
            </div>
          ))}

          {!comments.length ? <p className="text-sm text-[var(--muted)]">No comments yet.</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}
