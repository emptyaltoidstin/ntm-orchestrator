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
const { execFileSync } = require('child_process');
const lib = require('./lib');

// Skip for NTM-spawned agents — these hooks are for the orchestrator only.
if (lib.isSpawnedAgent()) process.exit(0);

const input = lib.readStdinJSON();
if (!input) lib.failOpen();

const toolName = input.tool_name || '';
const toolInput = input.tool_input || {};
if (toolName !== 'Bash') lib.failOpen();

const cmd = String(toolInput.command || '');
if (!cmd.trim()) lib.failOpen();

// -------------------------
// 1) Block bv TUI
// -------------------------
if (/^\s*bv\s*$/.test(cmd)) {
  lib.block('Bare bv launches TUI and blocks. Use: ntm --robot-plan or bv --robot-<...>.');
}
if (/\bbv\b/.test(cmd) && !/\bbv\b[^\n]*--robot-/.test(cmd)) {
  lib.block(
    'bv without --robot-* may launch TUI and block.\n' +
    '\nPreferred: ntm --robot-plan\n' +
    'Alternatives: bv --robot-triage, bv --robot-plan'
  );
}

if (/\bntm\b/.test(cmd)) {
  try {
    lib.ensureRuntimeDir();
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unable to initialize runtime directory';
    lib.block(`Runtime directory is not secure: ${msg}`);
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
    lib.block(
      'Non-robot ntm invocations are disallowed for orchestration.\n' +
      '\nUse robot mode equivalents:\n' +
      '  ntm status  →  ntm --robot-status\n' +
      '  ntm health  →  ntm --robot-health=<session>\n' +
      '  ntm spawn   →  ntm --robot-spawn=<session>\n' +
      '\nAllowed subcommands (no robot equivalent): ntm send, ntm kill, ntm save, ntm preflight'
    );
  }
}

