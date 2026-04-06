import {
  FALLBACK_CITY,
  FALLBACK_LOCATION,
  FALLBACK_REQUEST_TYPE,
  MAX_EXTRACTION_ATTEMPTS,
} from "@/lib/processing/llm-config";
import {
  normalizeCity,
  normalizeConfidence,
  normalizeLocation,
  normalizeRequestType,
  normalizeWhitespace,
} from "@/lib/processing/llm-normalize";
import { EXTRACTION_RESPONSE_SCHEMA, buildExtractionPrompt } from "@/lib/processing/llm-prompt";
import {
  classifyGeminiError,
  getModelCandidates,
  requestGeminiExtraction,
  shouldSwitchModel,
} from "@/lib/processing/llm-runtime";

function parseJsonObjectFromText(rawText) {
  const text = String(rawText || "").trim();

  if (!text) {
    return null;
  }

  const stripped = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  const candidates = [stripped];
  const firstBrace = stripped.indexOf("{");
  const lastBrace = stripped.lastIndexOf("}");

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(stripped.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);

      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // Ignore parse failures and try next candidate.
    }
  }

  return null;
}

function validateAndNormalizeParsedPayload(parsed) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  const hasAllRequiredFields =
    Object.prototype.hasOwnProperty.call(parsed, "city") &&
    Object.prototype.hasOwnProperty.call(parsed, "location") &&
    Object.prototype.hasOwnProperty.call(parsed, "request_type") &&
    Object.prototype.hasOwnProperty.call(parsed, "is_informative");

  if (!hasAllRequiredFields) {
    return null;
  }

  const rawCity = parsed.city;
  const rawLocation = parsed.location;
  const rawRequestType = parsed.request_type;
  const rawIsInformative = parsed.is_informative;
  const rawConfidence = parsed.confidence;

  const hasValidPrimitiveTypes =
    typeof rawCity === "string" &&
    typeof rawLocation === "string" &&
    typeof rawRequestType === "string" &&
    typeof rawIsInformative === "boolean";

  if (!hasValidPrimitiveTypes) {
    return null;
  }

  const city = normalizeCity(rawCity);
  const location = normalizeLocation(rawLocation);
  const requestType = normalizeRequestType(rawRequestType);
  const isInformative = rawIsInformative === true;
  const confidence = normalizeConfidence(rawConfidence);

  return {
    city,
    location,
    requestType,
    isInformative,
    confidence,
  };
}

function createFallbackExtraction(content) {
  const normalizedContent = normalizeWhitespace(content);

  return {
    city: FALLBACK_CITY,
    location: FALLBACK_LOCATION,
    requestType: FALLBACK_REQUEST_TYPE,
    isInformative: false,
    confidence: 0,
    alertContent: normalizedContent,
    source: "fallback",
  };
}

export async function extractStructuredEntitiesWithLlm(content) {
  const normalizedContent = normalizeWhitespace(content);

  if (!normalizedContent) {
    return {
      city: FALLBACK_CITY,
      location: FALLBACK_LOCATION,
      requestType: FALLBACK_REQUEST_TYPE,
      isInformative: false,
      confidence: 0,
      alertContent: "",
      source: "fallback",
    };
  }

  let lastError = null;
  const candidates = getModelCandidates();

  for (const modelName of candidates) {
    for (let attempt = 1; attempt <= MAX_EXTRACTION_ATTEMPTS; attempt += 1) {
      try {
        const rawResponse = await requestGeminiExtraction({
          content: normalizedContent,
          prompt: buildExtractionPrompt(normalizedContent),
          responseSchema: EXTRACTION_RESPONSE_SCHEMA,
          modelName,
        });
        const parsed = parseJsonObjectFromText(rawResponse);
        const normalized = validateAndNormalizeParsedPayload(parsed);

        if (!normalized) {
          throw new Error("Gemini response failed schema validation");
        }

        return {
          ...normalized,
          alertContent: normalizedContent,
          source: "gemini",
        };
      } catch (error) {
        lastError = error;
        const classified = classifyGeminiError(error);

        console.warn(
          `[llm-extraction] Gemini ${classified} on model ${modelName} attempt ${attempt}:`,
          error?.message || error
        );

        if (shouldSwitchModel(classified)) {
          // Move to next candidate model immediately when current model is unsuitable or unstable.
          break;
        }
      }
    }
  }

  console.warn(
    "[llm-extraction] Falling back to minimal extraction after Gemini retries failed:",
    lastError?.message || "Unknown error"
  );

  return createFallbackExtraction(normalizedContent);
}
