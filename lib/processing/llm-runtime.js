import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  DEFAULT_MODEL_CANDIDATES,
  GEMINI_MODEL,
  GEMINI_TIMEOUT_MS,
} from "@/lib/processing/llm-config";
import { normalizeWhitespace } from "@/lib/processing/llm-normalize";

let cachedGeminiClient = null;
const cachedGeminiModels = new Map();

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

export function classifyGeminiError(error) {
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

export function shouldSwitchModel(classifiedError) {
  return (
    classifiedError === "model_not_found" ||
    classifiedError === "schema_validation" ||
    classifiedError === "timeout" ||
    classifiedError === "rate_limit"
  );
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

function getGeminiModelByName(modelName) {
  if (cachedGeminiModels.has(modelName)) {
    return cachedGeminiModels.get(modelName);
  }

  const client = getGeminiClient();
  const model = client.getGenerativeModel({ model: modelName });
  cachedGeminiModels.set(modelName, model);

  return model;
}

export function getModelCandidates() {
  const normalizedEnvModel = normalizeWhitespace(process.env.GEMINI_MODEL || GEMINI_MODEL);
  const candidates = [normalizedEnvModel, ...DEFAULT_MODEL_CANDIDATES].filter(Boolean);

  return [...new Set(candidates)];
}

export async function requestGeminiExtraction({ content, prompt, responseSchema, modelName }) {
  const model = getGeminiModelByName(modelName);

  const result = await withTimeout(
    model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 1.0,
        maxOutputTokens: 512,
        responseMimeType: "application/json",
        responseSchema,
      },
    }),
    GEMINI_TIMEOUT_MS
  );

  return result?.response?.text?.() || "";
}