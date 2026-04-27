#!/usr/bin/env node
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, watch } from "node:fs";
import { join, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { readIndex, readTree, readMeta, writeMeta, writeIndex, setSummary, PATHS } from "../lib/store.mjs";
import { llm, PROMPTS, truncWords } from "../lib/llm.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const PUBLIC_DIR = join(__dirname, "public");
const PORT = parseInt(process.env.JOURNEY_PORT || "7777", 10);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

const sseClients = new Set();
const inFlight = new Map(); // dedupe concurrent LLM calls keyed by "kind:id"

function once(key, fn) {
  if (inFlight.has(key)) return inFlight.get(key);
  const p = Promise.resolve()
    .then(fn)
    .finally(() => inFlight.delete(key));
  inFlight.set(key, p);
  return p;
}

function sendJson(res, data, status = 200) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(data));
}

function notFound(res, msg = "not found") {
  res.writeHead(404, { "content-type": "text/plain" });
  res.end(msg);
}

function serveStatic(req, res, urlPath) {
  let rel = urlPath === "/" ? "/index.html" : urlPath;
  const safe = normalize(rel).replace(/^(\.\.[\/\\])+/g, "");
  const file = join(PUBLIC_DIR, safe);
  if (!file.startsWith(PUBLIC_DIR) || !existsSync(file) || !statSync(file).isFile()) {
    return notFound(res);
  }
  const mime = MIME[extname(file)] || "application/octet-stream";
  res.writeHead(200, { "content-type": mime, "cache-control": "no-cache" });
  res.end(readFileSync(file));
}

async function handleApi(req, res, urlPath) {
  if (urlPath === "/api/goals") {
    return sendJson(res, readIndex());
  }
  let mm = urlPath.match(/^\/api\/goals\/([^/]+)\/title$/);
  if (mm && req.method === "POST") {
    const goalId = mm[1];
    try {
      const title = await once(`title:${goalId}`, async () => {
        const meta = readMeta(goalId);
        if (!meta) throw new Error("goal not found");
        if (meta.title && meta.title !== "(untitled goal)") return meta.title;
        const tree = readTree(goalId);
        const first = tree.nodes[0];
        if (!first) return meta.title;
        const text = first.raw_meta?.user_prompt_preview || "";
        const raw = await llm(PROMPTS.title(text), { maxTokens: 40 });
        const cleaned = truncWords(raw.replace(/^["']|["']$/g, ""), 8);
        meta.title = cleaned || meta.title;
        writeMeta(goalId, meta);
        const idx = readIndex();
        const g = idx.goals.find((x) => x.id === goalId);
        if (g) {
          g.title = meta.title;
          writeIndex(idx);
        }
        return meta.title;
      });
      return sendJson(res, { title });
    } catch (e) {
      return sendJson(res, { error: String(e.message || e) }, 500);
    }
  }
  mm = urlPath.match(/^\/api\/nodes\/([^/]+)\/summary$/);
  if (mm && req.method === "POST") {
    const nodeId = mm[1];
    const goalId = req.headers["x-goal-id"];
    if (!goalId) return sendJson(res, { error: "x-goal-id header required" }, 400);
    try {
      const summary = await once(`summary:${goalId}:${nodeId}`, async () => {
        const tree = readTree(goalId);
        const node = tree.nodes.find((n) => n.id === nodeId);
        if (!node) throw new Error("node not found");
        if (node.summary) return node.summary;
        const text = node.raw_meta?.user_prompt_preview || "";
        const raw = await llm(PROMPTS.summary(text), { maxTokens: 80 });
        const cleaned = truncWords(raw, 20);
        setSummary(goalId, nodeId, cleaned);
        return cleaned;
      });
      return sendJson(res, { summary });
    } catch (e) {
      return sendJson(res, { error: String(e.message || e) }, 500);
    }
  }
  let m = urlPath.match(/^\/api\/goals\/([^/]+)\/tree$/);
  if (m) {
    const tree = readTree(m[1]);
    if (!tree.nodes.length && !existsSync(join(PATHS.GOALS_DIR, m[1], "tree.json"))) {
      return notFound(res, "goal not found");
    }
    return sendJson(res, tree);
  }
  m = urlPath.match(/^\/api\/goals\/([^/]+)\/meta$/);
  if (m) {
    const meta = readMeta(m[1]);
    if (!meta) return notFound(res, "goal not found");
    return sendJson(res, meta);
  }
  m = urlPath.match(/^\/api\/nodes\/([^/]+)\/turn$/);
  if (m) {
    const goalId = req.headers["x-goal-id"];
    if (!goalId) return sendJson(res, { error: "x-goal-id header required" }, 400);
    const tree = readTree(goalId);
    const node = tree.nodes.find((n) => n.id === m[1]);
    if (!node) return notFound(res, "node not found");
    return sendJson(res, {
      node,
      transcript_pointer: node.raw_meta?.transcript_pointer || null,
    });
  }
  if (urlPath === "/api/events") {
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });
    res.write(`event: hello\ndata: {"port":${PORT}}\n\n`);
    sseClients.add(res);
    req.on("close", () => sseClients.delete(res));
    return;
  }
  return notFound(res, "no such api");
}

function broadcast(event) {
  const msg = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(msg);
    } catch {
      sseClients.delete(client);
    }
  }
}

let watchTimer = null;
function startWatcher() {
  if (!existsSync(PATHS.DATA_DIR)) return;
  watch(PATHS.DATA_DIR, { recursive: true }, (_event, filename) => {
    if (!filename) return;
    if (watchTimer) clearTimeout(watchTimer);
    watchTimer = setTimeout(() => {
      broadcast({ type: "store_changed", filename: String(filename) });
    }, 100);
  });
}

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  if (path.startsWith("/api/")) {
    return handleApi(req, res, path).catch((e) => {
      try {
        sendJson(res, { error: String(e.message || e) }, 500);
      } catch {}
    });
  }
  return serveStatic(req, res, path);
});

server.listen(PORT, "127.0.0.1", () => {
  startWatcher();
  console.log(`journey server listening on http://localhost:${PORT}`);
  console.log(`data dir: ${PATHS.DATA_DIR}`);
});

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    server.close(() => process.exit(0));
  });
}
