import { useState } from "react";

export function useSosSubmit(onSubmitted) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  function clearSubmitError() {
    setSubmitError("");
  }

  async function submitSos({ latitude, longitude, location, city, requestType, phoneNumber }) {
    setSubmitError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/sos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          latitude,
          longitude,
          location,
          city: city || undefined,
          requestType,
          phoneNumber,
        }),
      });

      const payload = await response.json();

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "Unable to submit SOS alert");
      }

      onSubmitted?.(payload.data);
      return payload.data;
    } catch (error) {
      const message = error?.message || "Unable to submit SOS alert";
      setSubmitError(message);
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }

  return {
    clearSubmitError,
    isSubmitting,
    submitError,
    submitSos,
  };
}
