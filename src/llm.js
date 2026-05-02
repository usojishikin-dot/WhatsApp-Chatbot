import { limitReply } from "./fallback.js";

const FIVE_SECONDS = 5000;

export function llmConfigured(env = process.env) {
  return Boolean(env.OPENROUTER_API_KEY || env.GROQ_API_KEY || env.GEMINI_API_KEY);
}

export async function generateAiReply({ message, history, config, timeoutMs = FIVE_SECONDS, env = process.env }) {
  const provider = (env.LLM_PROVIDER || preferredProvider(env)).toLowerCase();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const result = await callProvider(provider, { message, history, config, signal: controller.signal, env });
    return limitReply(result);
  } finally {
    clearTimeout(timeout);
  }
}

function preferredProvider(env) {
  if (env.OPENROUTER_API_KEY) return "openrouter";
  if (env.GROQ_API_KEY) return "groq";
  if (env.GEMINI_API_KEY) return "gemini";
  return "openrouter";
}

async function callProvider(provider, args) {
  if (provider === "groq") return callOpenAiCompatible("https://api.groq.com/openai/v1/chat/completions", args.env.GROQ_API_KEY, args.env.GROQ_MODEL || "llama-3.1-8b-instant", args);
  if (provider === "gemini") return callGemini(args);
  return callOpenAiCompatible("https://openrouter.ai/api/v1/chat/completions", args.env.OPENROUTER_API_KEY, args.env.OPENROUTER_MODEL || "meta-llama/llama-3.1-8b-instruct:free", args);
}

async function callOpenAiCompatible(url, apiKey, model, { message, history, config, signal }) {
  if (!apiKey) throw new Error("LLM API key is not configured");

  const response = await fetch(url, {
    method: "POST",
    signal,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 90,
      messages: [
        { role: "system", content: systemPrompt(config) },
        ...history.map((item) => ({ role: item.role, content: item.message })),
        { role: "user", content: message }
      ]
    })
  });

  if (!response.ok) throw new Error(`LLM request failed: ${response.status}`);
  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

async function callGemini({ message, history, config, signal, env }) {
  if (!env.GEMINI_API_KEY) throw new Error("Gemini API key is not configured");

  const model = env.GEMINI_MODEL || "gemini-1.5-flash";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`,
    {
      method: "POST",
      signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt(config) }] },
        contents: [
          ...history.map((item) => ({
            role: item.role === "assistant" ? "model" : "user",
            parts: [{ text: item.message }]
          })),
          { role: "user", parts: [{ text: message }] }
        ],
        generationConfig: { temperature: 0.2, maxOutputTokens: 90 }
      })
    }
  );

  if (!response.ok) throw new Error(`Gemini request failed: ${response.status}`);
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.map((part) => part.text).join(" ") || "";
}

function systemPrompt(config) {
  const faq = Object.entries(config.faq || {})
    .map(([question, answer]) => `- ${question}: ${answer}`)
    .join("\n");

  return `You are a friendly WhatsApp assistant for ${config.business_name}.
Reply in under 300 characters.
Do not invent information. If the answer is missing, ask the customer to call ${config.phone}.
Business hours: ${config.hours}
Address: ${config.address}
Phone: ${config.phone}
FAQ:
${faq}`;
}
