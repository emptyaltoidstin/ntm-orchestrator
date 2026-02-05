#!/usr/bin/env node
/**
 * ntm-orchestrator Stop Hook (v1.0.0)
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


const GLOBAL_INDEX = '/tmp/ntm-orch-__global__-active-session.json';


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


// If there is no active marker, allow.
if (!fs.existsSync(GLOBAL_INDEX)) {
  process.exit(0);
}


let active;
try {
  active = JSON.parse(fs.readFileSync(GLOBAL_INDEX, 'utf8'));
} catch {
  // Corrupt marker: delete and allow.
  try { fs.unlinkSync(GLOBAL_INDEX); } catch {}
  process.exit(0);
}


const session = active?.session;
if (!session) {
  try { fs.unlinkSync(GLOBAL_INDEX); } catch {}
  process.exit(0);
}


/**
 * Reconcile marker against reality (tmux is source of truth).
 * If the tmux session doesn't exist, the marker is stale and should not block stop.
 */
try {
  execFileSync('/usr/bin/tmux', ['has-session', '-t', session], { stdio: 'ignore', timeout: 2000 });
} catch {
  // tmux says session doesn't exist (or tmux unavailable) -> treat marker as stale and allow stop.
  // (Linux-only environment assumption; if tmux is unexpectedly unavailable, fail-open is safer than a deadlock.)
  try { fs.unlinkSync(GLOBAL_INDEX); } catch {}
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
