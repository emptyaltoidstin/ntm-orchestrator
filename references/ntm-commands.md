# NTM Robot Mode Commands Reference

NTM (Named Tmux Manager) provides a robot mode interface designed for automation. **Always use robot mode** — it's the stable automation surface with consistent JSON output.

## Philosophy

- **Robot mode is the stable interface.** Human-oriented subcommands are designed for interactive use and may change.
- **Robot mode uses `--robot-*` flags.** These return structured JSON and are designed for programmatic consumption.
- **Three exceptions:** `ntm send`, `ntm kill`, and `ntm save` have no robot equivalents and must be used directly (with `--json` for structured output where available).

---

## Session Management

### Spawn Session

```bash
ntm --robot-spawn=<session> --spawn-cc=<N> --spawn-cod=<M>
```

| Flag | Description |
|------|-------------|
| `--robot-spawn=<session>` | Session name (required) |
| `--spawn-cc=<N>` | Number of Claude Code agents |
| `--spawn-cod=<M>` | Number of Codex agents |
| `--spawn-gmi=<K>` | Number of Gemini agents |
| `--spawn-dir=/path` | Working directory for the session |
| `--spawn-no-user` | Skip user pane (headless/automation) |
| `--spawn-wait` | Wait for all agents to initialize |
| `--spawn-preset=<name>` | Use a recipe preset instead of counts |
| `--spawn-safety` | Fail if session already exists |
| `--dry-run` | Preview without executing |

**Returns:** JSON with session details, pane indices, and agent types.

### Kill Session

**No `--robot-kill` exists.** Use the subcommand:

```bash
ntm kill <session> --force
```

| Flag | Description |
|------|-------------|
| `--force` | Skip confirmation prompt |
| `--summarize` | Generate summary before killing |
| `--json` | JSON output |

**Always capture output before killing** (see Output Capture below).

### List Sessions

```bash
ntm --robot-status
```

**Returns:** JSON with all sessions, panes, agent states, and metrics. This is the canonical way to list sessions — there is no separate `--robot-list`.

---

## Communication

### Send Prompt (Robot Mode)

⚠️ **Known issue:** `--robot-send` pastes text into the pane but does NOT press Enter to submit it to the agent. Use `ntm send` instead.

```bash
# Robot mode (pastes but doesn't submit — use ntm send instead)
ntm --robot-send=<session> --panes=<N> --msg-file=/path/to/prompt.md

# Recommended: use ntm send which properly submits
ntm send <session> --pane=<N> --file=/path/to/prompt.md --json
```

### Send Prompt (ntm send — recommended)

```bash
ntm send <session> --pane=<N> --file=/path/to/prompt.md --json
```

| Flag | Description |
|------|-------------|
| `--pane=<N>` | Target pane index |
| `--panes=1,2,3` | Multiple target panes |
| `--file=/path` | Read prompt from file |
| `--context=file1,file2` | Attach file contents (supports line ranges: `path:10-50`) |
| `--cc` | Send to all Claude agents |
| `--cod` | Send to all Codex agents |
| `--all` | Include user pane |
| `--broadcast` | Same prompt to all agents |
| `--json` | JSON output |
| `--delay=2s` | Delay between panes |
| `--dry-run` | Preview without sending |

For inline messages (short only):
```bash
ntm send <session> --pane=<N> "Short message here" --json
```

### Interrupt Pane

```bash
ntm --robot-interrupt=<session> --panes=<N>
```

Sends interrupt signal (Ctrl+C) to the pane. Use for stuck or runaway processes.

---

## Status & Monitoring

### Full Status (JSON)

```bash
ntm --robot-status
```

**Returns:** Authoritative JSON with all sessions, panes, states, and metrics.

**Use this for:** State updates, decision making, completion detection.

### Terse Status (Change Detection)

```bash
ntm --robot-terse
```

**Returns:** Single-line encoded state. Format may change between versions.

**Use this for:** Cheap change detection only. Compare to previous value; if different, fetch `--robot-status` for authoritative data.

**⚠️ Never parse terse output for structured data.** It's designed for change detection, not data extraction.

### Session Health

```bash
ntm --robot-health=<session>
```

**Returns:** JSON health report — agent states, error counts, memory usage, restarts.

### Agent Health (with provider usage — NTM v1.7.0+)

```bash
ntm --robot-agent-health=<session> --panes=2,3
```