// -------------------------
// 3) Write active session marker on spawn (block if another session is already live)
// -------------------------
const spawnMatch = cmd.match(/\bntm\b\s+--robot-spawn=([^\s]+)/);
if (spawnMatch) {
  const session = lib.safeSession(spawnMatch[1]);
  if (!session) {
    lib.block('Invalid empty session name for --robot-spawn.');
  }
  try {
    lib.ensureSecureDir(lib.sessionDir(session));
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unable to create session directory';
    lib.block(`Session runtime path is not secure: ${msg}`);
  }

  // Prevent silent orphaning: if the global index points to a different live session, block.
  try {
    const existing = JSON.parse(fs.readFileSync(lib.GLOBAL_INDEX, 'utf8'));
    if (existing?.session && existing.session !== session) {
      try {
        execFileSync(lib.TMUX_PATH, ['has-session', '-t', existing.session], { stdio: 'ignore', timeout: 2000 });
        // Session is still alive — block the new spawn.
        lib.block(`Another NTM session is already active (${existing.session}). Capture and kill it before spawning a new one.`);
      } catch {
        // Existing session is dead — stale index, safe to overwrite.
        try { lib.safeDeleteOwnedFile(lib.GLOBAL_INDEX); } catch {}
        try { lib.safeDeleteOwnedFile(lib.stateFile(existing.session)); } catch {}
      }
    }
  } catch {
    // No index or unreadable — proceed.
  }

  // Write session-scoped state file (atomic).
  try {
    lib.writeAtomic(
      lib.stateFile(session),
      JSON.stringify({ session, spawned_at: new Date().toISOString(), pid: process.pid }, null, 2)
    );
  } catch {
    // fail-open
  }

  // Write global index for stop.js discovery (atomic).
  try {
    lib.writeAtomic(
      lib.GLOBAL_INDEX,
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
function extractInlineMsg(command) {
  const match = command.match(/--msg(?:=|\s+)(?:"([^"]*)"|'([^']*)'|([^\s]+))/);
  if (!match) return null;
  return match[1] ?? match[2] ?? match[3] ?? '';
}

const inlineMsg = extractInlineMsg(cmd);
if (inlineMsg && inlineMsg.length > lib.MAX_INLINE_MSG_CHARS) {
  lib.block(`Inline --msg exceeds ${lib.MAX_INLINE_MSG_CHARS} chars. Write to ${lib.RUNTIME_DIR}/<session>/pane-<N>.md and send with --msg-file (robot) or --file (ntm send).`);
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
  let minIntervalSec = lib.MIN_POLL_INTERVAL_SEC;

  // Grace window: allow 10s health retries for the *active* session within 3 minutes of spawn.
  if (pollType === 'health' && session !== '__global__') {
    try {
      const sessionState = JSON.parse(fs.readFileSync(lib.stateFile(session), 'utf8'));
      const spawnedAtMs = Date.parse(sessionState?.spawned_at || '');
      const withinGrace = !Number.isNaN(spawnedAtMs) && (now - spawnedAtMs) <= lib.HEALTH_GRACE_WINDOW_MS;
      if (withinGrace) {
        minIntervalSec = lib.HEALTH_GRACE_INTERVAL_SEC;
      }
    } catch {
      // fail-open
    }
  }

  const pollFile = lib.lastPollFile(session);
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
    lib.block(`Polling too fast for ${key} (${deltaSec.toFixed(1)}s). Minimum is ${minIntervalSec}s.`);
  }

  state.last_poll_ms[key] = now;
  try {
    lib.writeAtomic(pollFile, JSON.stringify(state, null, 2));
  } catch {
    // ignore
  }
}

// -------------------------
// 6) Write save marker on `ntm save`
// -------------------------
// When ntm save <session> is executed, write a marker file that the kill check uses.
// This is more reliable than checking for output files in arbitrary directories.
const saveMatch = cmd.match(/\bntm\b\s+save\s+([^\s]+)/);
if (saveMatch) {
  const session = lib.safeSession(saveMatch[1]);
  if (!session) {
    lib.block('Invalid empty session name for ntm save.');
  }
  try {
    lib.ensureSecureDir(lib.sessionDir(session));
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unable to create session directory';
    lib.block(`Session runtime path is not secure: ${msg}`);
  }
  // Write save marker (atomic) — includes metadata for debugging
  try {
    lib.writeAtomic(
      lib.saveMarkerFile(session),
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
  const session = lib.safeSession(killMatch[1]);
  if (!session) {
    lib.block('Invalid empty session name for ntm kill.');
  }
  const markerPath = lib.saveMarkerFile(session);

  // Primary check: explicit save marker (written by section 6 above)
  let hasMarker = false;
  try {
    const markerData = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
    const savedAt = Date.parse(markerData?.saved_at || '');
    const ageMin = (Date.now() - savedAt) / 60000;
    // Marker must be recent (within SAVE_MARKER_TTL_MIN) and indicate save was attempted
    if (!Number.isNaN(savedAt) && ageMin <= lib.SAVE_MARKER_TTL_MIN && markerData?.save_attempted) {
      hasMarker = true;
    }
  } catch {
    // No marker or unreadable
  }

  if (!hasMarker) {
    lib.block(
      `Cannot kill session '${session}' without capturing output first.\n` +
      `\n` +
      `Run this command first:\n` +
      `  ntm save ${session} -o ./outputs\n` +
      `\n` +
      `Then retry the kill. This ensures agent work is preserved before termination.`
    );
  }

  // Deterministic cleanup: delete session-scoped state, poll, and save marker files.
  try { lib.safeDeleteOwnedFile(lib.stateFile(session)); } catch {}
  try { lib.safeDeleteOwnedFile(lib.lastPollFile(session)); } catch {}
  try { lib.safeDeleteOwnedFile(markerPath); } catch {}

  // Clear global index if it points to this session.
  try {
    const idx = JSON.parse(fs.readFileSync(lib.GLOBAL_INDEX, 'utf8'));
    if (idx && idx.session === session) {
      lib.safeDeleteOwnedFile(lib.GLOBAL_INDEX);
    }
  } catch {
    // ignore
  }
}

process.exit(0);
