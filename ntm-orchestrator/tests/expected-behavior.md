# ntm-orchestrator v2.2 – Expected Behavior

This directory documents the contract the hooks enforce.

## Invariants enforced at tool boundary

1. **Robot-only NTM usage**: any `ntm` invocation without `--robot-*` is blocked, except three allowlisted subcommands (`send`, `kill`, `save`) and informational flags (`--help`, `--version`).
2. **No bv TUI**: bare `bv` (or bv without `--robot-*`) is blocked.
3. **Prompt safety**: inline `--msg` longer than 2000 chars is blocked; use `--file`.
4. **Polling cadence**: robot poll commands are limited to >=90s between calls (10s grace for health on active session within 3 min of spawn).
5. **Capture-before-kill**: `ntm kill` is blocked unless recent capture output exists.
6. **Single-session guard**: spawning a new session is blocked if the marker points to a different session that is still alive in tmux.

## Stop/abandon guard

If `/tmp/ntm-orch-__global__-active-session.json` (global index) exists, the Stop hook **reconciles against tmux** before blocking. Session-scoped state lives in `/tmp/ntm-orch-<session>-state.json`.

- If `tmux has-session` confirms the session is alive → block stop.
- If tmux says the session doesn't exist (or tmux is unavailable) → treat marker as stale, delete it, allow stop.

This prevents stale markers from deadlocking the orchestrator after crashes, OOM kills, or manual `tmux kill-session`.

## Spawned-agent skip

All three hooks detect NTM-spawned agents by checking the tmux pane title for patterns like `session__cc_1`, `session__cod_2`, `session__gem_1`. Spawned agents bypass all hook checks (exit 0 immediately). This prevents agents from reacting to hook error messages.

## Stderr safety

Hook error messages must not contain executable-looking commands (no `rm -f`, no `ntm --robot-kill`, no shell snippets). This prevents LLM agents from interpreting error output as instructions.

## Subagent completion evidence

If a subagent claims completion, it must include either:

- quality gate evidence (typecheck/lint/test), or
- an explicit verification note.

This prevents "looks done" completion without validation.

## Live-only tests

Some scenarios require a running tmux session and cannot be tested in the offline harness:

- **block_stop_live_session**: marker exists AND tmux session exists → exit 2
- **block_spawn_when_another_session_alive**: marker exists for live session X, spawning Y → exit 2

These must be verified manually via `ntm --robot-spawn`.
