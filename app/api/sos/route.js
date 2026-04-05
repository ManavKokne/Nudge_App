import { z } from "zod";
import { requireApiUser } from "@/lib/auth/guards";
import { PROCESSING_MODE, SOS_REQUEST_TYPE_OPTIONS } from "@/lib/constants";
import { insertAlertFromPost } from "@/lib/db/disaster-queries";
import {
  createPost,
  getLatestSosPostByUser,
  getPostById,
  updatePostProcessingMeta,
} from "@/lib/db/social-queries";
import { fail, ok } from "@/lib/http/response";
import { deriveNameFromEmail, extractCityFromLocationString, formatApiError } from "@/lib/utils";
import { phoneNumberSchema } from "@/lib/validation/content";

const SOS_COOLDOWN_MIN_SECONDS = 120;
const SOS_COOLDOWN_MAX_SECONDS = 300;
const SOS_URGENCY_SCORE = 100;
const SOS_URGENCY_LABEL = "urgent";

function resolveSosCooldownSeconds() {
  const rawValue = Number.parseInt(process.env.SOS_COOLDOWN_SECONDS || "", 10);

  if (Number.isNaN(rawValue)) {
    return 180;
  }

  return Math.min(SOS_COOLDOWN_MAX_SECONDS, Math.max(SOS_COOLDOWN_MIN_SECONDS, rawValue));
}

const SOS_COOLDOWN_SECONDS = resolveSosCooldownSeconds();

const sosPayloadSchema = z
  .object({
    latitude: z.coerce.number().finite().min(-90).max(90).optional(),
    longitude: z.coerce.number().finite().min(-180).max(180).optional(),
    location: z
      .string()
      .trim()
      .min(2, "Location is required")
      .max(500, "Location is too long")
      .refine((value) => !/location unavailable/i.test(value), "Please provide a valid location"),
    city: z.string().trim().max(120).optional(),
    requestType: z.enum(SOS_REQUEST_TYPE_OPTIONS),
    phoneNumber: phoneNumberSchema,
  })
  .refine(
    (value) =>
      (value.latitude === undefined && value.longitude === undefined) ||
      (value.latitude !== undefined && value.longitude !== undefined),
    {
      message: "Latitude and longitude must be provided together",
      path: ["latitude"],
    }
  );

function formatCoordinate(value) {
  return Number(value).toFixed(5);
}

function resolveLocationLabel({ location, latitude, longitude }) {
  if (location?.trim()) {
    return location.trim();
  }

  if (latitude !== undefined && longitude !== undefined) {
    return `${formatCoordinate(latitude)}, ${formatCoordinate(longitude)}`;
  }

  return "";
}

export async function POST(request) {
  try {
    const user = await requireApiUser();
    const body = await request.json();
    const parsed = sosPayloadSchema.safeParse(body);

    if (!parsed.success) {
      return fail("Invalid SOS payload", 422, parsed.error.flatten());
    }

    const latestSos = await getLatestSosPostByUser(user.id);

    if (latestSos) {
      const elapsedSeconds = Math.floor((Date.now() - new Date(latestSos.created_at).getTime()) / 1000);
      const retryAfterSeconds = SOS_COOLDOWN_SECONDS - elapsedSeconds;

      if (retryAfterSeconds > 0) {
        return fail("SOS cooldown active. Please wait before sending another alert.", 429, {
          retryAfterSeconds,
          cooldownSeconds: SOS_COOLDOWN_SECONDS,
        });
      }
    }

    const processingMode = (process.env.PROCESSING_MODE || PROCESSING_MODE || "mock").toLowerCase() === "ml" ? "ml" : "mock";
    const requestType = parsed.data.requestType;
    const phoneNumber = parsed.data.phoneNumber;

    const displayName = user.name || deriveNameFromEmail(user.email);
    const locationLabel = resolveLocationLabel(parsed.data);
    const coordinatesLabel =
      parsed.data.latitude !== undefined && parsed.data.longitude !== undefined
        ? `${formatCoordinate(parsed.data.latitude)}, ${formatCoordinate(parsed.data.longitude)}`
        : "unavailable";

    const city = parsed.data.city?.trim() || extractCityFromLocationString(locationLabel);

    const content = `SOS Alert: ${displayName} requires immediate assistance at ${locationLabel}. Request: ${requestType}. Contact: ${phoneNumber}. Coordinates: ${coordinatesLabel}.`;

    const createdPost = await createPost({
      userId: user.id,
      content,
      processingMode,
      phoneNumber,
    });

    await updatePostProcessingMeta(createdPost.id, {
      location: locationLabel,
      city,
      requestType,
      urgencyScore: SOS_URGENCY_SCORE,
      urgencyLabel: SOS_URGENCY_LABEL,
    });

    let insertedAlert = null;

    if (processingMode === "mock") {
      insertedAlert = await insertAlertFromPost({
        content,
        location: locationLabel,
        city,
        requestType,
        dashboardUrgency: SOS_URGENCY_LABEL,
        urgencyScore: SOS_URGENCY_SCORE,
        urgencyLabel: SOS_URGENCY_LABEL,
        sourcePostId: createdPost.id,
      });
    }

    const hydratedPost = await getPostById(createdPost.id);

    return ok(
      {
        post: hydratedPost,
        processing: {
          mode: processingMode,
          location: locationLabel,
          city,
          requestType,
          phoneNumber,
          urgencyScore: SOS_URGENCY_SCORE,
          urgencyLabel: SOS_URGENCY_LABEL,
          insertedAlert,
        },
        message:
          processingMode === "mock"
            ? "SOS alert sent successfully and pushed to the emergency dashboard."
            : "SOS alert submitted successfully for ML pipeline processing.",
      },
      201
    );
  } catch (error) {
    const status = error?.status || 500;
    return fail(formatApiError(error, "Unable to send SOS alert"), status);
  }
}
