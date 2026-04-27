# Journey Plugin — Discussion Notes

A Claude Code plugin that captures **conversation states as a tree** so users can analyze how their thinking evolved — across one conversation or many. The tree is the substrate; goals are one organizing dimension on top of it.

> **Reframe:** Ultimately we are building a *simplified state-tree of conversations* on which the user can perform analysis on how their thinking evolved. Goals, mindmaps, and timelines are all views into that tree.

---

## The Problem

- Long conversations and multi-session projects lose their narrative. Transcripts are linear, verbose, and hard to scan.
- People scroll back N "pings" to recall what they instructed earlier and how the AI responded — this is friction.
- Dead-end branches of thinking ("we tried X, it didn't work because Y") get buried in scrollback and re-tried later.
- There's no surface for **steering moments** — the prompts where the user corrected, redirected, or rejected the AI's direction. These are the highest-signal turns in any session.
- Users have no feedback loop on their own prompting patterns — where they were ambiguous, where they had to redirect, where the AI drifted.

## The Core Idea

A **tree-of-states mindmap** anchored to a **goal/label**, not a session. One goal can span many conversations; one conversation can touch many goals. The tree shows how thinking branched, pivoted, and backtracked on the way toward (or away from) the goal — with each node a short, token-light state summary.

Value:
1. **Recall** — "what did I tell you 3 prompts ago?" without scrolling.
2. **Architecting skill** — see how prompting deviates when instructions are ambiguous or ignored.
3. **Memory across sessions** — dead-ends and decisions persist beyond a single conversation.
4. **Self-reflection** — surface patterns like "you redirected 4 times in this goal, all around the same ambiguity."

---

## Design Decisions (so far)

### Anchor: Goal, not session
- Goals survive across sessions and projects
- Stored in `~/.claude/journeys/<goal-id>/`
- Auto-attach where possible (no friction); explicit override available

### Structure: **Tree, not timeline**
- Journey is a **tree of states**, not a linear log
- Each node = a *state snapshot* (short summary of where the journey is at that moment)
- Branches form when the conversation pivots, explores an alternative, or hits a dead-end and backtracks
- The root is the goal; leaves are current frontiers or abandoned paths
- This is closer to how thinking actually evolves — not a straight line, but a tree of explored directions

### Capture: Fully automated, no manual checkpoints
- Zero user friction — the user should never have to remember to checkpoint
- Hooks fire on `UserPromptSubmit` / `Stop` and write a state snapshot
- New nodes are appended; pivots create branches automatically
- Manual commands exist only for *viewing*, not capturing

### State snapshots: lazy summaries, not per-turn LLM calls
- **Capture is cheap, summarization is lazy.** Each turn writes raw metadata only (prompt hash, transcript pointer, files touched, timestamp, detected kind: continuation/pivot/deadend/return).
- Short summaries are **generated on demand at view time**, then cached on the node so each is only ever computed once.
- This keeps per-turn cost near zero and avoids burning tokens on summaries the user may never look at.
- Each summary is **token-light** — a single line, hard cap ~20 words, structured as: *what shifted from the parent state*.

### Visualization: mindmap + timeline, both derived from the same tree
- The store is one tree of timestamped nodes. Multiple views are projections of it:
  - **Mindmap** — primary view. Tree of states, branches, dead-ends, current frontier.
  - **Timeline** — same nodes ordered by timestamp. Shows pacing and when pivots happened.
  - **Back N** — slice of recent nodes for "what did I tell you N pings ago."
- All views are **rendered on demand** from the snapshot store, never pre-computed.
- Two render targets:
  - **Terminal ASCII** — always available, no setup.
  - **Local server (first-class)** — rich interactive view in browser. See next section.

### Local server: first-class rich view
- Manually started: `/journey serve` (explicit, not auto). Reasoning: users need to learn the tool exists and form a habit before it earns being always-on.
- Serves a local web UI (e.g. `localhost:7777`) that:
  - **Homepage** — lists all known goals across projects, with the **active goal highlighted**. This is the "thinking dashboard" entry point, not a per-task widget.
  - **Per-goal view** — interactive mindmap (pan/zoom/click-to-expand), with toggle to timeline view of the same nodes.
  - **Click a node** → see the originating turn (full prompt + assistant response from transcript).
  - **Live updates** — server watches the snapshot store and pushes changes via SSE/websocket so the view reflects new turns in real time.
- The server is just another renderer — store remains the single source of truth. Terminal ASCII and Mermaid export are sibling renderers that subscribe to the same store.

### Views (read-only commands)
- `/journey` — mindmap of the active goal (terminal ASCII)
- `/journey timeline` — chronological view of the same nodes (terminal ASCII)
- `/journey back N` — "what was I telling you N pings ago and what did you do with it"
- `/journey branch <node>` — zoom into a subtree
- `/journey serve` — start the local server for the rich browser view
- `/journey goals` — list all known goals
- `/journey attach <goal-id>` — manually attach current turn/conversation to a goal
- (No manual checkpoint or dead-end commands — both detected automatically)

---

## Open Questions to Refine

