# ntm-orchestrator Hooks

## Overview

This skill includes hooks that enforce the skill's hard constraints:

- **PreToolUse (Bash):** blocks unsafe/brittle orchestration commands (TUI, subcommands, poll-too-fast, kill-without-capture, etc.)
- **SubagentStop:** blocks "task complete" claims without verification evidence
- **Stop:** blocks stopping while an NTM session is still marked active

## Design Note: Capture-Before-Kill Enforcement (v2.3+)

### The Problem

During testing, we observed that when a user requests immediate termination ("kill it", "abort", "stop"), the orchestrator tends to comply immediately and skip protocol steps like capturing output. This happens because:

1. **User urgency signals** create a strong local objective to comply immediately
2. **Interrupt-driven phase collapse** — the agent jumps to the terminal action and skips "ancillary" steps
3. **Action bias** — once the kill command is conceptualized, the model executes it before reconsidering

Documentation-level fixes ("remember to save before killing") don't work under this pressure because instructions compete with explicit user intent, and user intent wins.

### The Solution

The hook enforces capture-before-kill at the **tool layer**, not the reasoning layer:

1. When `ntm save <session>` runs, the hook writes a **save marker**: `<runtime>/<session>/saved.json`
2. When `ntm kill <session>` runs, the hook checks for the marker
3. If no marker exists, the kill is **blocked** with instructions to save first

This converts "should save" into "cannot skip save." The agent cannot "decide" to skip under pressure because the action is gated.

### Key Principle

> **Interrupt ≠ skip protocol. Interrupt = compressed protocol.**

Even user-initiated aborts must: capture → synthesize → kill. The hook enforces the first step; skill documentation guides the rest.

## Installation

Add to your Claude Code hooks configuration (`~/.claude/settings.json`):

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node ~/.claude/skills/ntm-orchestrator/hooks/pre-tool-use.js",
            "timeout": 5
          }
        ]
      }
    ],
    "SubagentStop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "node ~/.claude/skills/ntm-orchestrator/hooks/subagent-stop.js",
            "timeout": 5
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node ~/.claude/skills/ntm-orchestrator/hooks/stop.js",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

**Notes:**
- `timeout` is in seconds (not milliseconds)
- `Stop` has no matcher support (always fires)
- `SubagentStop` matcher `""` matches all agent types
- If you have existing PreToolUse hooks (e.g., `dcg`), add the ntm hook as an additional entry in the same `hooks` array — they run in parallel

## pre-tool-use.js

### Purpose

Blocks:
- Any **NTM subcommand** invocation (orchestrator must use robot mode; `send`, `kill`, `save` exempted)
- `bv` without `--robot-*` (including bare `bv`)
- Inline `--msg=` longer than 2000 chars (forces `--msg-file` or `--file`)
- Polling faster than 90 seconds for: `--robot-terse/status/tail/health/snapshot`
- `ntm kill <session>` without a recent save (checks for save marker at `<runtime>/<session>/saved.json`)

Writes:
- Save marker on `ntm save <session>` — enables kill to proceed
- Session state on `--robot-spawn` — tracks active sessions

### Behavior

- **Exit 0:** Command allowed
- **Exit 2:** Command blocked, stderr contains explanation

### Why Robot Mode?

NTM's robot mode (`--robot-*` flags) is designed for automation:
- Consistent JSON output
- Stable interface across versions
- No interactive prompts
- Suitable for programmatic consumption

Human-oriented subcommands may:
- Launch TUI that blocks the session
- Have inconsistent output formats
- Change behavior between versions

### Testing

```bash
# Block: NTM subcommand
echo '{"tool_name":"Bash","tool_input":{"command":"ntm status"}}' | node hooks/pre-tool-use.js
echo $?  # expect 2

# Allow: robot status
echo '{"tool_name":"Bash","tool_input":{"command":"ntm --robot-status"}}' | node hooks/pre-tool-use.js
echo $?  # expect 0

# Block: bare bv
echo '{"tool_name":"Bash","tool_input":{"command":"bv"}}' | node hooks/pre-tool-use.js
echo $?  # expect 2

# Allow: bv robot
echo '{"tool_name":"Bash","tool_input":{"command":"bv --robot-plan"}}' | node hooks/pre-tool-use.js
echo $?  # expect 0

# Block: kill without save marker
echo '{"tool_name":"Bash","tool_input":{"command":"ntm kill test-session --force"}}' | node hooks/pre-tool-use.js
echo $?  # expect 2, message shows required save command

# Allow: save (writes marker)
echo '{"tool_name":"Bash","tool_input":{"command":"ntm save test-session -o ./outputs"}}' | node hooks/pre-tool-use.js
echo $?  # expect 0
cat "${NTM_ORCH_RUNTIME_DIR:-${XDG_RUNTIME_DIR:-/tmp}/ntm-orch-$(id -u)}/test-session/saved.json"  # marker should exist

# Allow: kill after save
echo '{"tool_name":"Bash","tool_input":{"command":"ntm kill test-session --force"}}' | node hooks/pre-tool-use.js
echo $?  # expect 0 (marker exists)
```

## stop.js

### Purpose

Prevents the orchestrator from exiting while an NTM session is still active. Checks for `<runtime>/active-session.json` (global index written by pre-tool-use.js on spawn, cleared on kill). Session-scoped state is stored in `<runtime>/<session>/state.json`.

- If marker exists with a valid session: **block** (exit 2) with instructions to capture+kill or clear
- If marker missing or corrupt: **allow** (exit 0)

## subagent-stop.js

### Purpose

Blocks subagent completion claims that lack quality gate evidence. Only triggers when BOTH conditions are true:

1. Output text contains a completion claim (`done`, `finished`, `task complete`, etc.)
2. No mention of gates (`typecheck`, `lint`, `test`) or verification (`verified`, `validated`, etc.)

Fail-open by default — if the payload is unparseable or doesn't claim completion, it allows.

## Marker Files Reference

The hooks use session-scoped marker files in a private runtime directory to track state:

```bash
RUNTIME_DIR="${NTM_ORCH_RUNTIME_DIR:-${XDG_RUNTIME_DIR:-/tmp}/ntm-orch-$(id -u)}"
```

| File | Written by | Purpose |
|------|-----------|---------|
| `<runtime>/<session>/state.json` | `--robot-spawn` | Tracks session spawn time, PID |
| `<runtime>/<session>/saved.json` | `ntm save` | Proves output was captured before kill |
| `<runtime>/<session>/hook-last-poll.json` | Poll commands | Rate-limits polling frequency |
| `<runtime>/active-session.json` | `--robot-spawn` | Global index for stop.js |

### Save Marker Format

```json
{
  "session": "my-session",
  "saved_at": "2026-02-05T20:45:16.959Z",
  "save_attempted": true,
  "save_succeeded": true,
  "command": "ntm save my-session -o ./outputs"
}
```

- **save_attempted**: Always `true` when marker is written (indicates save command was run)
- **save_succeeded**: Assumed `true`; if `ntm save` itself fails, the command errors before marker deletion matters
- Marker is deleted after a successful kill (cleanup)
- Marker expires after 60 minutes (stale markers don't gate kill)

### Cleanup

Session-scoped files are cleaned up via exact-path deletion when `ntm kill <session>` is allowed to proceed. No wildcard deletion is used.

Safety checks before delete:
- Path resolves inside runtime dir
- File is a regular file (no directory or symlink deletes)
- File is owned by the current user
