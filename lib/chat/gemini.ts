// Gemini adapter (server only). Model names come from env so they can follow
// Google's model list without a code change (spec 3, D-059).
import "server-only";
import { GoogleGenAI } from "@google/genai";
import type { ChatModel } from "./engine";

export const CHAT_MODEL = process.env.GEMINI_CHAT_MODEL || "gemini-3.5-flash-lite";
export const EMBED_MODEL = process.env.GEMINI_EMBED_MODEL || "gemini-embedding-001";
export const EMBED_DIMENSIONS = 768;

const LANGUAGE_NAMES: Record<string, string> = { en: "English", xh: "isiXhosa", af: "Afrikaans" };

const SYSTEM = [
  "You are BakeBot, the automated assistant of KD Pops, a small cake pop business run by a high school learner.",
  "Answer ONLY with information found in the APPROVED ANSWERS you are given. Do not add facts, prices,",
  "discounts, allergen or ingredient information, promises, or opinions that are not in them.",
  "If the approved answers do not answer the question, set resolved to false and leave answer empty.",
  "Never decide on discounts, credit, payment arrangements or exceptions: those are for Kaydee.",
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

/** The chat model, or null when GEMINI_API_KEY is not set (chat then falls back). */
export function geminiChatModel(): ChatModel | null {
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