1. **Goal granularity** — **decided: any size.** A goal can be task-sized ("fix login redirect") or milestone-sized ("migrate to OAuth"). The plugin doesn't enforce a size — it just tracks the state-tree. Goal is one organizing dimension over the tree, not a separate hierarchy.
2. **Auto-goal detection** — **decided.** Approach:
   - **Tag every node with `conversation_id` (session id) in addition to `goal_id`.** Most goals run within a single conversation, so conversation boundary is a strong default signal.
   - Heuristics for goal boundaries within a conversation: topic shift, file scope change, explicit user phrasing ("now let's...", "switching to...").
   - **On a new conversation:** look up recent goals (last N days), compare new turn to their summaries, and propose continuation if a strong match exists. Otherwise start a new goal.
   - **Manual override always available:** user can explicitly attach the current turn / conversation to a specific existing goal, or force-start a new one.
3. **Node granularity** — **decided: every turn = one node.** Required so "back N pings" maps cleanly to N nodes. Tree stays narrow and deep; branches happen only on pivots, not on every turn.
4. **Branch detection** — **decided.** A new turn creates a *branch* (rather than a *continuation* under the prior node) when any pivot signal fires:
   - user redirection language ("no", "go back", "instead", "stop", "different approach")
   - abandoning current files for different ones
   - contradicting a prior decision
   - explicitly exploring an alternative
   Otherwise the new node is a straight continuation child of the prior node.
5. **State summary generation** — **decided: lazy LLM.** Capture raw metadata per turn (free); a small LLM call generates the one-line summary only when a view renders that node, then cache it on the node. Per-turn cost stays near zero; tokens only spent on what the user actually looks at.
6. **Storage shape** — JSON tree on disk. Each node: `{id, parent_id, goal_id, conversation_id, timestamp, kind: continuation|pivot|deadend|return, raw_meta, summary?}`. `summary` is filled lazily on view. Mindmap and timeline are both derived from this.
7. **Mindmap rendering** — **decided.** Two outputs from the same tree:
   - **Terminal ASCII** (default) — visual cues: `*` current frontier, `✗` dead-end, `↳` pivot child, plain branch otherwise.
   - **Mermaid export** — for richer/sharable view (e.g. paste into a markdown viewer).
8. **Token budget per node** — **decided: 3 enforcement layers.**
   1. Prompt the summary LLM with explicit cap ("≤20 words, single line, no preamble").
   2. Post-generation: truncate at word boundary if over.
   3. Display: terminal renderer caps label width per node so layout never breaks.
9. **Dead-end detection** — **decided: fully automated, no user overhead.** When a pivot is detected, the same LLM call infers (a) summary for the new node and (b) why the abandoned branch was abandoned, attaching the reason to the now-dead-ended prior node. User never has to write a "why it failed" note.
10. **Privacy / size** — store only summaries in the tree; full prompts stay in the transcript with a pointer. Keeps the journey store small and shareable.
11. **Integration with existing tools** — Claude Code already has `/resume`, transcripts, memory. Journey is the *navigable map*; transcripts are the *raw record*; memory is *durable facts*. Different layers.

---

## Capabilities — Draft List

**Automated capture (no user action)**
- [ ] Hook `UserPromptSubmit` + `Stop` to observe each turn
- [ ] Generate short state summary per turn (token-light)
- [ ] Decide: same node / new continuation node / new branch / dead-end / return-to-prior
- [ ] Auto-detect goal boundaries (topic / scope / explicit shift)
- [ ] Persist tree to `~/.claude/journeys/<goal-id>/tree.json`

**Goal management (mostly automatic)**
- [ ] Auto-create goal on first meaningful turn
- [ ] Tag every node with `conversation_id` + `goal_id`
- [ ] Auto-attach subsequent turns to active goal within a conversation
- [ ] On new conversation: match against recent goals; propose continuation or start new
- [ ] Manual override: `/journey attach <goal-id>` to force-attach current turn/conversation
- [ ] Manual override: rename / merge / split goals when auto-detection misses

**Terminal views (read-only commands, all derived from same tree)**
- [ ] `/journey` — ASCII mindmap of active goal
- [ ] `/journey timeline` — chronological view (nodes ordered by timestamp)
- [ ] `/journey back N` — show what was instructed N turns ago and what happened next
- [ ] `/journey branch <node>` — zoom into a subtree
- [ ] `/journey goals` — list known goals
- [ ] Visual markers for: current frontier, pivots, dead-ends, returns
- [ ] Lazy summary generation + per-node cache

**Local server (first-class rich view)**
- [ ] `/journey serve` — manually start a local web server (e.g. `localhost:7777`)
- [ ] **Homepage**: list all goals across projects, active goal highlighted
- [ ] **Per-goal view**: interactive mindmap (pan, zoom, click-to-expand)
- [ ] Toggle between mindmap and timeline of the same nodes
- [ ] Click a node → show originating turn (full prompt + response from transcript)
- [ ] Filter dead-ends on/off; filter by date range; filter by conversation
- [ ] **Live updates** via SSE/websocket when snapshot store changes
- [ ] Server is a renderer subscribing to the store — no special privileges over terminal

