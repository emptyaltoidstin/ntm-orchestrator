#!/usr/bin/env node
/**
 * ntm-orchestrator Stop Hook (v1.1.0)
 *
 * Prevents the orchestrator from stopping while an NTM session is still marked active.
 * Reconciles marker state against tmux to avoid stale-marker deadlocks.
 *
 * Exit codes:
 *   0 = allow stop
 *   2 = block stop (stderr shown)
 */

const fs = require('fs');
const { execFileSync } = require('child_process');
const lib = require('./lib');

// Skip for NTM-spawned agents — these hooks are for the orchestrator only.
if (lib.isSpawnedAgent()) process.exit(0);

const input = lib.readStdinJSON();
if (!input) lib.failOpen();

try {
  lib.ensureSecureDir(lib.RUNTIME_DIR);
} catch {
  lib.failOpen();
}

// If there is no active marker, allow.
if (!fs.existsSync(lib.GLOBAL_INDEX)) {
  process.exit(0);
}

let active;
try {
  active = JSON.parse(fs.readFileSync(lib.GLOBAL_INDEX, 'utf8'));
} catch {
  // Corrupt marker: delete and allow.
  try { lib.safeDeleteOwnedFile(lib.GLOBAL_INDEX); } catch {}
  process.exit(0);
}

const session = active?.session;
if (!session) {
  try { lib.safeDeleteOwnedFile(lib.GLOBAL_INDEX); } catch {}
  process.exit(0);
}

/**
 * Reconcile marker against reality (tmux is source of truth).
 * If the tmux session doesn't exist, the marker is stale and should not block stop.
 */
try {
  execFileSync(lib.TMUX_PATH, ['has-session', '-t', session], { stdio: 'ignore', timeout: 2000 });
} catch {
  // tmux says session doesn't exist (or tmux unavailable) -> treat marker as stale and allow stop.
  try { lib.safeDeleteOwnedFile(lib.GLOBAL_INDEX); } catch {}
  process.exit(0);
}

// Session still exists -> block stop, but keep message non-executable.
process.stderr.write(
  `BLOCKED: An NTM tmux session is still active (session: ${session}).\n` +
  `\nTo proceed, either:\n` +
  `  - Complete your capture/cleanup workflow, then stop again, or\n` +
  `  - If you intentionally want to leave it running, clear the active-session marker.\n` +
  `\n(Note: this hook blocks only when tmux confirms the session still exists.)\n`
);

process.exit(2);
