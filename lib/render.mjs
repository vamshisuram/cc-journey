#!/usr/bin/env node
import { applyEnvArgs } from "./args.mjs";
import { readIndex, readTree } from "./store.mjs";
import { heuristicSummary } from "./detect.mjs";

const positional = applyEnvArgs(process.argv.slice(2));

const MARK = {
  root: "●",
  continuation: "◇",
  pivot: "↳",
  deadend: "✗",
  return: "↩",
};

function getActiveGoal() {
  const index = readIndex();
  if (!index.goals.length) return null;
  return [...index.goals].sort((a, b) =>
    b.last_active_at.localeCompare(a.last_active_at),
  )[0];
}

function summaryFor(node) {
  if (node.summary) return node.summary;
  return heuristicSummary(node.raw_meta?.user_prompt_preview || "(no prompt)");
}

function buildChildIndex(nodes) {
  const children = new Map();
  for (const n of nodes) {
    if (!children.has(n.parent_id)) children.set(n.parent_id, []);
    children.get(n.parent_id).push(n);
  }
  return children;
}

function frontierId(nodes) {
  const live = nodes.filter((n) => n.kind !== "deadend");
  return live[live.length - 1]?.id;
}

function renderMindmap(goal, tree) {
  const out = [];
  out.push(`● Goal: ${goal.title}  [${goal.status}]`);
  out.push(
    `  ${tree.nodes.length} nodes · ${goal.branch_count} branches · ${goal.deadend_count} dead-ends`,
  );
  out.push("");

  const children = buildChildIndex(tree.nodes);
  const front = frontierId(tree.nodes);

  function walk(parentId, prefix, isLast) {
    const kids = children.get(parentId) || [];
    kids.forEach((node, i) => {
      const last = i === kids.length - 1;
      const branch = last ? "└─ " : "├─ ";
      const mark = MARK[node.kind] || "·";
      const star = node.id === front ? " *" : "";
      out.push(prefix + branch + mark + " " + summaryFor(node) + star);
      if (node.deadend_reason) {
        out.push(prefix + (last ? "    " : "│   ") + "  reason: " + node.deadend_reason);
      }
      walk(node.id, prefix + (last ? "    " : "│   "), last);
    });
  }
  walk(null, "", true);
  return out.join("\n");
}

function renderTimeline(goal, tree) {
  const out = [];
  out.push(`● Timeline: ${goal.title}`);
  out.push("");
  const sorted = [...tree.nodes].sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp),
  );
  sorted.forEach((n, i) => {
    const t = n.timestamp.replace("T", " ").slice(0, 19);
    const mark = MARK[n.kind] || "·";
    out.push(`T${String(i + 1).padStart(2, "0")} ${t}  ${mark} ${summaryFor(n)}`);
    if (n.deadend_reason) out.push(`           reason: ${n.deadend_reason}`);
  });
  return out.join("\n");
}

function renderBack(goal, tree, n) {
  const out = [];
  out.push(`● Back ${n} pings in: ${goal.title}`);
  out.push("");
  const sorted = [...tree.nodes].sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp),
  );
  const slice = sorted.slice(-n);
  slice.forEach((node) => {
    out.push(`${MARK[node.kind] || "·"} ${summaryFor(node)}`);
    out.push(`   prompt: ${node.raw_meta?.user_prompt_preview || ""}`);
    out.push("");
  });
  return out.join("\n");
}

function renderGoals() {
  const index = readIndex();
  if (!index.goals.length) return "(no goals yet)";
  const out = [];
  out.push("Goals:");
  const sorted = [...index.goals].sort((a, b) =>
    b.last_active_at.localeCompare(a.last_active_at),
  );
  const activeId = sorted[0]?.id;
  for (const g of sorted) {
    const star = g.id === activeId ? "*" : " ";
    out.push(
      ` ${star} ${g.id}  ${g.title.padEnd(40)}  ${g.node_count} nodes  last: ${g.last_active_at.slice(0, 19).replace("T", " ")}`,
    );
  }
  return out.join("\n");
}

const cmd = positional[0] || "mindmap";
const arg = positional[1];

if (cmd === "goals") {
  console.log(renderGoals());
  process.exit(0);
}

const goal = getActiveGoal();
if (!goal) {
  console.log("(no active goal — start a conversation in Claude Code with the plugin installed)");
  process.exit(0);
}
const tree = readTree(goal.id);
if (!tree.nodes.length) {
  console.log(`(goal "${goal.title}" has no nodes yet)`);
  process.exit(0);
}

switch (cmd) {
  case "mindmap":
    console.log(renderMindmap(goal, tree));
    break;
  case "timeline":
    console.log(renderTimeline(goal, tree));
    break;
  case "back":
    console.log(renderBack(goal, tree, parseInt(arg || "5", 10)));
    break;
  default:
    console.log(`unknown command: ${cmd}`);
    process.exit(1);
}
