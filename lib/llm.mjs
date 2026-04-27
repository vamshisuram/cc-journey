import { spawn } from "node:child_process";

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";
const TIMEOUT_MS = 30000;

export async function llm(prompt, opts = {}) {
  if (process.env.ANTHROPIC_API_KEY) {
    return callApi(prompt, opts);
  }
  return callCli(prompt, opts);
}

async function callApi(prompt, { model = DEFAULT_MODEL, maxTokens = 200 } = {}) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`anthropic api ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return (data.content?.[0]?.text || "").trim();
}

function callCli(prompt) {
  return new Promise((resolve, reject) => {
    const child = spawn("claude", ["-p", prompt], { timeout: TIMEOUT_MS });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(out.trim());
      else reject(new Error(`claude cli exit ${code}: ${err.trim()}`));
    });
  });
}

export function truncWords(s, n = 20) {
  const words = String(s).replace(/\s+/g, " ").trim().split(" ");
  return words.length > n ? words.slice(0, n).join(" ") + "…" : words.join(" ");
}

export const PROMPTS = {
  summary: (text) =>
    `Summarize this user turn in 20 words or fewer. One line. No preamble, no quotes — just the summary.\n\nTurn: ${text}`,
  title: (text) =>
    `Generate a 4-6 word title for a conversation that starts with this user prompt. No preamble, no quotes — just the title.\n\nPrompt: ${text}`,
  match: (recentGoals, text) =>
    `These are recent conversation goals:\n${recentGoals
      .map((g) => `- ${g.id}: ${g.title}`)
      .join(
        "\n",
      )}\n\nDoes this new user prompt continue any of them, or start a new goal? Reply with just the matching goal id (e.g. ${recentGoals[0]?.id || "g_xxx"}), or the literal word "new". No preamble.\n\nNew prompt: ${text}`,
};
