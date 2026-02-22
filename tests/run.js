#!/usr/bin/env node
/*
 * Minimal hook test harness for ntm-orchestrator.
 *
 * Runs tests/scenarios.yaml against hook entrypoints by:
 * - writing any setup files
 * - piping JSON input to hook stdin
 * - asserting exit code and (optional) stderr substring
 *
 * Usage:
 *   node tests/run.js
 *   npm test
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const YAML = require('yaml');

const ROOT = path.resolve(__dirname, '..');
const SCENARIOS_PATH = path.join(ROOT, 'tests', 'scenarios.yaml');

const HOOKS = {
  pre_tool_use: path.join(ROOT, 'hooks', 'pre-tool-use.js'),
  stop: path.join(ROOT, 'hooks', 'stop.js'),
  subagent_stop: path.join(ROOT, 'hooks', 'subagent-stop.js'),
};

const TEST_RUNTIME_DIR = path.join(os.tmpdir(), 'ntm-orch-test-runtime');

function rmIfExists(p) {
  try {
    fs.rmSync(p, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

function mkdirpFor(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function materializeNowMacros(value) {
  // Supports:
  // - "__NOW_ISO__" -> current ISO timestamp
  // - "__NOW_MS__" -> Date.now() (number)
  // - "__NOW_MS_MINUS_<n>__" -> Date.now() - n (number)
  // - "__REPEAT_CHAR_<c>_<n>__" -> character c repeated n times
  if (typeof value === 'string') {
    if (value === '__NOW_ISO__') return new Date().toISOString();
    if (value === '__NOW_MS__') return Date.now();
    const m = value.match(/^__NOW_MS_MINUS_(\d+)__$/);
    if (m) return Date.now() - Number(m[1]);
    const repeatMatch = value.match(/^__REPEAT_CHAR_(\w)_(\d+)__$/);
    if (repeatMatch) return repeatMatch[1].repeat(Number(repeatMatch[2]));
    // Also support inline repeat macros within larger strings
    return value.replace(/__REPEAT_CHAR_(\w)_(\d+)__/g, (_match, char, count) => char.repeat(Number(count)));
  }
  if (Array.isArray(value)) return value.map(materializeNowMacros);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = materializeNowMacros(v);
    return out;
  }
  return value;
}

function writeJson(filePath, obj) {
  mkdirpFor(filePath);
  const normalized = materializeNowMacros(obj);
  fs.writeFileSync(filePath, JSON.stringify(normalized, null, 2), 'utf8');
}

function writeText(filePath, text) {
  mkdirpFor(filePath);
  fs.writeFileSync(filePath, String(text), 'utf8');
}

// Normalize hardcoded /tmp/ntm-orch-test-runtime paths for cross-platform compatibility.
// On Linux os.tmpdir() === '/tmp' so the YAML paths work as-is; on Windows/macOS they diverge.
const YAML_RUNTIME_PREFIX = '/tmp/ntm-orch-test-runtime';
function resolveTestPath(p) {
  if (p.startsWith(YAML_RUNTIME_PREFIX)) {
    return path.join(TEST_RUNTIME_DIR, p.slice(YAML_RUNTIME_PREFIX.length));
  }
  return p;
}

// Recursively resolve /tmp/ntm-orch-test-runtime paths in input objects
function resolveTestPaths(value) {
  if (typeof value === 'string') return resolveTestPath(value);
  if (Array.isArray(value)) return value.map(resolveTestPaths);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = resolveTestPaths(v);
    return out;
  }
  return value;
}

function applySetup(setup) {
  if (!setup || typeof setup !== 'object') return;

  // Allow multiple write blocks: write_file, write_file_2, write_file_anything
  for (const [key, spec] of Object.entries(setup)) {
    if (!key.startsWith('write_file')) continue;
    if (!spec || typeof spec !== 'object') continue;
    if (!spec.path || typeof spec.path !== 'string') continue;

    const resolvedPath = resolveTestPath(spec.path);

    if (spec.json !== undefined) {
      writeJson(resolvedPath, spec.json);
      continue;
    }
    if (spec.text !== undefined) {
      writeText(resolvedPath, spec.text);
      continue;
    }
  }
}

function runHook(hookPath, inputObj) {
  const res = spawnSync('node', [hookPath], {
    input: JSON.stringify(inputObj ?? {}),
    encoding: 'utf8',
    env: { ...process.env, NTM_ORCH_RUNTIME_DIR: TEST_RUNTIME_DIR },
  });
  return {
    code: typeof res.status === 'number' ? res.status : 0,
    stdout: res.stdout || '',
    stderr: res.stderr || '',
  };
}

function resetTmpState() {
  rmIfExists(TEST_RUNTIME_DIR);
  try { fs.mkdirSync(TEST_RUNTIME_DIR, { recursive: true, mode: 0o700 }); } catch {}

  // Clean up test artifacts written to ./outputs/ by capture-before-kill tests
  try {
    const outDir = path.resolve(process.cwd(), 'outputs');
    const files = fs.readdirSync(outDir);
    for (const f of files) {
      if (f.includes('trial01') || f.includes('_test_')) {
        rmIfExists(path.join(outDir, f));
      }
    }
  } catch {
    // outputs dir may not exist
  }
}

function loadScenarios() {
  const raw = fs.readFileSync(SCENARIOS_PATH, 'utf8');
  return YAML.parse(raw);
}

function main() {
  const doc = loadScenarios();

  let total = 0;
  let failed = 0;

  for (const [group, scenarios] of Object.entries(doc || {})) {
    if (!HOOKS[group]) continue;
    if (!Array.isArray(scenarios)) continue;

    const hookPath = HOOKS[group];
    for (const sc of scenarios) {
      total += 1;

      resetTmpState();
      applySetup(sc.setup);

      const expandedInput = resolveTestPaths(materializeNowMacros(sc.input));
      const { code, stderr } = runHook(hookPath, expandedInput);

      const expectedCode = Number(sc.expect_exit);
      const okCode = code === expectedCode;
      const okStderr = sc.expect_stderr_contains
        ? String(stderr).includes(String(sc.expect_stderr_contains))
        : true;

      if (!okCode || !okStderr) {
        failed += 1;
        console.error(`\nFAIL [${group}] ${sc.name || '(unnamed scenario)'}`);
        console.error(`  expected exit: ${expectedCode}, got: ${code}`);
        if (sc.expect_stderr_contains) {
          console.error(`  expected stderr to contain: ${JSON.stringify(sc.expect_stderr_contains)}`);
        }
        console.error('  stderr:');
        console.error(String(stderr).trimEnd() || '(empty)');
      } else {
        process.stdout.write(`PASS [${group}] ${sc.name}\n`);
      }
    }
  }

  // Final cleanup after all scenarios.
  resetTmpState();

  if (failed) {
    console.error(`\n${failed}/${total} scenarios failed.`);
    process.exit(1);
  }
  console.log(`\nAll ${total} scenarios passed.`);
  process.exit(0);
}

main();
