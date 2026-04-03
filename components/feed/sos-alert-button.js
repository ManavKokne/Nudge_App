"use client";

import { useState } from "react";
import { AlertTriangle, LoaderCircle, Siren } from "lucide-react";
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

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation is not supported by this browser"));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    });
  });
}

async function reverseGeocode(latitude, longitude) {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Unable to reverse geocode current coordinates");
  }

  const payload = await response.json();
  const city =
    payload?.address?.city ||
    payload?.address?.town ||
    payload?.address?.village ||
    payload?.address?.municipality ||
    payload?.address?.state_district ||
    payload?.address?.county ||
    null;

  return {
    location: payload?.display_name || null,
    city,
  };
}

export function SosAlertButton({ onSubmitted }) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function handleConfirmSos() {
    setError("");
    setNotice("");
    setIsSubmitting(true);

    let latitude;
    let longitude;
    let location;
    let city;

    try {
      const position = await getCurrentPosition();
      latitude = position.coords.latitude;
      longitude = position.coords.longitude;

      try {
        const reverse = await reverseGeocode(latitude, longitude);
        location = reverse.location;
        city = reverse.city;
      } catch {
        location = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
        setNotice("Could not resolve address. Sending SOS with coordinate-based location.");
      }
    } catch {
      location = "location unavailable";
      setNotice("Geolocation permission denied/unavailable. Sending SOS with fallback location.");
    }

    try {
      const response = await fetch("/api/sos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          latitude,
          longitude,
          location,
          city,
        }),
      });

      const payload = await response.json();

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "Unable to submit SOS alert");
      }

      onSubmitted?.(payload.data);
      setOpen(false);
      setNotice("");
    } catch (submitError) {
      setError(submitError.message || "Unable to submit SOS alert");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);

        if (!nextOpen) {
          setError("");
          setNotice("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="danger"
          className="rounded-full px-4 text-white shadow-[0_0_0_2px_rgba(255,255,255,0.08)] animate-pulse lg:hidden"
          aria-label="Send SOS emergency alert"
        >
          <Siren className="mr-1 h-4 w-4" />
          SOS
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[var(--danger)]">
            <AlertTriangle className="h-5 w-5" />
            Confirm Emergency SOS
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to send an emergency SOS alert? This will immediately create a high-priority alert.
          </DialogDescription>
        </DialogHeader>

        {notice ? (
          <p className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm text-amber-300">
            {notice}
          </p>
        ) : null}

        {error ? (
          <p className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="button" variant="danger" onClick={handleConfirmSos} disabled={isSubmitting}>
            {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Siren className="h-4 w-4" />}
            Send SOS
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
