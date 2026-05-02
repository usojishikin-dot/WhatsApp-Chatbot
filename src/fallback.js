export function containsAnyKeyword(text, keywords = []) {
  const lower = String(text).toLowerCase();
  return keywords.some((keyword) => lower.includes(String(keyword).toLowerCase()));
}

export function isHandoffRequest(text) {
  return /\b(human|agent)\b/i.test(String(text));
}

export function keywordFallbackReply(message, config) {
  const lower = String(message).toLowerCase();
  const faqEntries = Object.entries(config.faq || {});

  for (const [question, answer] of faqEntries) {
    if (lower.includes(String(question).toLowerCase())) return limitReply(answer);
  }

  for (const [question, answer] of faqEntries) {
    const words = String(question).toLowerCase().split(/\W+/).filter((word) => word.length > 3);
    if (words.some((word) => lower.includes(word))) return limitReply(answer);
  }

  return limitReply(
    `Thanks for contacting ${config.business_name}. Please ask about our hours, address, products, delivery, or call ${config.phone}.`
  );
}

export function limitReply(reply, max = 300) {
  const normalized = String(reply).replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1).trimEnd()}…`;
}
