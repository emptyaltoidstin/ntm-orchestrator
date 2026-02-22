# ntm-orchestrator Smoke Tests

Live integration tests that verify the full orchestration lifecycle.
Run these against a test project before using in production.

## Prerequisites

- [ ] ntm >= 1.7.0 with robot mode (`ntm --help | grep -q "--robot-"`)
- [ ] tmux running (`tmux ls` succeeds or starts a server)
- [ ] Agent Mail MCP server accessible
- [ ] br (beads_rust) installed
- [ ] Hooks configured per README.md
- [ ] A test project with quality gates (typecheck/lint/test)

## Environment Setup

```bash
# Runtime directory used by hooks for state/markers
RUNTIME_DIR="${NTM_ORCH_RUNTIME_DIR:-${XDG_RUNTIME_DIR:-/tmp}/ntm-orch-$(id -u)}"
```

---

## Smoke 1: Minimal Lifecycle (single agent, ~5 min)

Tests the full phase sequence: spawn → send → poll → save → kill → cleanup.

### 1. Spawn a single-agent session

```bash
env -u CLAUDECODE ntm --robot-spawn=smoke1 --spawn-cc=1 --spawn-dir=$(pwd)
```

- Expect: exit 0, JSON output with session info
- Verify: `$RUNTIME_DIR/smoke1/state.json` exists
- Verify: `$RUNTIME_DIR/active-session.json` contains `{"session":"smoke1"}`

### 2. Verify agent health

```bash
ntm --robot-health=smoke1
```

- Expect: all panes report healthy

### 3. Send a trivial prompt

```bash
cat > /tmp/smoke-prompt.md << 'EOF'
Echo "smoke test ok" to stdout, then stop.
EOF
ntm send smoke1 --pane=1 --file=/tmp/smoke-prompt.md --json
```

- Expect: exit 0, JSON confirmation

### 4. Wait and poll

```bash
sleep 95
ntm --robot-terse
ntm --robot-status
```

- Expect: terse output shows session state
- Expect: status JSON is parseable

### 5. Capture output

```bash
ntm save smoke1 -o ./outputs
```

- Expect: per-pane timestamped files created in `./outputs/`
- Verify: `$RUNTIME_DIR/smoke1/saved.json` exists (save marker)

### 6. Kill session

```bash
ntm kill smoke1 --force
```

- Expect: exit 0 (save marker from step 5 satisfies capture-before-kill)

### 7. Verify marker cleanup

```bash
test -f "$RUNTIME_DIR/smoke1/state.json" && echo "FAIL: state not cleaned" || echo "PASS"
test -f "$RUNTIME_DIR/smoke1/saved.json" && echo "FAIL: marker not cleaned" || echo "PASS"
test -f "$RUNTIME_DIR/active-session.json" && echo "FAIL: index not cleaned" || echo "PASS"
```

---

## Smoke 2: Hook Enforcement (offline, ~2 min)

Tests that hook block paths work without a live tmux session.

### 1. Block bare bv

```bash
echo '{"tool_name":"Bash","tool_input":{"command":"bv"}}' | node hooks/pre-tool-use.js
echo "exit: $?"  # expect 2
```

### 2. Block non-robot ntm

```bash
echo '{"tool_name":"Bash","tool_input":{"command":"ntm status"}}' | node hooks/pre-tool-use.js
echo "exit: $?"  # expect 2
```

### 3. Allow robot commands

```bash
echo '{"tool_name":"Bash","tool_input":{"command":"ntm --robot-status"}}' | node hooks/pre-tool-use.js
echo "exit: $?"  # expect 0
```

### 4. Block kill without save

```bash
echo '{"tool_name":"Bash","tool_input":{"command":"ntm kill test --force"}}' | node hooks/pre-tool-use.js
echo "exit: $?"  # expect 2, stderr mentions "capturing output"
```

### 5. Allow send subcommand

```bash
echo '{"tool_name":"Bash","tool_input":{"command":"ntm send test --pane=1 --file=/tmp/p.md --json"}}' | node hooks/pre-tool-use.js
echo "exit: $?"  # expect 0
```

---

## Smoke 3: Capture-Before-Kill Lifecycle (offline, ~1 min)

Tests the save marker → kill flow end-to-end through the hook.

```bash
export NTM_ORCH_RUNTIME_DIR=$(mktemp -d)
chmod 700 "$NTM_ORCH_RUNTIME_DIR"

# Step 1: Kill without save should fail
echo '{"tool_name":"Bash","tool_input":{"command":"ntm kill sess1 --force"}}' \
  | node hooks/pre-tool-use.js 2>/dev/null
echo "kill-without-save exit: $?"  # expect 2

# Step 2: Save writes marker
echo '{"tool_name":"Bash","tool_input":{"command":"ntm save sess1 -o ./outputs"}}' \
  | node hooks/pre-tool-use.js
echo "save exit: $?"  # expect 0
cat "$NTM_ORCH_RUNTIME_DIR/sess1/saved.json"  # marker should exist

# Step 3: Kill after save should succeed
echo '{"tool_name":"Bash","tool_input":{"command":"ntm kill sess1 --force"}}' \
  | node hooks/pre-tool-use.js
echo "kill-after-save exit: $?"  # expect 0

# Step 4: Kill again should fail (marker cleaned by step 3)
echo '{"tool_name":"Bash","tool_input":{"command":"ntm kill sess1 --force"}}' \
  | node hooks/pre-tool-use.js 2>/dev/null
echo "kill-again exit: $?"  # expect 2

# Cleanup
rm -rf "$NTM_ORCH_RUNTIME_DIR"
unset NTM_ORCH_RUNTIME_DIR
```

