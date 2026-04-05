"use client";

import { useEffect, useMemo, useState } from "react";
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

const PHONE_NUMBER_PATTERN = /^\+?[0-9][0-9()\-\s]{6,19}$/;

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

export function SosAlertButton({ onSubmitted, triggerClassName }) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [requiresManualLocation, setRequiresManualLocation] = useState(false);
  const [autoLocation, setAutoLocation] = useState("");
  const [manualLocation, setManualLocation] = useState("");
  const [requestType, setRequestType] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [latitude, setLatitude] = useState(undefined);
  const [longitude, setLongitude] = useState(undefined);
  const [city, setCity] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const normalizedPhone = phoneNumber.trim();
  const resolvedLocation = requiresManualLocation ? manualLocation.trim() : autoLocation.trim();
  const isPhoneValid = PHONE_NUMBER_PATTERN.test(normalizedPhone);

  const canSubmit = useMemo(() => {
    return Boolean(requestType && resolvedLocation && isPhoneValid && !isLocating);
  }, [requestType, resolvedLocation, isPhoneValid, isLocating]);

  async function resolveLocationFromDevice() {
    setIsLocating(true);
    setError("");
    setNotice("");
    setRequiresManualLocation(false);
    setAutoLocation("");
    setManualLocation("");
    setLatitude(undefined);
    setLongitude(undefined);
    setCity("");

    try {
      const position = await getCurrentPosition();
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;

      setLatitude(lat);
      setLongitude(lon);

      try {
        const reverse = await reverseGeocode(lat, lon);
        const locationLabel = reverse.location || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;

        setAutoLocation(locationLabel);
        setCity(reverse.city || "");
        setNotice("Location detected successfully.");
      } catch {
        const fallbackCoordinates = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
        setAutoLocation(fallbackCoordinates);
        setNotice("Could not resolve address. SOS will use coordinate-based location.");
      }
    } catch {
      setRequiresManualLocation(true);
      setNotice("Location access denied or unavailable. Please enter your location manually.");
    } finally {
      setIsLocating(false);
    }
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    resolveLocationFromDevice();
  }, [open]);

  async function handleConfirmSos() {
    setError("");
    const finalLocation = resolvedLocation;

    if (!finalLocation) {
      setError("Location is required for SOS submission.");
      return;
    }

    if (!requestType) {
      setError("Please select a request type.");
      return;
    }

    if (!isPhoneValid) {
      setError("Please enter a valid phone number.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/sos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          latitude,
          longitude,
          location: finalLocation,
          city: city || undefined,
          requestType,
          phoneNumber: normalizedPhone,
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
          setIsLocating(false);
          setRequiresManualLocation(false);
          setAutoLocation("");
          setManualLocation("");
          setRequestType("");
          setPhoneNumber("");
          setLatitude(undefined);
          setLongitude(undefined);
          setCity("");
          setError("");
          setNotice("");
        }
      }}
    >
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
                onChange={(event) => setManualLocation(event.target.value)}
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
                  <DropdownMenuItem key={option} onSelect={() => setRequestType(option)}>
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
              onChange={(event) => setPhoneNumber(event.target.value)}
              placeholder="Enter your phone number"
              maxLength={20}
            />
          </div>
        </div>

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

        <DialogFooter className="sticky bottom-0 z-10 bg-[var(--surface)] pt-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="button" variant="danger" onClick={handleConfirmSos} disabled={isSubmitting || !canSubmit}>
            {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Siren className="h-4 w-4" />}
            Send SOS
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
