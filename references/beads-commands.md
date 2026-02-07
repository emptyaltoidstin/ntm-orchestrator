# Beads & Beads Viewer Commands Reference

This reference covers `br` (beads_rust CLI) and `bv` (beads_viewer) for task tracking integration.

## Philosophy

- **br** is the stable task operations interface (create, update, close)
- **bv** provides task intelligence (priority, planning, graphs)
- **Prefer `ntm --robot-plan`** over direct bv calls — NTM is the integration hub
- **Never run bare `bv`** — it launches TUI and blocks

---

## br (Beads CLI)

### Lifecycle Commands

```bash
# List ready beads (JSON)
br ready --json

# List all beads
br list --json

# Create bead
br create "Task title" -t feature -p 2 --json

# Update bead
br update <id> --status in_progress

# Close bead
br close <id> --reason "Completed per spec"
```

### Query Commands

```bash
# Get specific bead
br get <id> --json

# Filter by status
br list --status open --json

# Filter by type
br list --type bug --json

# Filter by assignee
br list --assignee "Agent-1" --json
```

### Dependency Commands

```bash
# Add dependency
br dep add <dependent-id> <dependency-id>

# Remove dependency
br dep remove <dependent-id> <dependency-id>

# Show dependency graph
br dep graph --json
```

### Label Commands

```bash
# Add label
br label add <id> orchestrator-session

# Remove label
br label remove <id> label-name

# Filter by label
br list --label orchestrator-session --json
```

---

## bv (Beads Viewer)

### ⚠️ Critical Warning

**Never run bare `bv`** — it launches an interactive TUI that blocks your session.

Always use `--robot-*` flags, or prefer `ntm --robot-plan`.

### Robot Mode Commands

```bash
# Triage view (priority-ordered)
bv --robot-triage

# Execution plan (parallelizable tracks)
bv --robot-plan

# Dependency graph
bv --robot-graph

# Sprint view
bv --robot-sprint
```

### TOON Format

bv robot commands return TOON (Token-Optimized Object Notation) format, designed for LLM consumption with minimal tokens.

Example:
```
TRIAGE[5 beads]
─────────────────
P0: bd-101i "Auth middleware" [feature] @Agent-1
P1: bd-102i "Fix layout" [bug] @Agent-2
P2: bd-103i "Add tests" [task] @unassigned
...
```

---

## Integration Patterns

### Get Ready Work

```bash
# Get beads ready for work
br ready --json

# Or use ntm integration
ntm --robot-plan
```

### Track Assignment

```bash
# Update bead with assignee
br update <id> --assignee "Pane-1"

# Add session label
br label add <id> ntm-session-<name>
```

### Mark Progress

```bash
# Start work
br update <id> --status in_progress

# Complete
br close <id> --reason "Implemented and tested"

# Block
br update <id> --status blocked --comment "Waiting on dependency"
```

### Create Follow-up

```bash
# Bug found during work
br create "Bug: Auth bypass on OPTIONS" -t bug -p 3 --json

# Sub-task
br create "Sub: Write unit tests" -t task -p 2 --parent <parent-id> --json
```

---

## Orchestrator Patterns

### Session Initialization

```bash
# Get execution plan
ntm --robot-plan > /tmp/plan.json

# Or via bv (with robot flag!)
bv --robot-plan > /tmp/plan.json
```

### Task Assignment

```bash
# For each task in manifest
br update <bead-id> --assignee "Pane-$N" --status in_progress
br label add <bead-id> ntm-session-<session>
```

### Completion Tracking

```bash
# On agent completion message
br close <bead-id> --reason "Completed. Quality gates passed."

# On failure
br update <bead-id> --status blocked --comment "Agent failed: $reason"
```

### Session Cleanup

```bash
# Get all beads for session
br list --label ntm-session-<session> --json

# Verify all closed or handled
```

---

## Anti-Patterns

| Bad | Good |
|-----|------|
| `bv` (bare) | `bv --robot-plan` or `ntm --robot-plan` |
| Assume bv plan guarantees non-overlap | Enforce scopes yourself |
| Parse bv output as stable format | Use JSON from br for authoritative data |
| Skip `--json` flag on br commands | Always use `--json` for automation |
