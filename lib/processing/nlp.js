import nlp from "compromise";
import { extractCityFromLocationString } from "@/lib/utils";

const REQUEST_TYPE_RULES = [
  {
    type: "Medical",
    pattern: /\b(medical|medicine|doctor|nurse|hospital|ambulance|first aid)\b/i,
  },
  {
    type: "Food & Supplies",
    pattern: /\b(food|water|ration|supplies|packets|hunger|meal|drinking water)\b/i,
  },
  {
    type: "Shelter",
    pattern: /\b(shelter|camp|accommodation|housing|tent|safe place|relief camp)\b/i,
  },
  {
    type: "Humanitarian",
    pattern: /\b(volunteer|rescue|evacuation|humanitarian|support team|aid team)\b/i,
  },
];

const LOCATION_NOISE_PATTERN =
  /\b(need|needs|required|require|reported|trapped|urgent|immediate|assistance|support|volunteer|rescue|help|families|people|medical|food|shelter|crisis|flood|earthquake|cyclone|fire)\b/i;

function cleanText(value) {
  return value.replace(/\s+/g, " ").trim().replace(/[.,;:!?]+$/, "");
}

function inferRequestType(content) {
  for (const rule of REQUEST_TYPE_RULES) {
    if (rule.pattern.test(content)) {
      return rule.type;
    }
  }

  return "General";
}

function getSentences(content) {
  return cleanText(content)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => cleanText(sentence))
    .filter(Boolean);
}

function isLikelyLocationOnlySentence(sentence) {
  if (!sentence.includes(",")) {
    return false;
  }

  if (sentence.length > 100) {
    return false;
  }

  return !LOCATION_NOISE_PATTERN.test(sentence);
}

function isValidLocationPart(candidate) {
  if (!candidate) {
    return false;
  }

  if (LOCATION_NOISE_PATTERN.test(candidate)) {
    return false;
  }

  return candidate.length > 1;
}

function extractContextLocations(normalized) {
  const nearLocations = [];
  const inAtLocations = [];

  const nearPattern = /\bnear\s+([A-Za-z][A-Za-z0-9-]*(?:\s+[A-Za-z][A-Za-z0-9-]*){0,4})/gi;
  const inAtPattern = /\b(?:in|at)\s+([A-Za-z][A-Za-z0-9-]*(?:\s+[A-Za-z][A-Za-z0-9-]*){0,4})/gi;

  let match;

  while ((match = nearPattern.exec(normalized)) !== null) {
    nearLocations.push(cleanText(match[1]));
  }

  while ((match = inAtPattern.exec(normalized)) !== null) {
    inAtLocations.push(cleanText(match[1]));
  }

  return {
    nearLocations,
    inAtLocations,
  };
}

function inferLocation(content, sentenceCandidates) {
  const normalized = cleanText(content);

  const locationSentence = sentenceCandidates.find(isLikelyLocationOnlySentence);

  if (locationSentence) {
    return locationSentence;
  }

  const { nearLocations, inAtLocations } = extractContextLocations(normalized);
  const placeEntities = nlp(normalized)
    .places()
    .out("array")
    .map((value) => cleanText(value));

  const mergedCandidates = [...nearLocations, ...inAtLocations, ...placeEntities];
  const unique = [];
  const seen = new Set();

  for (const value of mergedCandidates) {
    const normalizedValue = value.toLowerCase();

    if (seen.has(normalizedValue)) {
      continue;
    }

    if (!isValidLocationPart(value)) {
      continue;
    }

    seen.add(normalizedValue);
    unique.push(value);
  }

  if (unique.length) {
    return unique.join(" ");
  }

  const fallbackMatch = normalized.match(
    /\b(?:in|at|near)\s+([A-Za-z][A-Za-z0-9-]*(?:\s+[A-Za-z][A-Za-z0-9-]*){0,5})/
  );

  if (fallbackMatch?.[1]) {
    return fallbackMatch[1].trim();
  }

  return "Unknown Location";
}

function inferCityFromLocation(location) {
  return extractCityFromLocationString(location);
}

function sentenceLooksLikeRequestType(sentence) {
  const compact = sentence.trim().toLowerCase();

  if (!compact) {
    return false;
  }

  if (compact.split(/\s+/).length <= 3) {
    return REQUEST_TYPE_RULES.some((rule) => rule.pattern.test(compact));
  }

  return false;
}

function inferAlertContent(sentences, location, requestType) {
  const filtered = sentences.filter((sentence) => {
    const normalizedSentence = cleanText(sentence).toLowerCase();
    const normalizedLocation = cleanText(location).toLowerCase();

    if (normalizedSentence === normalizedLocation) {
      return false;
    }

    if (sentenceLooksLikeRequestType(sentence)) {
      return false;
    }

    if (requestType !== "General" && normalizedSentence === requestType.toLowerCase()) {
      return false;
    }

    return true;
  });

  if (!filtered.length) {
    return sentences.join(" ").trim();
  }

  return filtered.join(" ").trim();
}

export function extractStructuredEntities(content) {
  const sentences = getSentences(content);
  const requestType = inferRequestType(content);
  const location = inferLocation(content, sentences);
  const city = inferCityFromLocation(location);
  const alertContent = inferAlertContent(sentences, location, requestType);

  return {
    requestType,
    location,
    city,
    alertContent,
  };
}
