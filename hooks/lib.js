/**
 * ntm-orchestrator shared hook utilities (v1.1.0)
 *
 * Consolidates duplicated logic from pre-tool-use.js, stop.js, and
 * subagent-stop.js into a single module.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

// --- Named constants ---
const MAX_INLINE_MSG_CHARS = 2000;
const MIN_POLL_INTERVAL_SEC = 90;
const HEALTH_GRACE_INTERVAL_SEC = 10;
const HEALTH_GRACE_WINDOW_MS = 180_000; // 3 min post-spawn
const SAVE_MARKER_TTL_MIN = 60;         // stale markers don't gate kill
const SESSION_NAME_MAX_LENGTH = 128;

// --- Runtime directory ---
const UID = typeof process.getuid === 'function' ? String(process.getuid()) : 'unknown';
const DEFAULT_RUNTIME_DIR = path.resolve(
  path.join(process.env.XDG_RUNTIME_DIR || os.tmpdir(), `ntm-orch-${UID}`)
);
const RUNTIME_DIR = path.resolve(process.env.NTM_ORCH_RUNTIME_DIR || DEFAULT_RUNTIME_DIR);
const GLOBAL_INDEX = path.join(RUNTIME_DIR, 'active-session.json');

// --- Cross-platform tmux discovery ---
function findTmux() {
  for (const p of ['/usr/bin/tmux', '/opt/homebrew/bin/tmux', '/usr/local/bin/tmux']) {
    try { fs.accessSync(p, fs.constants.X_OK); return p; } catch {}
  }
  return 'tmux'; // fall back to PATH
}
const TMUX_PATH = findTmux();

// --- Spawned-agent detection ---
// NTM sets pane titles like "session__cc_1", "session__cod_2", "session__gem_3",
// "session__gmi_4", "session__oll_5".
const SPAWNED_AGENT_PANE_RE = /__(?:cc|cod|gem|gmi|oll)_\d+$/;

function isSpawnedAgent() {
  const tmuxPane = process.env.TMUX_PANE;
  if (!tmuxPane || !process.env.TMUX) return false;
  try {
    const title = execFileSync(
      TMUX_PATH,
      ['display-message', '-t', tmuxPane, '-p', '#{pane_title}'],
      { encoding: 'utf8', timeout: 2000 }
    ).trim();
    return SPAWNED_AGENT_PANE_RE.test(title);
  } catch {
    return false;
  }
}

// --- Session helpers ---
function safeSession(s) {
  const raw = String(s || '').trim();
  if (!raw) return '';
  return raw.replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, SESSION_NAME_MAX_LENGTH);
}

function sessionDir(session) { return path.join(RUNTIME_DIR, safeSession(session)); }
function stateFile(session) { return path.join(sessionDir(session), 'state.json'); }
function lastPollFile(session) { return path.join(sessionDir(session), 'hook-last-poll.json'); }
function saveMarkerFile(session) { return path.join(sessionDir(session), 'saved.json'); }

// --- Filesystem safety ---
function isInsideRuntime(candidatePath) {
  const abs = path.resolve(candidatePath);
  return abs === RUNTIME_DIR || abs.startsWith(`${RUNTIME_DIR}${path.sep}`);
}

function ensureSecureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true, mode: 0o700 });
  let st = fs.lstatSync(dirPath);
  if (!st.isDirectory() || st.isSymbolicLink()) {
    throw new Error(`Not a real directory: ${dirPath}`);
  }
  // Unix-only ownership and permission checks (NTFS uses ACLs, not mode bits)
  if (process.platform !== 'win32') {
    if (typeof process.getuid === 'function' && st.uid !== process.getuid()) {
      throw new Error(`Not owned by current user: ${dirPath}`);
    }
    if ((st.mode & 0o077) !== 0) {
      fs.chmodSync(dirPath, 0o700);
      st = fs.lstatSync(dirPath);
      if ((st.mode & 0o077) !== 0) {
        throw new Error(`Cannot set mode 0700: ${dirPath}`);
      }
    }
  }
}

function ensureRuntimeDir() { ensureSecureDir(RUNTIME_DIR); }

function safeDeleteOwnedFile(filePath) {
  const target = path.resolve(filePath);
  if (!isInsideRuntime(target)) {
    throw new Error(`Refusing to delete path outside runtime dir: ${target}`);
  }
  let st;
  try { st = fs.lstatSync(target); } catch { return; }
  if (st.isDirectory() || st.isSymbolicLink()) {
    throw new Error(`Refusing to delete non-regular file: ${target}`);
  }
  if (process.platform !== 'win32' && typeof process.getuid === 'function' && st.uid !== process.getuid()) {
    throw new Error(`Refusing to delete file not owned by current user: ${target}`);
  }
  fs.unlinkSync(target);
}

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

// --- Exit helpers ---
function failOpen() { process.exit(0); }
function allow() { process.exit(0); }
function block(message) {
  process.stderr.write(`BLOCKED: ${message}\n`);
  process.exit(2);
}

// --- stdin ---
function readStdinJSON() {
  try { return JSON.parse(fs.readFileSync(0, 'utf8')); } catch { return null; }
}

module.exports = {
  // Constants
  MAX_INLINE_MSG_CHARS, MIN_POLL_INTERVAL_SEC, HEALTH_GRACE_INTERVAL_SEC,
  HEALTH_GRACE_WINDOW_MS, SAVE_MARKER_TTL_MIN, SESSION_NAME_MAX_LENGTH,
  // Paths
  RUNTIME_DIR, GLOBAL_INDEX, TMUX_PATH, SPAWNED_AGENT_PANE_RE,
  // Functions
  isSpawnedAgent, safeSession, sessionDir, stateFile, lastPollFile,
  saveMarkerFile, isInsideRuntime, ensureSecureDir, ensureRuntimeDir,
  safeDeleteOwnedFile, writeAtomic, failOpen, allow, block, readStdinJSON,
};
