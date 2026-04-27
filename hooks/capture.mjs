#!/usr/bin/env node
import { readFileSync } from "node:fs";
import {
  getActiveGoalForSession,
  appendNode,
  readTree,
  findFrontier,
  readIndex,
  recentGoals,
  attachSessionToGoal,
  setGoalTitle,
} from "../lib/store.mjs";
import { classifyTurnWithLLM, previewPrompt } from "../lib/detect.mjs";
import { llm, PROMPTS, truncWords } from "../lib/llm.mjs";

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

const raw = readStdin();
let payload = {};
try {
  payload = raw ? JSON.parse(raw) : {};
} catch {
  process.exit(0);
}

const sessionId = payload.session_id || "unknown_session";
const projectDir = payload.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
const prompt = payload.prompt || "";
if (!prompt.trim()) process.exit(0);

const idx = readIndex();
let goal = idx.goals.find(
  (g) => g.status === "active" && g.conversation_ids.includes(sessionId),
);

if (!goal) {
  // New session — try to match against recent goals before creating a new one.
  // LLM call is allowed to fail silently; we fall through to creating a new goal.
  const candidates = recentGoals({ maxAgeDays: 14, limit: 5 }).filter(
    (g) => g.title && g.title !== "(untitled goal)",
  );
  if (candidates.length > 0) {
    try {
      const reply = await llm(PROMPTS.match(candidates, prompt), { maxTokens: 30 });
      const token = reply.trim().split(/\s+/)[0]?.replace(/[^\w]/g, "");
      if (token && token !== "new") {
        const matched = candidates.find((g) => g.id === token);
        if (matched) goal = attachSessionToGoal(matched.id, sessionId);
      }
    } catch {
      // ignore — fall through to create
    }
  }
  if (!goal) goal = getActiveGoalForSession(sessionId, projectDir);
}

const tree = readTree(goal.id);
const prior = findFrontier(tree);
const { kind, pivot_signal } = await classifyTurnWithLLM(prompt, prior, llm);

appendNode(goal.id, {
  conversation_id: sessionId,
  timestamp: new Date().toISOString(),
  kind,
  pivot_signal,
  raw_meta: {
    user_prompt_preview: previewPrompt(prompt),
    transcript_pointer: {
      session_id: sessionId,
      transcript_path: payload.transcript_path || null,
    },
  },
});

// First node in a fresh goal — give it a real title so terminal /journey
// and homepage cards show something meaningful immediately.
const treeAfter = readTree(goal.id);
if (treeAfter.nodes.length === 1 && goal.title === "(untitled goal)") {
  try {
    const raw = await llm(PROMPTS.title(prompt), { maxTokens: 40 });
    const title = truncWords(raw.replace(/^["']|["']$/g, ""), 8);
    if (title) setGoalTitle(goal.id, title);
  } catch {
    // LLM unavailable — leave as untitled; frontend will fill on view
  }
}

process.exit(0);
