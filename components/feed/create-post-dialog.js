"use client";

import { useState } from "react";
import { ImagePlus, LoaderCircle, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function CreatePostDialog({ onCreated, triggerClassName }) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleCreate() {
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content }),
      });

      const payload = await response.json();

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "Unable to create post");
      }

      onCreated?.(payload.data.post, payload.data.processing, payload.data.processingError);
      setContent("");
      setOpen(false);
    } catch (createError) {
      setError(createError.message || "Unable to create post");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className={cn("rounded-full px-5", triggerClassName)}>
          <Plus className="mr-1 h-4 w-4" />
          Create Post
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Post</DialogTitle>
          <DialogDescription>
            Share a text update for community visibility and disaster intelligence ingestion.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="post-content">Content</Label>
          <Textarea
            id="post-content"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Need immediate assistance in Bengaluru..."
            maxLength={3000}
          />
          <p className="text-right text-xs text-[var(--muted)]">{content.length}/3000</p>
        </div>

        <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--panel)]/60 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
            <ImagePlus className="h-4 w-4" />
            Media Upload (Disabled)
          </div>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Media support will be added in future iterations.
          </p>
        </div>

        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isSubmitting || !content.trim()}>
            {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            Publish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
