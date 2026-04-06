import { ThumbsDown, ThumbsUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function PostDetailSidebarCards({ post, urgencyLabel }) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Urgency Snapshot</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span>Label</span>
            <Badge variant={post.urgency_score >= 100 ? "urgent" : "default"}>{urgencyLabel}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span>Score</span>
            <Badge>{post.urgency_score || 0}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span>Request Type</span>
            <Badge variant="accent">{post.extracted_request_type || "General"}</Badge>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span>Location</span>
            <span className="text-right text-xs text-[var(--muted)]">{post.extracted_location || "Unknown"}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span>Contact</span>
            <span className="text-right text-xs text-[var(--muted)]">{post.phone_number || "Not provided"}</span>
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
    </>
  );
}
