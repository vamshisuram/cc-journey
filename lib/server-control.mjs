#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync, openSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { applyEnvArgs } from "./args.mjs";
import { PATHS } from "./store.mjs";

const positional = applyEnvArgs(process.argv.slice(2));
const cmd = positional[0] || "start";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const SERVER = join(__dirname, "..", "server", "server.mjs");
const port = () => process.env.JOURNEY_PORT || "7777";
const pidFile = () => join(PATHS.DATA_DIR, "server.pid");
const logFile = () => join(PATHS.DATA_DIR, "server.log");

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readPid() {
  const f = pidFile();
  if (!existsSync(f)) return null;
  const pid = parseInt(readFileSync(f, "utf8").trim(), 10);
  return Number.isFinite(pid) ? pid : null;
}

if (cmd === "start") {
  const existing = readPid();
  if (existing && isAlive(existing)) {
    console.log(`journey server already running (pid ${existing})`);
    console.log(`http://localhost:${port()}`);
    console.log(`data dir: ${PATHS.DATA_DIR}`);
    process.exit(0);
  }
  mkdirSync(PATHS.DATA_DIR, { recursive: true });
  const out = openSync(logFile(), "a");
  const child = spawn(process.execPath, [SERVER], {
    detached: true,
    stdio: ["ignore", out, out],
    env: { ...process.env, JOURNEY_PORT: port() },
  });
  child.unref();
  writeFileSync(pidFile(), String(child.pid));
  console.log(`journey server started (pid ${child.pid})`);
  console.log(`http://localhost:${port()}`);
  console.log(`data dir: ${PATHS.DATA_DIR}`);
  console.log(`logs: ${logFile()}`);
} else if (cmd === "stop") {
  const pid = readPid();
  if (!pid || !isAlive(pid)) {
    console.log("journey server not running");
    if (existsSync(pidFile())) unlinkSync(pidFile());
    process.exit(0);
  }
  process.kill(pid, "SIGTERM");
  unlinkSync(pidFile());
  console.log(`journey server stopped (pid ${pid})`);
} else if (cmd === "status") {
  const pid = readPid();
  if (pid && isAlive(pid)) {
    console.log(`running (pid ${pid}) — http://localhost:${port()}`);
    console.log(`data dir: ${PATHS.DATA_DIR}`);
  } else {
    console.log("not running");
    console.log(`data dir: ${PATHS.DATA_DIR}`);
  }
} else {
  console.log("usage: server-control.mjs <start|stop|status> [KEY=VALUE ...]");
  console.log("  e.g. start CLAUDE_PLUGIN_DATA=/tmp/journey-test-data JOURNEY_PORT=8080");
  process.exit(1);
}