---

## Smoke 4: Stop Hook Reconciliation (offline, ~1 min)

Tests that stale markers don't deadlock the stop hook.

```bash
export NTM_ORCH_RUNTIME_DIR=$(mktemp -d)
chmod 700 "$NTM_ORCH_RUNTIME_DIR"

# Step 1: No marker → allow
echo '{"reason":"user_requested"}' | node hooks/stop.js
echo "no-marker exit: $?"  # expect 0

# Step 2: Stale marker (session doesn't exist in tmux) → reconcile and allow
echo '{"session":"nonexistent-session-xyz"}' > "$NTM_ORCH_RUNTIME_DIR/active-session.json"
echo '{"reason":"user_requested"}' | node hooks/stop.js
echo "stale-marker exit: $?"  # expect 0

# Verify stale marker was cleaned
test -f "$NTM_ORCH_RUNTIME_DIR/active-session.json" && echo "FAIL: stale marker not cleaned" || echo "PASS"

# Cleanup
rm -rf "$NTM_ORCH_RUNTIME_DIR"
unset NTM_ORCH_RUNTIME_DIR
```

---

## Smoke 5: Subagent Completion Evidence (offline, ~1 min)

Tests that completion claims without gate evidence are blocked.

```bash
export NTM_ORCH_RUNTIME_DIR=$(mktemp -d)
chmod 700 "$NTM_ORCH_RUNTIME_DIR"
TRANSCRIPT="$NTM_ORCH_RUNTIME_DIR/transcript.jsonl"

# Step 1: Completion without gates → block
echo '{"type":"assistant","message":{"content":[{"type":"text","text":"Task complete. Implemented the fix."}]}}' > "$TRANSCRIPT"
echo "{\"agent_transcript_path\":\"$TRANSCRIPT\"}" | node hooks/subagent-stop.js 2>/dev/null
echo "no-gates exit: $?"  # expect 2

# Step 2: Completion with gates → allow
echo '{"type":"assistant","message":{"content":[{"type":"text","text":"Task complete. Ran bun run test and lint passed."}]}}' > "$TRANSCRIPT"
echo "{\"agent_transcript_path\":\"$TRANSCRIPT\"}" | node hooks/subagent-stop.js
echo "with-gates exit: $?"  # expect 0

# Step 3: No completion claim → allow
echo '{"type":"assistant","message":{"content":[{"type":"text","text":"Still working on the refactor."}]}}' > "$TRANSCRIPT"
echo "{\"agent_transcript_path\":\"$TRANSCRIPT\"}" | node hooks/subagent-stop.js
echo "no-claim exit: $?"  # expect 0

# Cleanup
rm -rf "$NTM_ORCH_RUNTIME_DIR"
unset NTM_ORCH_RUNTIME_DIR
```

---

## Smoke 6: Multi-Agent Session (live, ~10 min)

Full orchestration test with multiple agents. Adapt task descriptions to your test project.

### 1. Spawn multi-agent session

```bash
env -u CLAUDECODE ntm --robot-spawn=smoke6 --spawn-cc=2 --spawn-cod=1 --spawn-dir=$(pwd)
```

### 2. Verify all agents healthy

```bash
ntm --robot-health=smoke6
```

### 3. Send different prompts to each pane

```bash
# Pane 1: simple task
echo 'Add a comment to the main entry point explaining what it does.' > /tmp/pane1.md
ntm send smoke6 --pane=1 --file=/tmp/pane1.md --json
sleep 2

# Pane 2: another simple task
echo 'List all exported functions in the project and verify their JSDoc.' > /tmp/pane2.md
ntm send smoke6 --pane=2 --file=/tmp/pane2.md --json
sleep 2

# Pane 3: codex task
echo 'Write a unit test for the main module.' > /tmp/pane3.md
ntm send smoke6 --pane=3 --file=/tmp/pane3.md --json
```

### 4. Monitor (wait 2+ minutes, then poll)

```bash
sleep 120
ntm --robot-terse
ntm --robot-status
```

### 5. Capture and teardown

```bash
ntm save smoke6 -o ./outputs
ntm kill smoke6 --force
```

### 6. Verify outputs

```bash
ls -la ./outputs/ | grep smoke6
```

---

## Expected Results Summary

| Smoke | Type | Duration | Pass Criteria |
|-------|------|----------|---------------|
| 1 | Live | ~5 min | Full lifecycle completes, markers cleaned |
| 2 | Offline | ~2 min | All block/allow assertions match |
| 3 | Offline | ~1 min | Save-then-kill flow works, re-kill blocked |
| 4 | Offline | ~1 min | Stale markers reconciled, stop allowed |
| 5 | Offline | ~1 min | Completion gating works correctly |
| 6 | Live | ~10 min | Multi-agent session completes with outputs |
