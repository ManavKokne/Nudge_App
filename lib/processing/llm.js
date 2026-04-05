import { GoogleGenerativeAI } from "@google/generative-ai";
import { REQUEST_TYPE_OPTIONS } from "@/lib/constants";
import { extractCityFromLocationString } from "@/lib/utils";

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";
const GEMINI_TIMEOUT_MS = Number.parseInt(process.env.GEMINI_TIMEOUT_MS || "", 10) || 8000;
const MAX_EXTRACTION_ATTEMPTS = 2;
const FALLBACK_CITY = "Unknown City";
const FALLBACK_LOCATION = "Unknown Location";
const FALLBACK_REQUEST_TYPE = "General";

const ALLOWED_REQUEST_TYPES = REQUEST_TYPE_OPTIONS.includes(FALLBACK_REQUEST_TYPE)
  ? REQUEST_TYPE_OPTIONS
  : [...REQUEST_TYPE_OPTIONS, FALLBACK_REQUEST_TYPE];

const REQUEST_TYPE_LOOKUP = {
  medical: "Medical",
  rescue: "Rescue",
  food: "Food",
  shelter: "Shelter",
  emergency: "Emergency",
  general: "General",
  "food & supplies": "Food",
  "food and supplies": "Food",
  humanitarian: "Rescue",
};

const FALLBACK_REQUEST_RULES = [
  {
    type: "Medical",
    pattern: /\b(medical|medicine|doctor|nurse|hospital|ambulance|first aid)\b/i,
  },
  {
    type: "Rescue",
    pattern: /\b(rescue|evacuation|trapped|save|boat|team)\b/i,
  },
  {
    type: "Food",
    pattern: /\b(food|water|ration|supplies|packets|hunger|meal|drinking water)\b/i,
  },
  {
    type: "Shelter",
    pattern: /\b(shelter|camp|accommodation|housing|tent|safe place|relief camp)\b/i,
  },
  {
    type: "Emergency",
    pattern: /\b(sos|emergency|critical|urgent|immediate assistance)\b/i,
  },
];

let cachedGeminiModel = null;

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function toTitleCase(value) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/\b[a-z]/g, (match) => match.toUpperCase());
}

function normalizeCity(value) {
  const normalized = normalizeWhitespace(value);

  if (!normalized) {
    return FALLBACK_CITY;
  }

  if (/\b(unknown|unavailable|n\/a|na|none)\b/i.test(normalized)) {
    return FALLBACK_CITY;
  }

  return toTitleCase(normalized);
}

function normalizeLocation(value) {
  const normalized = normalizeWhitespace(value).replace(/[.,;:!?]+$/, "");

  if (!normalized) {
    return FALLBACK_LOCATION;
  }

  if (/\b(unknown|unavailable|n\/a|na|none)\b/i.test(normalized)) {
    return FALLBACK_LOCATION;
  }

  return normalized;
}

function normalizeRequestType(value) {
  const compact = normalizeWhitespace(value);

  if (!compact) {
    return FALLBACK_REQUEST_TYPE;
  }

  const normalized = REQUEST_TYPE_LOOKUP[compact.toLowerCase()];

  if (normalized && ALLOWED_REQUEST_TYPES.includes(normalized)) {
    return normalized;
  }

  return FALLBACK_REQUEST_TYPE;
}

