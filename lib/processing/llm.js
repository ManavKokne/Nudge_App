import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { REQUEST_TYPE_OPTIONS } from "@/lib/constants";

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3-flash-preview";
const GEMINI_TIMEOUT_MS = Number.parseInt(process.env.GEMINI_TIMEOUT_MS || "", 10) || 60000;
const MAX_EXTRACTION_ATTEMPTS = 2;
const FALLBACK_CITY = "Unknown City";
const FALLBACK_LOCATION = "Unknown Location";
const FALLBACK_REQUEST_TYPE = "General";
const DEFAULT_MODEL_CANDIDATES = [
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite-preview",
  "gemini-3.1-pro-preview",
  "gemini-1.5-flash",
];

const ALLOWED_REQUEST_TYPES = REQUEST_TYPE_OPTIONS.includes(FALLBACK_REQUEST_TYPE)
  ? REQUEST_TYPE_OPTIONS
  : [...REQUEST_TYPE_OPTIONS, FALLBACK_REQUEST_TYPE];

const EXTRACTION_RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  required: ["city", "location", "request_type"],
  properties: {
    city: {
      type: SchemaType.STRING,
    },
    location: {
      type: SchemaType.STRING,
    },
    request_type: {
      type: SchemaType.STRING,
      format: "enum",
      enum: ALLOWED_REQUEST_TYPES,
    },
  },
};

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

let cachedGeminiClient = null;
const cachedGeminiModels = new Map();

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

  return {
    city,
    location,
    requestType,
  };
}

function createFallbackExtraction(content) {
  const normalizedContent = normalizeWhitespace(content);

  return {
    city: FALLBACK_CITY,
    location: FALLBACK_LOCATION,
    requestType: FALLBACK_REQUEST_TYPE,
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

  if (/\b404\b|is not found|not supported for generateContent/i.test(message)) {
    return "model_not_found";
  }

  if (/429|rate\s*limit/i.test(message)) {
    return "rate_limit";
  }

  if (/schema validation|failed schema validation|invalid json/i.test(message)) {
    return "schema_validation";
  }

  if (/timeout|timed out|deadline/i.test(message)) {
    return "timeout";
  }

  return "request_failed";
}

function getGeminiClient() {
  if (cachedGeminiClient) {
    return cachedGeminiClient;
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  cachedGeminiClient = new GoogleGenerativeAI(apiKey);

  return cachedGeminiClient;
}

function getModelCandidates() {
  const normalizedEnvModel = normalizeWhitespace(process.env.GEMINI_MODEL || GEMINI_MODEL);
  const candidates = [normalizedEnvModel, ...DEFAULT_MODEL_CANDIDATES].filter(Boolean);

  return [...new Set(candidates)];
}

function getGeminiModelByName(modelName) {
  if (cachedGeminiModels.has(modelName)) {
    return cachedGeminiModels.get(modelName);
  }

  const client = getGeminiClient();
  const model = client.getGenerativeModel({
    model: modelName,
  });

  cachedGeminiModels.set(modelName, model);

  return model;
}

async function requestGeminiExtraction(content, modelName) {
  const model = getGeminiModelByName(modelName);
  const prompt = buildPrompt(content);

  const result = await withTimeout(
    model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 1.0,
        maxOutputTokens: 512,
        responseMimeType: "application/json",
        responseSchema: EXTRACTION_RESPONSE_SCHEMA,
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
  const candidates = getModelCandidates();

  for (const modelName of candidates) {
    for (let attempt = 1; attempt <= MAX_EXTRACTION_ATTEMPTS; attempt += 1) {
      try {
        const rawResponse = await requestGeminiExtraction(normalizedContent, modelName);
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

        if (
          classified === "model_not_found" ||
          classified === "schema_validation" ||
          classified === "timeout" ||
          classified === "rate_limit"
        ) {
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
