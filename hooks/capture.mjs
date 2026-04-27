#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { getActiveGoalForSession, appendNode, readTree, findFrontier } from "../lib/store.mjs";
import { classifyTurn, previewPrompt } from "../lib/detect.mjs";

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

const goal = getActiveGoalForSession(sessionId, projectDir);
const tree = readTree(goal.id);
const prior = findFrontier(tree);
const { kind, pivot_signal } = classifyTurn(prompt, prior);

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

process.exit(0);
