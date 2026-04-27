import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { homedir } from "node:os";

function dataDir() {
  return (
    process.env.CLAUDE_PLUGIN_DATA ||
    join(homedir(), ".claude", "journey-plugin-data")
  );
}
function indexPath() {
  return join(dataDir(), "index.json");
}
function goalsDir() {
  return join(dataDir(), "goals");
}

function ensureDirs() {
  mkdirSync(goalsDir(), { recursive: true });
}

function readJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2));
}

function newId(prefix) {
  return `${prefix}_${randomBytes(6).toString("hex")}`;
}

function goalDir(goalId) {
  return join(goalsDir(), goalId);
}

export function readIndex() {
  ensureDirs();
  return readJson(indexPath(), { goals: [] });
}

export function writeIndex(index) {
  ensureDirs();
  writeJson(indexPath(), index);
}

export function readTree(goalId) {
  return readJson(join(goalDir(goalId), "tree.json"), {
    goal_id: goalId,
    version: 1,
    nodes: [],
  });
}

export function writeTree(goalId, tree) {
  mkdirSync(goalDir(goalId), { recursive: true });
  writeJson(join(goalDir(goalId), "tree.json"), tree);
}

export function readMeta(goalId) {
  return readJson(join(goalDir(goalId), "meta.json"), null);
}

export function writeMeta(goalId, meta) {
  mkdirSync(goalDir(goalId), { recursive: true });
  writeJson(join(goalDir(goalId), "meta.json"), meta);
}

export function getActiveGoalForSession(sessionId, projectDir) {
  const index = readIndex();
  const now = new Date().toISOString();

  let goal = index.goals.find(
    (g) => g.status === "active" && g.conversation_ids.includes(sessionId),
  );

  if (!goal) {
    const goalId = newId("g");
    goal = {
      id: goalId,
      title: "(untitled goal)",
      status: "active",
      created_at: now,
      last_active_at: now,
      conversation_ids: [sessionId],
      node_count: 0,
      branch_count: 0,
      deadend_count: 0,
      project_dir: projectDir || process.cwd(),
    };
    index.goals.push(goal);
    writeIndex(index);
    writeMeta(goalId, goal);
    writeTree(goalId, { goal_id: goalId, version: 1, nodes: [] });
  }
  return goal;
}

export function appendNode(goalId, node) {
  const tree = readTree(goalId);
  const id = newId("n");
  const isFirst = tree.nodes.length === 0;
  const frontier = isFirst ? null : findFrontier(tree);
  const kind = isFirst ? "root" : node.kind;

  let parentId;
  if (isFirst) {
    parentId = null;
  } else if (kind === "pivot" && frontier.parent_id !== null) {
    parentId = frontier.parent_id;
    frontier.kind = "deadend";
    frontier.deadend_reason = node.deadend_reason ?? "abandoned for new direction";
    frontier.deadend_at = node.timestamp || new Date().toISOString();
  } else {
    parentId = frontier.id;
  }

  const full = {
    id,
    parent_id: parentId,
    conversation_id: node.conversation_id,
    timestamp: node.timestamp || new Date().toISOString(),
    kind,
    pivot_signal: node.pivot_signal ?? null,
    raw_meta: node.raw_meta || {},
    summary: null,
    summary_generated_at: null,
    deadend_reason: null,
    deadend_at: null,
  };

  tree.nodes.push(full);
  writeTree(goalId, tree);

  const index = readIndex();
  const g = index.goals.find((x) => x.id === goalId);
  if (g) {
    g.node_count = tree.nodes.length;
    g.branch_count = tree.nodes.filter((n) => n.kind === "pivot").length;
    g.deadend_count = tree.nodes.filter((n) => n.kind === "deadend").length;
    g.last_active_at = full.timestamp;
    if (!g.conversation_ids.includes(node.conversation_id)) {
      g.conversation_ids.push(node.conversation_id);
    }
    writeIndex(index);
    writeMeta(goalId, g);
  }
  return full;
}

export function findFrontier(tree) {
  if (tree.nodes.length === 0) return null;
  const live = tree.nodes.filter((n) => n.kind !== "deadend");
  return live[live.length - 1] || tree.nodes[tree.nodes.length - 1];
}

export function setSummary(goalId, nodeId, summary) {
  const tree = readTree(goalId);
  const node = tree.nodes.find((n) => n.id === nodeId);
  if (!node) return;
  node.summary = summary;
  node.summary_generated_at = new Date().toISOString();
  writeTree(goalId, tree);
}

export const PATHS = {
  get DATA_DIR() {
    return dataDir();
  },
  get INDEX_PATH() {
    return indexPath();
  },
  get GOALS_DIR() {
    return goalsDir();
  },
};
