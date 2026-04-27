---
description: Start the local web UI (mindmap, timeline, goals — switch in browser)
allowed-tools: Bash
argument-hint: "[KEY=VALUE ...]  e.g. CLAUDE_PLUGIN_DATA=/tmp/x JOURNEY_PORT=8080"
---

!node "${CLAUDE_PLUGIN_ROOT}/lib/server-control.mjs" start $ARGUMENTS
