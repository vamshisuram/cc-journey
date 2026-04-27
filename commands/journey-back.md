---
description: Show the last N turns from the active goal (defaults to 5)
allowed-tools: Bash
argument-hint: "[N]"
---

!node "${CLAUDE_PLUGIN_ROOT}/lib/render.mjs" back $ARGUMENTS
