import nlp from "compromise";

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

function inferLocation(content, sentenceCandidates) {
  const normalized = cleanText(content);

  const commaBasedCandidate = sentenceCandidates
    .filter((sentence) => sentence.includes(","))
    .sort((a, b) => b.length - a.length)[0];

  if (commaBasedCandidate) {
    return commaBasedCandidate;
  }

  const places = nlp(normalized).places().out("array");

  if (places.length) {
    return places.join(", ");
  }

  const inAtNearMatch = normalized.match(
    /\b(?:in|at|near)\s+([A-Z][A-Za-z0-9-]*(?:\s+[A-Z][A-Za-z0-9-]*){0,5})/
  );

  if (inAtNearMatch?.[1]) {
    return inAtNearMatch[1].trim();
  }

  return "Unknown Location";
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
  const alertContent = inferAlertContent(sentences, location, requestType);

  return {
    requestType,
    location,
    alertContent,
  };
}
