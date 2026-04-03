"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Check, LoaderCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const FALLBACK_AVATAR_COUNT = 8;

export function EditProfileDialog({ open, onOpenChange, user, onUpdated }) {
  const [email, setEmail] = useState(user?.email || "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || "/avatar/av_1.png");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const avatarOptions = useMemo(
    () =>
      Array.from({ length: FALLBACK_AVATAR_COUNT }, (_, index) => `/avatar/av_${index + 1}.png`),
    []
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    setEmail(user?.email || "");
    setAvatarUrl(user?.avatarUrl || "/avatar/av_1.png");
    setError("");
  }, [open, user]);

  async function handleSave() {
    setError("");
    setIsSaving(true);

    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, avatarUrl }),
      });

      const payload = await response.json();

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "Unable to update profile");
      }

      onUpdated?.(payload.data.user);
      onOpenChange(false);
    } catch (saveError) {
      setError(saveError.message || "Unable to update profile");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription>
            Update your account details and choose an avatar from the available set.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Label htmlFor="edit-email">Email</Label>
          <Input
            id="edit-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
        </div>

        <div className="space-y-3">
          <Label>Edit Avatar</Label>
          <div className="grid grid-cols-4 gap-3">
            {avatarOptions.map((option) => {
              const isSelected = avatarUrl === option;

              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setAvatarUrl(option)}
                  className={cn(
                    "relative rounded-xl border p-1 transition",
                    isSelected
                      ? "border-[var(--accent)] bg-[var(--accent)]/10"
                      : "border-[var(--border)] hover:border-[var(--accent)]/50"
                  )}
                >
                  <Image src={option} alt={option} width={72} height={72} className="h-16 w-16 rounded-lg" />
                  {isSelected ? (
                    <span className="pointer-events-none absolute right-1 top-1 z-20 rounded-full bg-[var(--accent)] p-1 text-white shadow-md">
                      <Check className="h-3 w-3" />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSaving}>
            {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