**Reflection (derived from tree)**
- [ ] Per-goal summary: branch count, dead-end count, depth, time span
- [ ] Pattern surfacing: recurring pivot reasons, ambiguity hotspots

**Stretch**
- [ ] Mermaid mindmap export for sharing
- [ ] Cross-goal pattern analysis
- [ ] Shareable goal-journey export

---

## Storage & Schema

### Where data lives
Use Claude Code's official plugin data dir: **`${CLAUDE_PLUGIN_DATA}`** — auto-created, survives plugin updates, user-global (spans projects). Right for us since goals can span projects.

```
${CLAUDE_PLUGIN_DATA}/
├── index.json                  # global registry of all goals (homepage data)
├── goals/
│   ├── g_<id>/
│   │   ├── tree.json           # the node tree for this goal
│   │   └── meta.json           # goal title, status, timestamps, project origin
│   └── ...
└── server.pid                  # set when /journey serve is running
```

Plugin layout follows Claude Code conventions:
```
journey-plugin/
├── .claude-plugin/plugin.json  # manifest
├── hooks/hooks.json            # UserPromptSubmit, Stop hooks
├── skills/                     # slash commands (/journey, /journey serve, etc.)
└── server/                     # bun server + static frontend
```

### `tree.json` — node schema

```json
{
  "goal_id": "g_abc123",
  "version": 1,
  "nodes": [
    {
      "id": "n_001",
      "parent_id": null,
      "conversation_id": "conv_xyz",
      "timestamp": "2026-04-27T10:32:00Z",
      "kind": "root | continuation | pivot | deadend | return",
      "pivot_signal": "redirection | file_scope | contradiction | alternative | null",
      "raw_meta": {
        "user_prompt_preview": "first ~200 chars",
        "transcript_pointer": { "session_id": "...", "turn_index": 12 },
        "files_touched": ["src/app.ts"],
        "tools_used": ["Edit", "Read"]
      },
      "summary": null,                 // filled lazily on view
      "summary_generated_at": null,
      "deadend_reason": null,          // filled when sibling pivots away
      "deadend_at": null
    }
  ]
}
```

Node fields are append-only except: `summary`, `summary_generated_at`, `kind` (can transition to `deadend`), `deadend_reason`, `deadend_at`. This keeps writes simple and conflict-free.

### `index.json` — homepage data

```json
{
  "goals": [
    {
      "id": "g_abc123",
      "title": "Design journey plugin",
      "status": "active | dormant | closed",
      "created_at": "...",
      "last_active_at": "...",
      "conversation_ids": ["conv_xyz", "conv_def"],
      "node_count": 17,
      "branch_count": 3,
      "deadend_count": 4,
      "project_dir": "/Users/.../dev"
    }
  ]
}
```

Active goal is whichever has the most recent `last_active_at`. Server homepage highlights it.

---

## Stack

**Runtime: Bun.** Ships with Claude Code, single binary, native TypeScript, and `Bun.serve()` is a one-line HTTP server. No reason to add Node + a framework.

**Server: single-file Bun script.**
- Serves static frontend assets from `server/public/`.
- JSON API: `GET /api/goals`, `GET /api/goals/:id/tree`, `GET /api/nodes/:id/turn` (full transcript turn), `POST /api/nodes/:id/summary` (trigger lazy summary).
- SSE endpoint `GET /api/events` — pushes `{type, goal_id, node_id}` when the snapshot store changes (file watcher on `${CLAUDE_PLUGIN_DATA}`).

**Frontend: plain HTML + CSS + vanilla JS.** No React, no build step. One `index.html`, one `app.js`, one `style.css`. Loads JSON from API, renders, subscribes to SSE.

**Graph rendering: canvas + tiny layout lib, virtualized.**
- React/React-Flow ruled out — too heavy for what is essentially "draw a tree."
- Mermaid ruled out for the live view — re-renders the entire SVG on every update, no virtualization, won't scale past a few hundred nodes. Keep Mermaid only for *export*.
- Recommend **Cytoscape.js** (~200kb, plain-JS API, canvas-rendered, viewport culling out of the box, handles thousands of nodes smoothly) — or hand-rolled canvas + `d3-hierarchy` (just the layout math, ~10kb) if minimizing deps matters more than feature richness.
- Either way: **canvas-based, with viewport culling**. Only nodes inside the visible rect get drawn. At low zoom, render collapsed cluster labels instead of individual nodes (level-of-detail). This is what makes "fast show-up display" possible at scale.
- Click-to-expand subtrees and a minimap for navigation handle the big-tree UX.

---

## Next Steps

- Decide: Cytoscape.js vs hand-rolled canvas + d3-hierarchy (richer-out-of-box vs lighter-deps).
- Write the plugin skeleton: `plugin.json`, `hooks/hooks.json`, one skill stub (`/journey`), and an empty Bun server.
- Implement capture path first (hooks → write to `tree.json`) before any rendering.
- First end-to-end: hooks capture → terminal ASCII view of the tree. Server comes after that works.
