# Journey

A Claude Code plugin that captures conversation states as a tree, so you can see how your thinking evolved across sessions and goals.

See `DISCUSSION.md` for the design rationale.

## Status: v0.1 skeleton

What works:
- `UserPromptSubmit` hook captures every turn into a per-goal tree.
- Heuristic pivot detection (redirection language → branch).
- Auto dead-end marking when a pivot fires.
- Terminal views: mindmap, timeline, back N, goals list.

What's stubbed / next:
- Lazy LLM summaries (today: heuristic — first ~15 words of prompt).
- Cross-conversation goal matching (today: one goal per session).
- Bun-served interactive web view with Cytoscape.js.

## Layout

```
journey-plugin/
├── .claude-plugin/plugin.json   # manifest
├── hooks/
│   ├── hooks.json                # UserPromptSubmit → capture.mjs
│   └── capture.mjs               # the per-turn capture script
├── commands/                     # slash commands
│   ├── journey.md                # /journey  → mindmap
│   ├── journey-timeline.md       # /journey-timeline
│   ├── journey-back.md           # /journey-back [N]
│   └── journey-goals.md          # /journey-goals
├── lib/
│   ├── store.mjs                 # read/write index.json + tree.json
│   ├── detect.mjs                # pivot detection + previews
│   └── render.mjs                # terminal ASCII renderer (CLI)
└── server/                       # (next iteration)
```

## Storage

Per Claude Code conventions, persistent data lives at `${CLAUDE_PLUGIN_DATA}`:

```
${CLAUDE_PLUGIN_DATA}/
├── index.json                    # all goals (homepage source)
└── goals/
    └── g_<id>/
        ├── tree.json             # nodes for this goal
        └── meta.json             # goal metadata
```

For local dev without the plugin installed, it falls back to `~/.claude/journey-plugin-data/`.

## Smoke test (no Claude Code install needed)

```sh
export CLAUDE_PLUGIN_DATA=/tmp/journey-test-data
rm -rf "$CLAUDE_PLUGIN_DATA"

echo '{"session_id":"s1","cwd":"/Users/me/dev","prompt":"build a plugin to track journeys"}' | node hooks/capture.mjs
echo '{"session_id":"s1","cwd":"/Users/me/dev","prompt":"add a timeline view"}' | node hooks/capture.mjs
echo '{"session_id":"s1","cwd":"/Users/me/dev","prompt":"actually lets switch to a tree approach"}' | node hooks/capture.mjs

node lib/render.mjs mindmap
node lib/render.mjs timeline
node lib/render.mjs back 3
node lib/render.mjs goals
```
