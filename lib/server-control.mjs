#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync, openSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PATHS } from "./store.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const SERVER = join(__dirname, "..", "server", "server.mjs");
const PID_FILE = join(PATHS.DATA_DIR, "server.pid");
const LOG_FILE = join(PATHS.DATA_DIR, "server.log");
const PORT = process.env.JOURNEY_PORT || "7777";

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readPid() {
  if (!existsSync(PID_FILE)) return null;
  const pid = parseInt(readFileSync(PID_FILE, "utf8").trim(), 10);
  return Number.isFinite(pid) ? pid : null;
}

const cmd = process.argv[2] || "start";

if (cmd === "start") {
  const existing = readPid();
  if (existing && isAlive(existing)) {
    console.log(`journey server already running (pid ${existing})`);
    console.log(`http://localhost:${PORT}`);
    process.exit(0);
  }
  mkdirSync(PATHS.DATA_DIR, { recursive: true });
  const out = openSync(LOG_FILE, "a");
  const child = spawn(process.execPath, [SERVER], {
    detached: true,
    stdio: ["ignore", out, out],
    env: { ...process.env, JOURNEY_PORT: PORT },
  });
  child.unref();
  writeFileSync(PID_FILE, String(child.pid));
  console.log(`journey server started (pid ${child.pid})`);
  console.log(`http://localhost:${PORT}`);
  console.log(`logs: ${LOG_FILE}`);
} else if (cmd === "stop") {
  const pid = readPid();
  if (!pid || !isAlive(pid)) {
    console.log("journey server not running");
    if (existsSync(PID_FILE)) unlinkSync(PID_FILE);
    process.exit(0);
  }
  process.kill(pid, "SIGTERM");
  unlinkSync(PID_FILE);
  console.log(`journey server stopped (pid ${pid})`);
} else if (cmd === "status") {
  const pid = readPid();
  if (pid && isAlive(pid)) {
    console.log(`running (pid ${pid}) — http://localhost:${PORT}`);
  } else {
    console.log("not running");
  }
} else {
  console.log("usage: server-control.mjs start|stop|status");
  process.exit(1);
}
