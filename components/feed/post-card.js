"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, ThumbsDown, ThumbsUp } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function initialFromEmail(email) {
  if (!email) {
    return "NU";
  }

  return email.slice(0, 2).toUpperCase();
}

export function PostCard({ post, onFeedback, compact = false }) {
  const isUrgent = post.urgency_score >= 100 || post.urgency_label === "urgent";
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="mb-3 flex items-start gap-3">
          <Avatar className="h-9 w-9">
            <AvatarImage src={post.author_avatar || "/avatar/av_1.png"} alt={post.author_email} />
            <AvatarFallback>{initialFromEmail(post.author_email)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="truncate font-semibold">{post.author_email}</span>
              <span className="text-[var(--muted)]">
                {isHydrated ? formatDistanceToNow(new Date(post.created_at), { addSuffix: true }) : "just now"}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap gap-2">
              <Badge variant={isUrgent ? "urgent" : "default"}>{post.urgency_label || "non-urgent"}</Badge>
              {post.extracted_request_type ? <Badge variant="accent">{post.extracted_request_type}</Badge> : null}
              {post.extracted_location ? <Badge>{post.extracted_location}</Badge> : null}
            </div>
          </div>
        </div>

        <Link href={`/post/${post.id}`} className="block rounded-xl p-1 transition hover:bg-[var(--panel)]/60">
          <p className={compact ? "text-sm leading-relaxed" : "text-[15px] leading-relaxed"}>{post.content}</p>
        </Link>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
          <Button variant="ghost" size="sm" onClick={() => onFeedback?.(post.id, "up")}>
            <ThumbsUp className="mr-1 h-4 w-4" />
            {post.upvotes || 0}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onFeedback?.(post.id, "down")}>
            <ThumbsDown className="mr-1 h-4 w-4" />
            {post.downvotes || 0}
          </Button>
          <Link href={`/post/${post.id}`} className="inline-flex items-center rounded-lg px-3 py-2 hover:bg-[var(--panel)]">
            <MessageSquare className="mr-1 h-4 w-4" />
            {post.comment_count || 0}
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
