import { AlertTriangle, ChevronDown, LoaderCircle, Siren } from "lucide-react";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { SOS_REQUEST_TYPE_OPTIONS } from "@/lib/constants";

export function SosFormDialog({
  canSubmit,
  error,
  isLocating,
  isSubmitting,
  manualLocation,
  notice,
  onCancel,
  onManualLocationChange,
  onOpenChange,
  onPhoneNumberChange,
  onRequestTypeChange,
  onSubmit,
  open,
  phoneNumber,
  requestType,
  requiresManualLocation,
  resolvedLocation,
  triggerClassName,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="danger"
          className={cn(
            "rounded-full px-5 text-white shadow-[0_0_0_2px_rgba(255,255,255,0.08)] animate-pulse lg:hidden",
            triggerClassName
          )}
          aria-label="Send SOS emergency alert"
        >
          <Siren className="mr-1 h-4 w-4" />
          SOS
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[94vw] max-h-[90vh] overflow-y-auto p-4 sm:max-w-2xl sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[var(--danger)]">
            <AlertTriangle className="h-5 w-5" />
            Confirm Emergency SOS
          </DialogTitle>
          <DialogDescription>
            Confirm emergency SOS details. Location, request type, and phone number are required before sending.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)]/50 p-3 text-sm">
            {isLocating ? (
              <span className="text-[var(--muted)]">Detecting your location...</span>
            ) : resolvedLocation ? (
              <span className="text-[var(--text)]">Detected location: {resolvedLocation}</span>
            ) : (
              <span className="text-[var(--muted)]">Location not detected yet.</span>
            )}
          </div>

          {requiresManualLocation ? (
            <div className="space-y-2">
              <Label htmlFor="sos-location">Enter Location</Label>
              <Input
                id="sos-location"
                value={manualLocation}
                onChange={(event) => onManualLocationChange(event.target.value)}
                placeholder="Enter your current area, city, and landmarks"
                maxLength={500}
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="sos-request-type">Request Type</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full justify-between rounded-xl border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
                >
                  <span className={requestType ? "text-[var(--text)]" : "text-[var(--muted)]"}>
                    {requestType || "Select request type"}
                  </span>
                  <ChevronDown className="h-4 w-4 text-[var(--muted)]" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="w-[var(--radix-dropdown-menu-trigger-width)] border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
              >
                {SOS_REQUEST_TYPE_OPTIONS.map((option) => (
                  <DropdownMenuItem key={option} onSelect={() => onRequestTypeChange(option)}>
                    {option}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sos-phone">Phone Number</Label>
            <Input
              id="sos-phone"
              type="tel"
              value={phoneNumber}
              onChange={(event) => onPhoneNumberChange(event.target.value)}
              placeholder="Enter your phone number"
              maxLength={20}
            />
          </div>
        </div>

        {notice ? (
          <p className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm text-amber-300">{notice}</p>
        ) : null}

        {error ? (
          <p className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">{error}</p>
        ) : null}

        <DialogFooter className="sticky bottom-0 z-10 bg-[var(--surface)] pt-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="button" variant="danger" onClick={onSubmit} disabled={isSubmitting || !canSubmit}>
            {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Siren className="h-4 w-4" />}
            Send SOS
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
