export function containsAnyKeyword(text, keywords = []) {
  const lower = String(text).toLowerCase();
  return keywords.some((keyword) => lower.includes(String(keyword).toLowerCase()));
}

export function isHandoffRequest(text) {
  return /\b(human|agent)\b/i.test(String(text));
}

export function keywordFallbackReply(message, config) {
  const lower = String(message).toLowerCase();
  const messageTerms = termsForText(lower);
  const faqEntries = Object.entries(config.faq || {});
  const smallTalk = smallTalkReply(lower, config);
  if (smallTalk) return limitReply(smallTalk);

  for (const [question, answer] of faqEntries) {
    const questionTerms = termsForText(question);
    if (setsIntersect(questionTerms, messageTerms)) return limitReply(answer);
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

function termsForText(text) {
  const terms = new Set();
  const words = String(text).toLowerCase().split(/\W+/).filter(Boolean);

  for (const word of words) {
    terms.add(word);
    terms.add(stemWord(word));
  }

  return terms;
}

function setsIntersect(left, right) {
  for (const value of left) {
    if (right.has(value)) return true;
  }
  return false;
}

function smallTalkReply(message, config) {
  if (/\b(hi|hello|hey|good morning|good afternoon|good evening)\b/i.test(message)) {
    return `Hello, welcome to ${config.business_name}. How can we help you today?`;
  }

  if (/\b(thanks|thank you|appreciate it)\b/i.test(message)) {
    return `You're welcome. ${config.business_name} is happy to help.`;
  }

  if (/\b(bye|goodbye|see you)\b/i.test(message)) {
    return `Thank you for contacting ${config.business_name}. Have a great day.`;
  }

  return "";
}

function stemWord(word) {
  if (word === "delivery" || word === "delivers" || word === "delivered") return "deliver";
  if (word.endsWith("ies") && word.length > 4) return `${word.slice(0, -3)}y`;
  if (word.endsWith("ing") && word.length > 5) return word.slice(0, -3);
  if (word.endsWith("ed") && word.length > 4) return word.slice(0, -2);
  if (word.endsWith("s") && word.length > 4) return word.slice(0, -1);
  return word;
}
