import { SchemaType } from "@google/generative-ai";
import { ALLOWED_REQUEST_TYPES } from "@/lib/processing/llm-config";

export const EXTRACTION_RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  required: ["city", "location", "request_type", "is_informative"],
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
    is_informative: {
      type: SchemaType.BOOLEAN,
    },
    confidence: {
      type: SchemaType.NUMBER,
    },
  },
};

export function buildExtractionPrompt(content) {
  return [
    "You are a deterministic disaster-intelligence extractor.",
    "Extract entities and classify whether the post is informative for emergency response.",
    "Return ONLY valid JSON. No markdown, no prose, no additional keys.",
    "A post is informative only if it describes a real-world incident or actionable event.",
    "Mark as non-informative for metaphor, sarcasm, casual chatter, jokes, hype, or irrelevant text.",
    "Examples of non-informative usage: 'speaker was on fire', 'market is flooding', 'event was lit'.",
    "JSON schema:",
    "{",
    '  "city": "",',
    '  "location": "",',
    '  "request_type": "",',
    '  "is_informative": false,',
    '  "confidence": 0.0',
    "}",
    `request_type must be exactly one of: ${ALLOWED_REQUEST_TYPES.join(", ")}.`,
    "city and location must be non-empty strings.",
    "is_informative must be a boolean.",
    "confidence is optional but, if present, must be a number between 0 and 1.",
    "If uncertain about real-world incident relevance, set is_informative to false.",
    "INPUT_TEXT:",
    content,
  ].join("\n");
}