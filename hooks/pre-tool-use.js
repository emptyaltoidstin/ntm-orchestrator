#!/usr/bin/env node
/**
 * ntm-orchestrator PreToolUse Hook (v1.1.0)
 *
 * Goal: enforce the skill's hard constraints at the tool boundary.
 *
 * Blocks:
 * - Any bv invocation without --robot-* (bare bv launches TUI)
 * - Stray human-oriented NTM subcommands (except send/kill/save which the orchestrator uses)
 * - Robot send with inline --msg > 2000 chars (forces --msg-file)
 * - Robot polling faster than 90s (for --robot-terse/--robot-status/--robot-tail/--robot-health/--robot-snapshot)
 * - ntm kill without recent capture via `ntm save` (capture-before-kill)
 *
 * Also writes lightweight local state for Stop hook in a private runtime dir:
 * - On robot spawn: <runtime>/<session>/state.json + <runtime>/active-session.json
 * - On kill: clears session-scoped markers and active-session index
 *
 * Exit codes:
 *   0 = allow
 *   2 = block (stderr shown)
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

// Skip for NTM-spawned agents — these hooks are for the orchestrator only.
// NTM sets pane titles like "session__cc_1" or "session__cod_2".
const tmuxPane = process.env.TMUX_PANE;
if (tmuxPane && process.env.TMUX) {
  try {
    const title = execFileSync(
      '/usr/bin/tmux',
      ['display-message', '-t', tmuxPane, '-p', '#{pane_title}'],
      { encoding: 'utf8', timeout: 2000 }
    ).trim();
    if (/__(?:cc|cod|gem)_\d+$/.test(title)) {
      process.exit(0);
    }
  } catch {
    // fail-open: can't determine pane title, continue with checks
  }
}

function failOpen() {
  process.exit(0);
}

let input;
try {
  input = JSON.parse(fs.readFileSync(0, 'utf8'));
} catch {
  failOpen();
}

const toolName = input.tool_name || '';
const toolInput = input.tool_input || {};
if (toolName !== 'Bash') failOpen();

const cmd = String(toolInput.command || '');
if (!cmd.trim()) failOpen();

const UID = typeof process.getuid === 'function' ? String(process.getuid()) : 'unknown';
const DEFAULT_RUNTIME_DIR = path.resolve(path.join(process.env.XDG_RUNTIME_DIR || os.tmpdir(), `ntm-orch-${UID}`));
const RUNTIME_DIR = path.resolve(process.env.NTM_ORCH_RUNTIME_DIR || DEFAULT_RUNTIME_DIR);

function safeSession(s) {
  const raw = String(s || '').trim();
  if (!raw) return '';
  return raw.replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 128);
}

function isInsideRuntime(candidatePath) {
  const abs = path.resolve(candidatePath);
  return abs === RUNTIME_DIR || abs.startsWith(`${RUNTIME_DIR}${path.sep}`);
}

function ensureSecureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true, mode: 0o700 });
  let st = fs.lstatSync(dirPath);
  if (!st.isDirectory() || st.isSymbolicLink()) {
    throw new Error(`Runtime path is not a real directory: ${dirPath}`);
  }
  if (typeof process.getuid === 'function' && st.uid !== process.getuid()) {
    throw new Error(`Runtime path not owned by current user: ${dirPath}`);
  }
  if ((st.mode & 0o077) !== 0) {
    fs.chmodSync(dirPath, 0o700);
    st = fs.lstatSync(dirPath);
    if ((st.mode & 0o077) !== 0) {
      throw new Error(`Runtime path must be mode 0700: ${dirPath}`);
    }
  }
}

function ensureRuntimeDir() {
  ensureSecureDir(RUNTIME_DIR);
}

function sessionDir(session) {
  return path.join(RUNTIME_DIR, safeSession(session));
}

function stateFile(session) {
  return path.join(sessionDir(session), 'state.json');
}

function lastPollFile(session) {
  return path.join(sessionDir(session), 'hook-last-poll.json');
}

const GLOBAL_INDEX = path.join(RUNTIME_DIR, 'active-session.json');

function block(message) {
  process.stderr.write(`BLOCKED: ${message}\n`);
  process.exit(2);
}

function safeDeleteOwnedFile(filePath) {
  const target = path.resolve(filePath);
  if (!isInsideRuntime(target)) {
    throw new Error(`Refusing to delete path outside runtime dir: ${target}`);
  }
  let st;
  try {
    st = fs.lstatSync(target);
  } catch {
    return;
  }
  if (st.isDirectory() || st.isSymbolicLink()) {
    throw new Error(`Refusing to delete non-regular file: ${target}`);
  }
  if (typeof process.getuid === 'function' && st.uid !== process.getuid()) {
    throw new Error(`Refusing to delete file not owned by current user: ${target}`);
  }
  fs.unlinkSync(target);
}

// Atomic write: write to temp file in same directory, then rename.
// rename(2) on the same filesystem is atomic on Linux.
function writeAtomic(filePath, data) {
  const dir = path.dirname(filePath);
  if (!isInsideRuntime(filePath)) {
    throw new Error(`Refusing to write outside runtime dir: ${filePath}`);
  }
  ensureSecureDir(dir);
  const tmp = path.join(dir, `.${path.basename(filePath)}.${process.pid}.tmp`);
  fs.writeFileSync(tmp, data, 'utf8');
  fs.renameSync(tmp, filePath);
}

// -------------------------
// 1) Block bv TUI
// -------------------------
if (/^\s*bv\s*$/.test(cmd)) {
  block('Bare bv launches TUI and blocks. Use: ntm --robot-plan or bv --robot-<...>.');
}
if (/\bbv\b/.test(cmd) && !/\bbv\b[^\n]*--robot-/.test(cmd)) {
  block('bv without --robot-* may launch TUI. Use: bv --robot-triage / bv --robot-plan, or prefer ntm --robot-plan.');
}

if (/\bntm\b/.test(cmd)) {
  try {
    ensureRuntimeDir();
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unable to initialize runtime directory';
    block(`Runtime directory is not secure: ${msg}`);
  }
}

// -------------------------
// 2) Block non-robot ntm invocations (except allowlisted subcommands)
// -------------------------
// Robot mode (--robot-*) is the primary interface for orchestration.
// Three subcommands lack robot equivalents and are allowed directly:
//   ntm send  — robot-send pastes but doesn't submit
//   ntm kill  — no robot-kill exists
//   ntm save  — no robot-copy exists
// Informational flags (--help, --version) are also allowed.
if (/\bntm\b/.test(cmd)) {
  const hasRobot = /\bntm\b\s+--robot-/.test(cmd);
  const allowInfo = /\bntm\b\s+(--help|-h|--version|version)\b/.test(cmd);
  const allowSend = /\bntm\b\s+send\b/.test(cmd);
  const allowKill = /\bntm\b\s+kill\b/.test(cmd);
  const allowSave = /\bntm\b\s+save\b/.test(cmd);
  const allowPreflight = /\bntm\b\s+preflight\b/.test(cmd);

  if (!hasRobot && !allowInfo && !allowSend && !allowKill && !allowSave && !allowPreflight) {
    block('Non-robot ntm invocations are disallowed for orchestration. Use robot mode or one of the allowed subcommands (send, kill, save).');
  }
}

// -------------------------
// 3) Write active session marker on spawn (block if another session is already live)
// -------------------------
const spawnMatch = cmd.match(/\bntm\b\s+--robot-spawn=([^\s]+)/);
if (spawnMatch) {
  const session = safeSession(spawnMatch[1]);
  if (!session) {
    block('Invalid empty session name for --robot-spawn.');
  }
  try {
    ensureSecureDir(sessionDir(session));
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unable to create session directory';
    block(`Session runtime path is not secure: ${msg}`);
  }

  // Prevent silent orphaning: if the global index points to a different live session, block.
  try {
    const existing = JSON.parse(fs.readFileSync(GLOBAL_INDEX, 'utf8'));
    if (existing?.session && existing.session !== session) {
      try {
        execFileSync('/usr/bin/tmux', ['has-session', '-t', existing.session], { stdio: 'ignore', timeout: 2000 });
        // Session is still alive — block the new spawn.
        block(`Another NTM session is already active (${existing.session}). Capture and kill it before spawning a new one.`);
      } catch {
        // Existing session is dead — stale index, safe to overwrite.
        try { safeDeleteOwnedFile(GLOBAL_INDEX); } catch {}
        try { safeDeleteOwnedFile(stateFile(existing.session)); } catch {}
      }
    }
  } catch {
    // No index or unreadable — proceed.
  }

  // Write session-scoped state file (atomic).
  try {
    writeAtomic(
      stateFile(session),
      JSON.stringify({ session, spawned_at: new Date().toISOString(), pid: process.pid }, null, 2)
    );
  } catch {
    // fail-open
  }

  // Write global index for stop.js discovery (atomic).
  try {
    writeAtomic(
      GLOBAL_INDEX,
      JSON.stringify({ session }, null, 2)
    );
  } catch {
    // fail-open
  }
}

// -------------------------
// 4) Enforce no inline mega-prompts
// -------------------------
// Check both --msg (robot-send) and inline prompts for ntm send
const msgMatch = cmd.match(/--msg=("([\s\S]*?)"|'([\s\S]*?)')/);
if (msgMatch) {
  const msg = msgMatch[2] ?? msgMatch[3] ?? '';
  if (msg.length > 2000) {
    block(`Inline --msg exceeds 2000 chars. Write to ${RUNTIME_DIR}/<session>/pane-<N>.md and send with --msg-file (robot) or --file (ntm send).`);
  }
}

// -------------------------
// 5) Enforce minimum polling interval (scoped by session + poll type)
// -------------------------
const pollMatch = cmd.match(/\bntm\b\s+--robot-(terse|status|tail|health|snapshot)(=([^\s]+))?\b/);
if (pollMatch) {
  const pollType = pollMatch[1];
  // Session resolution: explicit from command, or __global__ for session-less commands.
  // Never attribute global polling to the active session — prevents cross-polluting rate limits.
  const session = pollMatch[3] || '__global__';
  const key = `${session}|${pollType}`;

  const now = Date.now();
  let minIntervalSec = 90;

  // Grace window: allow 10s health retries for the *active* session within 3 minutes of spawn.
  if (pollType === 'health' && session !== '__global__') {
    try {
      const sessionState = JSON.parse(fs.readFileSync(stateFile(session), 'utf8'));
      const spawnedAtMs = Date.parse(sessionState?.spawned_at || '');
      const withinGrace = !Number.isNaN(spawnedAtMs) && (now - spawnedAtMs) <= 180_000;
      if (withinGrace) {
        minIntervalSec = 10;
      }
    } catch {
      // fail-open
    }
  }

  const pollFile = lastPollFile(session);
  let state = { last_poll_ms: {} };
  try {
    state = JSON.parse(fs.readFileSync(pollFile, 'utf8')) || state;
  } catch {
    // ignore
  }
  if (!state || typeof state !== 'object') state = { last_poll_ms: {} };
  if (!state.last_poll_ms || typeof state.last_poll_ms !== 'object') state.last_poll_ms = {};

  const last = Number(state.last_poll_ms[key] || 0);
  const deltaSec = (now - last) / 1000;
  if (last > 0 && deltaSec < minIntervalSec) {
    block(`Polling too fast for ${key} (${deltaSec.toFixed(1)}s). Minimum is ${minIntervalSec}s.`);
  }

  state.last_poll_ms[key] = now;
  try {
    writeAtomic(pollFile, JSON.stringify(state, null, 2));
  } catch {
    // ignore
  }
}

// -------------------------
// 6) Write save marker on `ntm save`
// -------------------------
// When ntm save <session> is executed, write a marker file that the kill check uses.
// This is more reliable than checking for output files in arbitrary directories.
function saveMarkerFile(session) {
  return path.join(sessionDir(session), 'saved.json');
}

const saveMatch = cmd.match(/\bntm\b\s+save\s+([^\s]+)/);
if (saveMatch) {
  const session = safeSession(saveMatch[1]);
  if (!session) {
    block('Invalid empty session name for ntm save.');
  }
  try {
    ensureSecureDir(sessionDir(session));
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unable to create session directory';
    block(`Session runtime path is not secure: ${msg}`);
  }
  // Write save marker (atomic) — includes metadata for debugging
  try {
    writeAtomic(
      saveMarkerFile(session),
      JSON.stringify({
        session,
        saved_at: new Date().toISOString(),
        save_attempted: true,
        save_succeeded: true, // Assume success; if ntm save fails, the command itself will error
        command: cmd.substring(0, 200), // Truncate for safety
      }, null, 2)
    );
  } catch {
    // fail-open: don't block save if marker write fails
  }
}

// -------------------------
// 7) Enforce capture-before-kill (save marker required)
// -------------------------
// ntm kill <session> --force  (no --robot-kill exists)
// The orchestrator MUST run `ntm save <session>` before killing.
// This converts "policy" into "cannot violate" — even under interrupt pressure.
const killMatch = cmd.match(/\bntm\b\s+kill\s+([^\s]+)/);
if (killMatch) {
  const session = safeSession(killMatch[1]);
  if (!session) {
    block('Invalid empty session name for ntm kill.');
  }
  const markerPath = saveMarkerFile(session);

  // Primary check: explicit save marker (written by section 6 above)
  let hasMarker = false;
  let markerData = null;
  try {
    markerData = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
    const savedAt = Date.parse(markerData?.saved_at || '');
    const ageMin = (Date.now() - savedAt) / 60000;
    // Marker must be recent (within 60 minutes) and indicate save was attempted
    if (!Number.isNaN(savedAt) && ageMin <= 60 && markerData?.save_attempted) {
      hasMarker = true;
    }
  } catch {
    // No marker or unreadable
  }

  if (!hasMarker) {
    block(
      `Cannot kill session '${session}' without capturing output first.\n` +
      `\n` +
      `Run this command first:\n` +
      `  ntm save ${session} -o ./outputs\n` +
      `\n` +
      `Then retry the kill. This ensures agent work is preserved before termination.`
    );
  }

  // Deterministic cleanup: delete session-scoped state, poll, and save marker files.
  try { safeDeleteOwnedFile(stateFile(session)); } catch {}
  try { safeDeleteOwnedFile(lastPollFile(session)); } catch {}
  try { safeDeleteOwnedFile(markerPath); } catch {}

  // Clear global index if it points to this session.
  try {
    const idx = JSON.parse(fs.readFileSync(GLOBAL_INDEX, 'utf8'));
    if (idx && idx.session === session) {
      safeDeleteOwnedFile(GLOBAL_INDEX);
    }
  } catch {
    // ignore
  }
}

process.exit(0);
