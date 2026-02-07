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
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');


const UID = typeof process.getuid === 'function' ? String(process.getuid()) : 'unknown';
const DEFAULT_RUNTIME_DIR = path.resolve(path.join(process.env.XDG_RUNTIME_DIR || os.tmpdir(), `ntm-orch-${UID}`));
const RUNTIME_DIR = path.resolve(process.env.NTM_ORCH_RUNTIME_DIR || DEFAULT_RUNTIME_DIR);
const GLOBAL_INDEX = path.join(RUNTIME_DIR, 'active-session.json');


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

function isInsideRuntime(candidatePath) {
  const abs = path.resolve(candidatePath);
  return abs === RUNTIME_DIR || abs.startsWith(`${RUNTIME_DIR}${path.sep}`);
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


let input;
try {
  input = JSON.parse(fs.readFileSync(0, 'utf8'));
} catch {
  failOpen();
}

try {
  ensureSecureDir(RUNTIME_DIR);
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
  try { safeDeleteOwnedFile(GLOBAL_INDEX); } catch {}
  process.exit(0);
}


const session = active?.session;
if (!session) {
  try { safeDeleteOwnedFile(GLOBAL_INDEX); } catch {}
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
  try { safeDeleteOwnedFile(GLOBAL_INDEX); } catch {}
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