function buildPrompt(content) {
  return [
    "You are a deterministic JSON extraction engine.",
    "Extract entities from the INPUT_TEXT and return ONLY valid JSON.",
    "Do not include markdown, explanations, code fences, or extra keys.",
    "JSON schema:",
    "{",
    '  "city": "",',
    '  "location": "",',
    '  "request_type": ""',
    "}",
    `request_type must be exactly one of: ${ALLOWED_REQUEST_TYPES.join(", ")}.`,
    "All fields must be non-empty strings.",
    "If uncertain, still return best-effort values and set request_type to General.",
    "INPUT_TEXT:",
    content,
  ].join("\n");
}

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
    Object.prototype.hasOwnProperty.call(parsed, "request_type");

  if (!hasAllRequiredFields) {
    return null;
  }

  const rawCity = parsed.city;
  const rawLocation = parsed.location;
  const rawRequestType = parsed.request_type;

  const hasValidPrimitiveTypes =
    typeof rawCity === "string" && typeof rawLocation === "string" && typeof rawRequestType === "string";

  if (!hasValidPrimitiveTypes) {
    return null;
  }

  const city = normalizeCity(rawCity);
  const location = normalizeLocation(rawLocation);
  const requestType = normalizeRequestType(rawRequestType);

  if (city === FALLBACK_CITY || location === FALLBACK_LOCATION) {
    return null;
  }

  return {
    city,
    location,
    requestType,
  };
}

function inferFallbackRequestType(content) {
  for (const rule of FALLBACK_REQUEST_RULES) {
    if (rule.pattern.test(content)) {
      return rule.type;
    }
  }

  return FALLBACK_REQUEST_TYPE;
}

function inferFallbackLocation(content) {
  const normalized = normalizeWhitespace(content);
  const taggedLocationMatch = normalized.match(
    /\b(?:at|in|near)\s+([A-Za-z][A-Za-z0-9-]*(?:\s+[A-Za-z][A-Za-z0-9,.-]*){0,8})/
  );

  if (taggedLocationMatch?.[1]) {
    const cleaned = normalizeLocation(taggedLocationMatch[1]);

    if (cleaned !== FALLBACK_LOCATION) {
      return cleaned;
    }
  }

  return FALLBACK_LOCATION;
}

function createFallbackExtraction(content) {
  const normalizedContent = normalizeWhitespace(content);
  const location = inferFallbackLocation(normalizedContent);
  const inferredCity = normalizeCity(extractCityFromLocationString(location));

  return {
    city: inferredCity,
    location,
    requestType: inferFallbackRequestType(normalizedContent),
    alertContent: normalizedContent,
    source: "fallback",
  };
}

function withTimeout(promise, timeoutMs) {
  if (!timeoutMs || timeoutMs <= 0) {
    return promise;
  }

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Gemini extraction timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

function classifyGeminiError(error) {
  const message = String(error?.message || error || "Unknown Gemini error");

  if (/429|rate\s*limit/i.test(message)) {
    return "rate_limit";
  }

  if (/timeout|timed out|deadline/i.test(message)) {
    return "timeout";
  }

  return "request_failed";
}

function getGeminiModel() {
  if (cachedGeminiModel) {
    return cachedGeminiModel;
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const client = new GoogleGenerativeAI(apiKey);

  cachedGeminiModel = client.getGenerativeModel({
    model: GEMINI_MODEL,
  });

  return cachedGeminiModel;
}

async function requestGeminiExtraction(content) {
  const model = getGeminiModel();
  const prompt = buildPrompt(content);

  const result = await withTimeout(
    model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0,
        topK: 1,
        topP: 0.1,
        maxOutputTokens: 256,
        responseMimeType: "application/json",
      },
    }),
    GEMINI_TIMEOUT_MS
  );

  return result?.response?.text?.() || "";
}

export async function extractStructuredEntitiesWithLlm(content) {
  const normalizedContent = normalizeWhitespace(content);

  if (!normalizedContent) {
    return {
      city: FALLBACK_CITY,
      location: FALLBACK_LOCATION,
      requestType: FALLBACK_REQUEST_TYPE,
      alertContent: "",
      source: "fallback",
    };
  }

  let lastError = null;

  for (let attempt = 1; attempt <= MAX_EXTRACTION_ATTEMPTS; attempt += 1) {
    try {
      const rawResponse = await requestGeminiExtraction(normalizedContent);
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

      console.warn(`[llm-extraction] Gemini ${classified} on attempt ${attempt}:`, error?.message || error);
    }
  }

  console.warn(
    "[llm-extraction] Falling back to minimal extraction after Gemini retries failed:",
    lastError?.message || "Unknown error"
  );

  return createFallbackExtraction(normalizedContent);
}
