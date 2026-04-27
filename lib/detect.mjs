const REDIRECTION = [
  /^\s*no[,.\s!]/i,
  /^\s*stop\b/i,
  /^\s*wait\b/i,
  /\bdon'?t\b/i,
  /\binstead\b/i,
  /\bactually\b/i,
  /\brather\b/i,
  /\bgo back\b/i,
  /\bundo\b/i,
  /\bdifferent approach\b/i,
  /\bswitch to\b/i,
  /\bforget that\b/i,
  /\bnever mind\b/i,
  /\bchange of plan\b/i,
  /\blet'?s try\b/i,
  /\bbackup\b/i,
  /\brewind\b/i,
];

const ALTERNATIVE = [
  /\bwhat if\b/i,
  /\bcould we\b/i,
  /\balternative\b/i,
  /\binstead of\b/i,
  /\banother way\b/i,
];

// Soft hints — words that often (but not always) signal a pivot. Used to
// gate the LLM-assisted classifier so we only pay the LLM cost on
// plausibly-ambiguous turns.
const SOFT_PIVOT_HINTS =
  /\b(but|however|hmm|wait|on second thought|alternatively|actually|maybe|reconsider|step back)\b/i;

export function classifyTurn(prompt, prior) {
  if (!prior) return { kind: "root", pivot_signal: null };

  for (const r of REDIRECTION) {
    if (r.test(prompt))
      return { kind: "pivot", pivot_signal: "redirection" };
  }
  for (const r of ALTERNATIVE) {
    if (r.test(prompt))
      return { kind: "pivot", pivot_signal: "alternative" };
  }
  return { kind: "continuation", pivot_signal: null };
}

export function shouldAskLLMForPivot(prompt) {
  return SOFT_PIVOT_HINTS.test(prompt || "");
}

export async function classifyTurnWithLLM(prompt, prior, llmFn) {
  const base = classifyTurn(prompt, prior);
  if (base.kind !== "continuation" || !prior || !shouldAskLLMForPivot(prompt)) {
    return base;
  }
  try {
    const priorText =
      prior.summary || prior.raw_meta?.user_prompt_preview || "(no prior context)";
    const reply = await llmFn(
      `Prior turn (summarized): ${priorText}\n\nNew turn: ${prompt}\n\n` +
        `Is the new turn a pivot away from the prior direction (the user redirecting, ` +
        `abandoning the current approach, or exploring an alternative path), or a ` +
        `continuation of the same line of thinking? Reply with just one word: ` +
        `"pivot" or "continuation". No preamble.`,
      { maxTokens: 10 },
    );
    const word = String(reply).toLowerCase().trim().split(/\s+/)[0];
    if (word === "pivot") {
      return { kind: "pivot", pivot_signal: "llm_inferred" };
    }
  } catch {
    // LLM unavailable / failure — keep regex result
  }
  return base;
}

export function previewPrompt(prompt, max = 200) {
  const trimmed = (prompt || "").replace(/\s+/g, " ").trim();
  return trimmed.length > max ? trimmed.slice(0, max) + "…" : trimmed;
}

export function heuristicSummary(prompt, words = 15) {
  const trimmed = (prompt || "").replace(/\s+/g, " ").trim();
  const parts = trimmed.split(" ");
  if (parts.length <= words) return trimmed;
  return parts.slice(0, words).join(" ") + "…";
}
