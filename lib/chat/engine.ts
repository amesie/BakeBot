// BakeBot's decision logic (spec 7.4), kept free of network code so it can be
// unit-tested with a fake model. The AI never decides prices, discounts,
// credit or trust (spec 2): it may only rephrase owner-approved answers.

export type FaqMatch = { question: string; approved_answer: string; similarity: number };

export interface ChatModel {
  /** 768-dimension embedding of the customer's question. */
  embedQuestion(text: string, signal: AbortSignal): Promise<number[]>;
  /** Answer only from the given approved answers, or report "not resolved". */
  answer(input: { question: string; context: string[]; language: string; signal: AbortSignal }): Promise<{
    answer: string;
    resolved: boolean;
  }>;
}

export type ChatDeps = {
  model: ChatModel | null; // null = no API key: always fall back (REQ-24)
  matchFaq: (embedding: number[], language: string) => Promise<FaqMatch[]>;
  /** Live values for placeholders in approved answers: {menu}, {place}. */
  fill: (answer: string) => string;
  timeoutMs?: number;
  threshold?: number;
};

export type ChatOutcome =
  | { kind: "answer"; text: string }
  | { kind: "unresolved"; text: null } // "I'll check with Kaydee"
  | { kind: "human"; text: null } // customer asked for a person (REQ-23)
  | { kind: "fallback"; reason: "timeout" | "error" | "no_model" }; // REQ-24

export const TIMEOUT_MS = 5000; // REQ-24
export const SIMILARITY_THRESHOLD = 0.75; // spec 7.4, tune with real questions
export const MAX_QUESTION_LENGTH = 500;

// "Can I talk to Kaydee / a person?" in English, Afrikaans and isiXhosa.
const HUMAN = /\b(kaydee|human|person|someone|real person|talk to (a|someone)|mens|iemand|praat met|umntu|ndifuna ukuthetha)\b/i;

export function wantsHuman(text: string) {
  return HUMAN.test(text);
}

/** Rand amounts in the answer must appear in the approved context (no invented prices). */
export function onlyKnownAmounts(answer: string, context: string[]) {
  const amounts = answer.match(/R\s?\d+(?:[.,]\d{2})?/g) ?? [];
  const allowed = context.join(" ").replace(/\s/g, "");
  return amounts.every((amount) => allowed.includes(amount.replace(/\s/g, "")));
}

export async function handleQuestion(question: string, language: string, deps: ChatDeps): Promise<ChatOutcome> {
  const text = question.trim().slice(0, MAX_QUESTION_LENGTH);
  if (wantsHuman(text)) return { kind: "human", text: null };
  if (!deps.model) return { kind: "fallback", reason: "no_model" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? TIMEOUT_MS);
  const timedOut = new Promise<never>((_, reject) =>
    controller.signal.addEventListener("abort", () => reject(new Error("timeout")), { once: true }),
  );

  try {
    const work = (async (): Promise<ChatOutcome> => {
      const embedding = await deps.model!.embedQuestion(text, controller.signal);
      const matches = await deps.matchFaq(embedding, language);
      const relevant = matches.filter((m) => m.similarity >= (deps.threshold ?? SIMILARITY_THRESHOLD));
      if (relevant.length === 0) return { kind: "unresolved", text: null };

      const context = relevant.map((m) => deps.fill(m.approved_answer));
      const reply = await deps.model!.answer({ question: text, context, language, signal: controller.signal });
      const answer = reply.answer.trim();
      if (!reply.resolved || !answer || !onlyKnownAmounts(answer, context)) return { kind: "unresolved", text: null };
      return { kind: "answer", text: answer.slice(0, 600) };
    })();
    return await Promise.race([work, timedOut]);
  } catch {
    return { kind: "fallback", reason: controller.signal.aborted ? "timeout" : "error" };
  } finally {
    clearTimeout(timer);
  }
}
