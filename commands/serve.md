---
description: Start the local web server for the rich mindmap/timeline view
allowed-tools: Bash
argument-hint: "[KEY=VALUE ...]  e.g. CLAUDE_PLUGIN_DATA=/tmp/x JOURNEY_PORT=8080"
---

!node "${CLAUDE_PLUGIN_ROOT}/lib/server-control.mjs" start $ARGUMENTS
