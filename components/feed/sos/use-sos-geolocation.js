import { useCallback, useEffect, useMemo, useState } from "react";

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

export function useSosGeolocation(open) {
  const [isLocating, setIsLocating] = useState(false);
  const [requiresManualLocation, setRequiresManualLocation] = useState(false);
  const [autoLocation, setAutoLocation] = useState("");
  const [manualLocation, setManualLocation] = useState("");
  const [latitude, setLatitude] = useState(undefined);
  const [longitude, setLongitude] = useState(undefined);
  const [city, setCity] = useState("");
  const [notice, setNotice] = useState("");

  const resolvedLocation = useMemo(() => {
    return requiresManualLocation ? manualLocation.trim() : autoLocation.trim();
  }, [autoLocation, manualLocation, requiresManualLocation]);

  const resetLocationState = useCallback(() => {
    setIsLocating(false);
    setRequiresManualLocation(false);
    setAutoLocation("");
    setManualLocation("");
    setLatitude(undefined);
    setLongitude(undefined);
    setCity("");
    setNotice("");
  }, []);

  const resolveLocationFromDevice = useCallback(async () => {
    setIsLocating(true);
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
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    resolveLocationFromDevice();
  }, [open, resolveLocationFromDevice]);

  return {
    autoLocation,
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
  };
}