Comprehensive health check combining local state and provider usage data. Includes token count, context usage metrics, and cost estimates per agent.

### Session Snapshot

```bash
ntm --robot-snapshot
```

**Returns:** Unified state: sessions + beads + alerts + mail. Use `--since=<ISO>` for delta.

### Tail Output

```bash
ntm --robot-tail=<session> --panes=1,2,3 --lines=30
```

**Returns:** Recent lines from specified panes. Useful for checking progress or errors.

### Wait for State

```bash
ntm --robot-wait=<session> --wait-until=idle
```

Blocks until agents reach target state. Options: `idle`, `complete`, `generating`, `healthy`.

Use `--wait-transition` after sending prompts to wait for a complete processing cycle.

---

## Output Capture

### Save All Output (ntm save)

**No `--robot-copy` exists.** Use the subcommand:

```bash
ntm save <session> -o /path/to/output/dir
```

Creates timestamped files per pane: `{session}_{pane-title}_{timestamp}.txt`

| Flag | Description |
|------|-------------|
| `-o /path` | Output directory (default: `./outputs`) |
| `-l <lines>` | Lines to capture (default: 2000) |
| `--cc` | Save Claude panes only |
| `--cod` | Save Codex panes only |
| `--all` | Save all panes including user |

### Tail for Quick Inspection

```bash
ntm --robot-tail=<session> --panes=<N> --lines=50
```

---

## Execution Planning

### Get Execution Plan

```bash
ntm --robot-plan
```

**Returns:** Parallelizable execution tracks from bv integration.

**⚠️ Important:** The plan is **advisory input**. The orchestrator is responsible for assigning and enforcing non-overlapping file scopes. Never assume the plan guarantees non-overlap.

---

## Prompt Validation (NTM v1.7.0+)

### Preflight Check

```bash
ntm preflight --file=/path/to/prompt.md --json
```

Validates a prompt file before sending. Checks structure, length, and runs DCG safety analysis. Use in Phase 2 before `ntm send` to catch issues early.

| Flag | Description |
|------|-------------|
| `--file=/path` | Prompt file to validate |
| `--json` | JSON output |
| `--strict` | Fail on warnings (not just errors) |

---

## Capability Detection

NTM versions may vary. Use a non-destructive check:

```bash
# Verify robot mode exists
ntm --help | grep -q "--robot-" && echo "Robot mode available"

# Verify sessions can be listed
ntm --robot-status >/dev/null 2>&1
```

**Always prefer robot mode.** The three subcommand exceptions (`send`, `kill`, `save`) are used because they have no robot equivalents.

---

## Common Patterns

### Initialize and Verify

```bash
# Spawn
ntm --robot-spawn=mysession --spawn-cc=5 --spawn-cod=3

# Wait for initialization
sleep 15

# Verify health
ntm --robot-health=mysession
```

### Send Prompts with Stagger

```bash
RUNTIME_DIR="${NTM_ORCH_RUNTIME_DIR:-${XDG_RUNTIME_DIR:-/tmp}/ntm-orch-$(id -u)}"
ntm send mysession --pane=2 --file="$RUNTIME_DIR/mysession/prompt-2.md" --json
sleep 2
ntm send mysession --pane=3 --file="$RUNTIME_DIR/mysession/prompt-3.md" --json
```

### Monitor Loop

```bash
# Cheap change detection
current=$(ntm --robot-terse)
if [ "$current" != "$LAST_TERSE" ]; then
  # Fetch authoritative state
  ntm --robot-status > "$RUNTIME_DIR/mysession/status.json"
fi
LAST_TERSE="$current"
```

### Graceful Shutdown

```bash
# Capture output
ntm save mysession

# Kill session
ntm kill mysession --force

# Runtime marker cleanup happens via hook-managed exact-path deletion on kill.
```

---

## Anti-Patterns

| Bad | Good |
|-----|------|
| `ntm spawn session` | `ntm --robot-spawn=session` |
| `ntm status` | `ntm --robot-status` |
| `ntm health session` | `ntm --robot-health=session` |
| `--robot-send --msg-file=...` (doesn't submit) | `ntm send --pane=N --file=... --json` |
| `--robot-kill=session` (doesn't exist) | `ntm kill session --force` |
| `--robot-copy=session` (doesn't exist) | `ntm save session` |
| Parse `--robot-terse` for data | Use terse as change detector only |
