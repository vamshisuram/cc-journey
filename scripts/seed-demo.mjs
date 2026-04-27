#!/usr/bin/env node
// Seed the journey store with demo goals so the UI has something to showcase.
// Usage: node scripts/seed-demo.mjs CLAUDE_PLUGIN_DATA=/tmp/journey-demo
//
// Wipes and re-creates the data dir for a clean demo every time.

import { rmSync, mkdirSync } from "node:fs";
import { applyEnvArgs } from "../lib/args.mjs";
import { PATHS, writeIndex, writeMeta, writeTree } from "../lib/store.mjs";

applyEnvArgs(process.argv.slice(2));
rmSync(PATHS.DATA_DIR, { recursive: true, force: true });
mkdirSync(PATHS.GOALS_DIR, { recursive: true });

let nodeCounter = 0;
function nodeId() {
  return `n_${String(++nodeCounter).padStart(4, "0")}`;
}

function makeNode({
  id,
  parent_id,
  conversation_id,
  ts,
  kind,
  pivot_signal = null,
  prompt,
  summary,
  deadend_reason = null,
  deadend_at = null,
}) {
  return {
    id,
    parent_id,
    conversation_id,
    timestamp: ts,
    kind,
    pivot_signal,
    raw_meta: {
      user_prompt_preview: prompt,
      transcript_pointer: { session_id: conversation_id, transcript_path: null },
    },
    summary,
    summary_generated_at: ts,
    deadend_reason,
    deadend_at,
  };
}

function tally(nodes) {
  return {
    node_count: nodes.length,
    branch_count: nodes.filter((n) => n.kind === "pivot").length,
    deadend_count: nodes.filter((n) => n.kind === "deadend").length,
  };
}

const goals = [];

// =====================================================================
// GOAL 1 — Designing this very plugin (mirrors our actual conversation)
// =====================================================================
{
  const goalId = "g_design_journey";
  const conv = "conv_design_01";
  const t = (mins) => new Date(Date.parse("2026-04-26T18:00:00Z") + mins * 60000).toISOString();
  const nodes = [];
  nodeCounter = 0;

  const n1 = nodeId();
  nodes.push(makeNode({
    id: n1, parent_id: null, conversation_id: conv, ts: t(0),
    kind: "root",
    prompt: "build a claude plugin to understand the journey of a session",
    summary: "Seed idea: plugin captures conversation snapshots over time.",
  }));

  const n2 = nodeId();
  nodes.push(makeNode({
    id: n2, parent_id: n1, conversation_id: conv, ts: t(3),
    kind: "continuation",
    prompt: "anchor it to a goal so journey can span multiple conversations",
    summary: "Refine: anchor to goal/label, not session.",
  }));

  // First branch: linear timeline (deadend)
  const n3a = nodeId();
  nodes.push(makeNode({
    id: n3a, parent_id: n2, conversation_id: conv, ts: t(8),
    kind: "deadend",
    prompt: "render it as a linear timeline view with steers highlighted",
    summary: "Try: linear timeline of steering moments.",
    deadend_reason: "Linear can't show branches/dead-ends; tree captures real thinking shape.",
    deadend_at: t(15),
  }));

  // Pivot: tree-of-states
  const n3b = nodeId();
  nodes.push(makeNode({
    id: n3b, parent_id: n2, conversation_id: conv, ts: t(15),
    kind: "pivot", pivot_signal: "alternative",
    prompt: "actually lets do tree-of-states mindmap, fully automated",
    summary: "Pivot: tree-of-states mindmap, automated capture, lazy summaries.",
  }));

  // Second branch under pivot: hybrid capture (deadend)
  const n4a = nodeId();
  nodes.push(makeNode({
    id: n4a, parent_id: n3b, conversation_id: conv, ts: t(20),
    kind: "deadend",
    prompt: "let users manually checkpoint important moments too",
    summary: "Try: hybrid manual + auto capture.",
    deadend_reason: "Users will forget to checkpoint; full automation is honest about how work happens.",
    deadend_at: t(25),
  }));

  const n4b = nodeId();
  nodes.push(makeNode({
    id: n4b, parent_id: n3b, conversation_id: conv, ts: t(25),
    kind: "pivot", pivot_signal: "redirection",
    prompt: "no, fully automated only — no manual commands at all",
    summary: "Lock: fully automated capture, no user friction.",
  }));

  const n5 = nodeId();
  nodes.push(makeNode({
    id: n5, parent_id: n4b, conversation_id: conv, ts: t(32),
    kind: "continuation",
    prompt: "every turn = one node so back-N-pings maps cleanly",
    summary: "Decide: every turn creates one node; branches only on pivot signals.",
  }));

  const n6 = nodeId();
  nodes.push(makeNode({
    id: n6, parent_id: n5, conversation_id: conv, ts: t(40),
    kind: "continuation",
    prompt: "lazy LLM summaries cached per node",
    summary: "Decide: capture cheap; LLM summary lazy + cached.",
  }));

  const n7 = nodeId();
  nodes.push(makeNode({
    id: n7, parent_id: n6, conversation_id: conv, ts: t(48),
    kind: "continuation",
    prompt: "add a timeline view from the same timestamped tree",
    summary: "Add: timeline view as projection of same tree.",
  }));

  // Reframe (pivot)
  const n8 = nodeId();
  nodes.push(makeNode({
    id: n8, parent_id: n7, conversation_id: conv, ts: t(60),
    kind: "continuation",
    prompt: "reframe: substrate is a state-tree of conversations; goal is one dimension",
    summary: "Reframe: state-tree is the substrate; goals/views are projections.",
  }));

  const conv2 = "conv_design_02";
  const n9 = nodeId();
  nodes.push(makeNode({
    id: n9, parent_id: n8, conversation_id: conv2, ts: t(180),
    kind: "continuation",
    prompt: "lets ship — bun server, plain JS frontend, cytoscape for the mindmap",
    summary: "Ship: Bun server + plain JS + Cytoscape canvas mindmap.",
  }));

  const n10 = nodeId();
  nodes.push(makeNode({
    id: n10, parent_id: n9, conversation_id: conv2, ts: t(220),
    kind: "continuation",
    prompt: "wire lazy LLM summaries and auto goal titles",
    summary: "Build: lazy summary endpoint + auto goal title.",
  }));

  goals.push({
    id: goalId,
    title: "Design journey plugin architecture",
    status: "active",
    created_at: t(0),
    last_active_at: t(220),
    conversation_ids: [conv, conv2],
    project_dir: "/Users/vamshi/dev",
    ...tally(nodes),
  });
  writeMeta(goalId, goals[goals.length - 1]);
  writeTree(goalId, { goal_id: goalId, version: 1, nodes });
}

