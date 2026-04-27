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
