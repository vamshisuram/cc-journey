# LinkedIn launch post

Two variants below — pick the tone that fits, or remix. Each is sized to fit LinkedIn's "see more" fold (~210 chars before the cut), with the rest reading as the unfold.

---

## Variant A — "the problem nobody fixes"

> Working with Claude Code for 3 hours, you scroll back to find what you instructed 5 prompts ago. You can't remember why you abandoned that approach. You're about to re-try the thing that didn't work.
>
> Linear scrollback is a terrible memory.
>
> So I built **Journey** — a Claude Code plugin that captures every prompt as a node in a **tree of conversation states**, with pivots branching the tree and dead-ends auto-explained.
>
> What it does:
> - 🌲 Mindmap + timeline of your conversation, generated automatically
> - ↳ Pivots branch the tree when you redirect; the abandoned path stays visible with the reason
> - 🎯 Goals span sessions — same goal across many conversations and days
> - 🪶 Lazy LLM summaries (≤20 words, cached, generated only when you look)
> - 🖥 Browser UI with Cytoscape mindmap + draggable minimap + live SSE updates
>
> No slash commands to remember. Capture is fully automatic. You just talk to Claude, and when you ask "wait, what did we try before?", you have an answer.
>
> Open source, MIT, install in three commands inside Claude Code:
>
> `/plugin marketplace add vamshisuram/claude-journey`
> `/plugin install journey@claude-journey`
> `/reload-plugins`
>
> 👉 https://github.com/vamshisuram/claude-journey
>
> #ClaudeCode #AnthropicClaude #DeveloperTools #AITools #OpenSource

---

## Variant B — "I built this in one conversation"

> I had a long conversation with Claude Code about how to make long conversations less painful.
>
> By the end of it, I had a working plugin. Recursive — and useful.
>
> Meet **Journey**: every prompt becomes a node in a tree, your pivots branch the tree, and dead-ends auto-mark themselves with the reason you abandoned them.
>
> The thing I keep coming back to:
> - You can see your own thinking shape — where you're focused, where you're flailing
> - You stop re-trying ideas you already abandoned (the dead-ends remember why)
> - "What did I tell you 3 prompts ago?" stops being a scrollback hunt
>
> Built with vanilla JS + Cytoscape for the mindmap (no React, no build step), Bun-compatible Node server with SSE, lazy Claude summaries that only fire when you actually open a node.
>
> The fun part: Journey itself is now in the journey. The design conversation that built it is one of the seeded demo goals — branches, dead-ends and all.
>
> Try it (three commands inside Claude Code):
> `/plugin marketplace add vamshisuram/claude-journey`
> `/plugin install journey@claude-journey`
> `/reload-plugins`
>
> 👉 https://github.com/vamshisuram/claude-journey
>
> #ClaudeCode #BuildInPublic #DeveloperTools #AnthropicClaude #AI

---

## Notes for posting

- Lead with a hook image: a screenshot of the OAuth-migration mindmap (3 dead-ends visible) is the most compelling visual. Saved at `/tmp/journey-demo` — `/journey-serve` it and screenshot.
- Don't over-hashtag; 5 max keeps it from looking spammy.
- First comment after posting: drop a 30-second screen recording of dragging the minimap and clicking through the OAuth tree. LinkedIn algorithm rewards comments-with-media.
- Tag @Anthropic / @Claude.ai if posting in a context where that's appropriate.