// =====================================================================
// GOAL 2 — Migrate authentication to OAuth (multi-conversation, busy)
// =====================================================================
{
  const goalId = "g_oauth_migration";
  const c1 = "conv_oauth_01";
  const c2 = "conv_oauth_02";
  const c3 = "conv_oauth_03";
  const t = (mins) => new Date(Date.parse("2026-04-22T09:00:00Z") + mins * 60000).toISOString();
  const nodes = [];
  nodeCounter = 0;

  const r = nodeId();
  nodes.push(makeNode({
    id: r, parent_id: null, conversation_id: c1, ts: t(0),
    kind: "root",
    prompt: "migrate session-token auth to OAuth — legal flagged the current scheme",
    summary: "Goal: replace session-token auth with OAuth (compliance-driven).",
  }));

  const a1 = nodeId();
  nodes.push(makeNode({
    id: a1, parent_id: r, conversation_id: c1, ts: t(20),
    kind: "continuation",
    prompt: "audit current session-token usage across services",
    summary: "Audit current session-token call sites and storage.",
  }));

  // Branch: try to retrofit JWT in cookies (deadend)
  const dead1 = nodeId();
  nodes.push(makeNode({
    id: dead1, parent_id: a1, conversation_id: c1, ts: t(40),
    kind: "deadend",
    prompt: "try storing JWT in cookies as drop-in replacement",
    summary: "Attempt: JWT-in-cookies drop-in.",
    deadend_reason: "CSRF protection is brittle; doesn't satisfy compliance ask of stateless rotation.",
    deadend_at: t(80),
  }));

  // Pivot: full OAuth flow
  const a2 = nodeId();
  nodes.push(makeNode({
    id: a2, parent_id: a1, conversation_id: c1, ts: t(80),
    kind: "pivot", pivot_signal: "redirection",
    prompt: "no, do it properly — full OAuth authorization-code flow with PKCE",
    summary: "Pivot: full OAuth code+PKCE flow, not a band-aid.",
  }));

  const a3 = nodeId();
  nodes.push(makeNode({
    id: a3, parent_id: a2, conversation_id: c1, ts: t(110),
    kind: "continuation",
    prompt: "spec the IdP integration — auth0 vs cognito vs self-host keycloak",
    summary: "Spec IdP comparison: auth0 vs cognito vs keycloak.",
  }));

  // New conversation
  const a4 = nodeId();
  nodes.push(makeNode({
    id: a4, parent_id: a3, conversation_id: c2, ts: t(1500),
    kind: "continuation",
    prompt: "decided on auth0 — cost / time-to-ship win, scope rules fit our model",
    summary: "Decide: Auth0; cost & scope-rules fit our needs.",
  }));

  // Branch: implicit flow (deadend)
  const dead2 = nodeId();
  nodes.push(makeNode({
    id: dead2, parent_id: a4, conversation_id: c2, ts: t(1520),
    kind: "deadend",
    prompt: "wire up implicit flow first, simpler for the SPA",
    summary: "Try: implicit flow for SPA simplicity.",
    deadend_reason: "Implicit flow is deprecated; tokens-in-URL leak via referrer/logs.",
    deadend_at: t(1560),
  }));

  const a5 = nodeId();
  nodes.push(makeNode({
    id: a5, parent_id: a4, conversation_id: c2, ts: t(1560),
    kind: "pivot", pivot_signal: "contradiction",
    prompt: "actually implicit is deprecated — use code flow with PKCE in the SPA too",
    summary: "Pivot: code+PKCE in SPA (implicit deprecated).",
  }));

  const a6 = nodeId();
  nodes.push(makeNode({
    id: a6, parent_id: a5, conversation_id: c2, ts: t(1620),
    kind: "continuation",
    prompt: "wire refresh-token rotation; revoke on logout",
    summary: "Implement refresh-token rotation + revoke-on-logout.",
  }));

  // New conversation: rollout
  const a7 = nodeId();
  nodes.push(makeNode({
    id: a7, parent_id: a6, conversation_id: c3, ts: t(2880),
    kind: "continuation",
    prompt: "design the migration — dual-auth period? or hard cutover?",
    summary: "Plan rollout: dual-auth shadow period vs hard cutover.",
  }));

  // Branch: hard cutover (deadend)
  const dead3 = nodeId();
  nodes.push(makeNode({
    id: dead3, parent_id: a7, conversation_id: c3, ts: t(2900),
    kind: "deadend",
    prompt: "hard cutover — flip the flag friday at midnight",
    summary: "Try: hard cutover Friday midnight.",
    deadend_reason: "No safe rollback if any service still depends on session token; risk too high.",
    deadend_at: t(2940),
  }));

  const a8 = nodeId();
  nodes.push(makeNode({
    id: a8, parent_id: a7, conversation_id: c3, ts: t(2940),
    kind: "pivot", pivot_signal: "alternative",
    prompt: "lets do dual-auth for two weeks behind a flag, then deprecate",
    summary: "Roll out: dual-auth shadow + 2-week feature-flagged migration.",
  }));

  const a9 = nodeId();
  nodes.push(makeNode({
    id: a9, parent_id: a8, conversation_id: c3, ts: t(3000),
    kind: "continuation",
    prompt: "instrument both paths with metrics for parity comparison",
    summary: "Instrument both auth paths for parity metrics.",
  }));

  goals.push({
    id: goalId,
    title: "Migrate authentication to OAuth",
    status: "active",
    created_at: t(0),
    last_active_at: t(3000),
    conversation_ids: [c1, c2, c3],
    project_dir: "/Users/vamshi/dev/api-gateway",
    ...tally(nodes),
  });
  writeMeta(goalId, goals[goals.length - 1]);
  writeTree(goalId, { goal_id: goalId, version: 1, nodes });
}

