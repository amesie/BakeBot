// Gemini adapter (server only). Model names come from env so they can follow
// Google's model list without a code change (spec 3, D-059).
import "server-only";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import type { ChatModel } from "./engine";

// Measured 2026-10-15: 3.1-flash-lite ~1.0 s per answer vs 3.5-flash-lite 3.3-5.7 s (D-064).
export const CHAT_MODEL = process.env.GEMINI_CHAT_MODEL || "gemini-3.1-flash-lite";
export const EMBED_MODEL = process.env.GEMINI_EMBED_MODEL || "gemini-embedding-001";
export const EMBED_DIMENSIONS = 768;

const LANGUAGE_NAMES: Record<string, string> = { en: "English", xh: "isiXhosa", af: "Afrikaans" };

const SYSTEM = [
  "You are BakeBot, the automated assistant of KD Pops, a small cake pop business run by a high school learner.",
  "Answer ONLY with information found in the APPROVED ANSWERS you are given. Do not add facts, prices,",
  "discounts, allergen or ingredient information, promises, or opinions that are not in them.",
  "If the approved answers do not answer the question, set resolved to false and leave answer empty.",
  "Never decide on discounts, credit, payment arrangements or exceptions: those are for Kaydee.",
  "Copy flavour names, prices, amounts, times, dates and places EXACTLY as written; never translate or change them.",
  "Keep answers short (at most 3 sentences), friendly and factual. Reply in the requested language.",
].join(" ");

function client() {
  const apiKey = process.env.GEMINI_API_KEY;
  return apiKey ? new GoogleGenAI({ apiKey }) : null;
}

async function embed(ai: GoogleGenAI, text: string, taskType: string, signal?: AbortSignal) {
  const response = await ai.models.embedContent({
    model: EMBED_MODEL,
    contents: text,
    config: { outputDimensionality: EMBED_DIMENSIONS, taskType, abortSignal: signal },
  });
  const values = response.embeddings?.[0]?.values;
  if (!values || values.length !== EMBED_DIMENSIONS) throw new Error("embedding_failed");
  return values;
}

/**
 * Load tests only (spec 10: "mock Gemini to avoid quota costs"): answers
 * after 300-800 ms with a random embedding. Enabled by BAKEBOT_FAKE_MODEL=1,
 * which must never be set on Vercel.
 */
function fakeModel(): ChatModel {
  const wait = (signal: AbortSignal) =>
    new Promise<void>((resolve, reject) => {
      const t = setTimeout(resolve, 300 + Math.random() * 500);
      signal.addEventListener("abort", () => (clearTimeout(t), reject(new Error("aborted"))));
    });
  return {
    async embedQuestion(_text, signal) {
      await wait(signal);
      return Array.from({ length: EMBED_DIMENSIONS }, () => Math.random() - 0.5);
    },
    async answer({ context, signal }) {
      await wait(signal);
      return { answer: context[0] ?? "", resolved: context.length > 0 };
    },
  };
}

/** The chat model, or null when GEMINI_API_KEY is not set (chat then falls back). */
export function geminiChatModel(): ChatModel | null {
  if (process.env.BAKEBOT_FAKE_MODEL === "1" && process.env.VERCEL !== "1") return fakeModel();
  const ai = client();
  if (!ai) return null;
  return {
    embedQuestion: (text, signal) => embed(ai, text, "RETRIEVAL_QUERY", signal),
    async answer({ question, context, language, signal }) {
      const response = await ai.models.generateContent({
        model: CHAT_MODEL,
        contents: [
          {
            role: "user",
            parts: [
              {
                text: [
                  `Reply in ${LANGUAGE_NAMES[language] ?? "English"}.`,
                  "APPROVED ANSWERS:",
                  ...context.map((answer, i) => `${i + 1}. ${answer}`),
                  "",
                  `CUSTOMER QUESTION: ${question}`,
                ].join("\n"),
              },
            ],
          },
        ],
        config: {
          systemInstruction: SYSTEM,
          temperature: 0,
          maxOutputTokens: 300,
          // Short factual rephrasing needs no reasoning; thinking adds seconds (REQ-24).
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
          responseMimeType: "application/json",
          responseJsonSchema: {
            type: "object",
            properties: { answer: { type: "string" }, resolved: { type: "boolean" } },
            required: ["answer", "resolved"],
          },
          abortSignal: signal,
        },
      });
      const parsed = JSON.parse(response.text ?? "{}");
      return { answer: String(parsed.answer ?? ""), resolved: parsed.resolved === true };
    },
  };
}

/** Embedding for an FAQ entry when Kaydee saves it (stored in faq_knowledge). */
export async function embedFaq(question: string, answer: string): Promise<number[] | null> {
  const ai = client();
  if (!ai) return null;
  return embed(ai, `${question}\n${answer}`, "RETRIEVAL_DOCUMENT");
}
