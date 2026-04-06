"use client";

import { useMemo, useState } from "react";
import { SosFormDialog } from "@/components/feed/sos/sos-form-dialog";
import { useSosGeolocation } from "@/components/feed/sos/use-sos-geolocation";
import { useSosSubmit } from "@/components/feed/sos/use-sos-submit";

const PHONE_NUMBER_PATTERN = /^\+?[0-9][0-9()\-\s]{6,19}$/;

export function SosAlertButton({ onSubmitted, triggerClassName }) {
  const [open, setOpen] = useState(false);
  const [requestType, setRequestType] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [validationError, setValidationError] = useState("");

  const {
    city,
    isLocating,
    latitude,
    longitude,
    manualLocation,
    notice,
    requiresManualLocation,
    resolvedLocation,
    resetLocationState,
    setManualLocation,
    setNotice,
  } = useSosGeolocation(open);

  const { clearSubmitError, isSubmitting, submitError, submitSos } = useSosSubmit(onSubmitted);

  const normalizedPhone = phoneNumber.trim();
  const isPhoneValid = PHONE_NUMBER_PATTERN.test(normalizedPhone);
  const error = validationError || submitError;

  const canSubmit = useMemo(() => {
    return Boolean(requestType && resolvedLocation && isPhoneValid && !isLocating);
  }, [isLocating, isPhoneValid, requestType, resolvedLocation]);

  function resetFormState() {
    setRequestType("");
    setPhoneNumber("");
    setValidationError("");
    clearSubmitError();
    resetLocationState();
  }

  async function handleConfirmSos() {
    setValidationError("");
    clearSubmitError();

    if (!resolvedLocation) {
      setValidationError("Location is required for SOS submission.");
      return;
    }

    if (!requestType) {
      setValidationError("Please select a request type.");
      return;
    }

    if (!isPhoneValid) {
      setValidationError("Please enter a valid phone number.");
      return;
    }

    try {
      await submitSos({
        latitude,
        longitude,
        location: resolvedLocation,
        city,
        requestType,
        phoneNumber: normalizedPhone,
      });

      setOpen(false);
      setNotice("");
    } catch {
      // Error state is handled by useSosSubmit.
    }
  }

  return (
    <SosFormDialog
      canSubmit={canSubmit}
      error={error}
      isLocating={isLocating}
      isSubmitting={isSubmitting}
      manualLocation={manualLocation}
      notice={notice}
      onCancel={() => setOpen(false)}
      onManualLocationChange={setManualLocation}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);

        if (!nextOpen) {
          resetFormState();
        }
      }}
      onPhoneNumberChange={setPhoneNumber}
      onRequestTypeChange={setRequestType}
      onSubmit={handleConfirmSos}
      open={open}
      phoneNumber={phoneNumber}
      requestType={requestType}
      requiresManualLocation={requiresManualLocation}
      resolvedLocation={resolvedLocation}
      triggerClassName={triggerClassName}
    />
  );
}