// =====================================================================
// GOAL 3 — Fix flaky CI test (small task-sized goal)
// =====================================================================
{
  const goalId = "g_flaky_ci";
  const conv = "conv_flaky_01";
  const t = (mins) => new Date(Date.parse("2026-04-26T08:00:00Z") + mins * 60000).toISOString();
  const nodes = [];
  nodeCounter = 0;

  const r = nodeId();
  nodes.push(makeNode({
    id: r, parent_id: null, conversation_id: conv, ts: t(0),
    kind: "root",
    prompt: "the ingest_pipeline_test is flaky — fails maybe 1 in 4 ci runs",
    summary: "Goal: fix flakiness in ingest_pipeline_test (~25% failure rate).",
  }));

  const n1 = nodeId();
  nodes.push(makeNode({
    id: n1, parent_id: r, conversation_id: conv, ts: t(5),
    kind: "continuation",
    prompt: "look at recent failure logs — group by error message",
    summary: "Group recent CI failures by error message.",
  }));

  // Branch: blame the network mock (deadend)
  const dead1 = nodeId();
  nodes.push(makeNode({
    id: dead1, parent_id: n1, conversation_id: conv, ts: t(15),
    kind: "deadend",
    prompt: "looks like the mock http server is racing — bump retries",
    summary: "Try: bump mock-server retries.",
    deadend_reason: "Made it worse — flake rate stayed same, total runtime went up 2x.",
    deadend_at: t(35),
  }));

  const n2 = nodeId();
  nodes.push(makeNode({
    id: n2, parent_id: n1, conversation_id: conv, ts: t(35),
    kind: "pivot", pivot_signal: "redirection",
    prompt: "actually the failure is downstream — the test asserts on iteration order but we use a Set",
    summary: "Pivot: real cause is iteration-order assertion on a Set.",
  }));

  const n3 = nodeId();
  nodes.push(makeNode({
    id: n3, parent_id: n2, conversation_id: conv, ts: t(50),
    kind: "continuation",
    prompt: "convert to sorted array compare; add property test for ordering",
    summary: "Fix: sorted-array compare + property test for ordering.",
  }));

  goals.push({
    id: goalId,
    title: "Fix flaky ingest_pipeline_test",
    status: "closed",
    created_at: t(0),
    last_active_at: t(50),
    conversation_ids: [conv],
    project_dir: "/Users/vamshi/dev/data-pipeline",
    ...tally(nodes),
  });
  writeMeta(goalId, goals[goals.length - 1]);
  writeTree(goalId, { goal_id: goalId, version: 1, nodes });
}

writeIndex({ goals });
console.log(`Seeded ${goals.length} goals into ${PATHS.DATA_DIR}`);
for (const g of goals) {
  console.log(`  ${g.id}  ${g.title}  (${g.node_count} nodes, ${g.branch_count} pivots, ${g.deadend_count} dead-ends)`);
}
