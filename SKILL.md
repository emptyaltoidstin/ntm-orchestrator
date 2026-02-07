---
name: ntm-orchestrator
version: 1.0.0
description: |
  Spawn and orchestrate an ntm multi-agent session from within Claude Code.
  Plans work distribution, sends targeted prompts, monitors progress via
  polling, handles coordination through Agent Mail, collects results, and
  synthesizes a summary. Knows when to ask for human direction.
  Keywords: spawn agents, ntm session, orchestrate, multi-agent, fan out work.

trigger:
  - "spawn agents"
  - "ntm session"
  - "orchestrate agents"
  - "multi-agent session"
  - "fan out work"

skip_when:
  - "User wants to manually run ntm commands"
  - "Single-agent task that doesn't need orchestration"
  - "User is already inside an ntm-spawned pane"
---

# ntm-orchestrator

You are the orchestrator — the general who plans, dispatches, monitors, and collects. You never do implementation work yourself. You drive external agents via ntm and coordinate them through Agent Mail.

**You also know when to ask for direction.** Not every decision is yours to make.

## Hard Constraints

1. **Robot mode preferred.** Use `--robot-*` flags for NTM commands. Three exceptions where subcommands are required: `ntm send` (robot-send doesn't submit), `ntm kill` (no robot-kill), `ntm save` (no robot-copy). Always use `--json` with subcommands for structured output.
2. **No TUI commands.** Never run bare `bv` — it launches interactive TUI and blocks. Prefer `ntm --robot-plan` or use `bv --robot-*` flags.
3. **No inline mega-prompts.** If a prompt exceeds 2000 characters, write to `<runtime>/<session>/pane-<N>.md` and use `--file` (ntm send) or `--msg-file` (robot-send).
4. **Register in Agent Mail first** — before spawning any agents.
6. **Minimum 90s between polls** during active monitoring.
7. **Always capture output** before killing a session.
8. **Temp files go to a private runtime dir** (`${NTM_ORCH_RUNTIME_DIR:-${XDG_RUNTIME_DIR:-/tmp}/ntm-orch-$(id -u)}`) — never pollute the project tree.
9. **Pre-assign file scopes.** Every agent prompt must specify which files/dirs it may edit. **You enforce non-overlapping scopes** — this is orchestrator policy, not a property of any tool's output.
10. **Follow the project's AGENTS.md** — instruct spawned agents to do the same.
11. **Quality gates are non-negotiable.** Never accept a task as complete without passing gates.
12. **Escalate when required.** See the Escalation Matrix — some decisions require human input.

---

## NTM Robot Mode Reference

**All orchestrator interactions with NTM use robot mode.** This is the stable automation interface.

Runtime directory shorthand used below:

```bash
RUNTIME_DIR="${NTM_ORCH_RUNTIME_DIR:-${XDG_RUNTIME_DIR:-/tmp}/ntm-orch-$(id -u)}"
```

| Action | Command |
|--------|---------|
| Spawn session | `ntm --robot-spawn=<session> --spawn-cc=N --spawn-cod=M` |
| Send prompt (file) | `ntm send <session> --pane=N --file=/path/to/prompt.md --json` |
| Send prompt (inline) | `ntm send <session> --pane=N "short message" --json` |
| Send with narrow immutable context (rare) | `ntm send <session> --pane=N --file=/path -c file1 -c file2 --json` |
| Status (JSON) | `ntm --robot-status` |
| Session health | `ntm --robot-health=<session>` |
| Terse status | `ntm --robot-terse` |
| Tail output | `ntm --robot-tail=<session> --panes=1,2 --lines=30` |
| Save all output | `ntm save <session> -o /path/to/dir` |
| Execution plan | `ntm --robot-plan` |
| Kill session | `ntm kill <session> --force` |
| Interrupt pane | `ntm --robot-interrupt=<session> --panes=N` |
| Snapshot (full state) | `ntm --robot-snapshot` |
| Wait for idle | `ntm --robot-wait=<session> --wait-until=idle` |

See `references/ntm-commands.md` for detailed documentation.

---

## State Tracking

Maintain this block in your working memory. Update after every phase transition and every poll cycle.

```
SKILL: ntm-orchestrator
PHASE: [0-Planning | 0.5-ArchValidation | 1-Spawn | 2-Distribute | 3-Monitor | 4-Collect | 5-Synthesize | 6-Teardown]
SESSION: <name>
AGENTS: <total> total, <active> active, <complete> complete, <failed> failed
TASKS: <total> total, <assigned> assigned, <complete> complete
LAST_POLL: <ISO timestamp>
LAST_TERSE: <raw terse output or hash>
NEXT_POLL: <ISO timestamp>
INTERVENTIONS: <count>
REFRESHES: {pane0: 0, pane1: 0, ...}
ESCALATION_NEEDED: [none | scope-ambiguity | priority-conflict | systemic-failure | security | timeout | destructive-op | quality-bypass]
ESCALATION_REASON: <if applicable>
```

**When `ESCALATION_NEEDED` is not `none`, pause all other work and invoke AskUserQuestion immediately.**

---

## Escalation Matrix

### ALWAYS Escalate (Use AskUserQuestion)

| Trigger | Example | Why |
|---------|---------|-----|
| **Scope ambiguity** | "Should auth changes include the migration?" | Prevents scope creep |
| **Priority conflict** | Two P0 beads compete for same file | Human judgment needed |
| **Systemic failure** | 3+ agent failures in 5 minutes | Likely API outage or bad base state |
| **Security-sensitive** | Agent wants to modify `.env`, secrets, auth | Per AGENTS.md security rules |
| **Timeout approaching** | 50min of 60min elapsed, 40% incomplete | Human decides: extend or stop |
| **Destructive operation** | Agent wants to delete tests, drop tables | Irreversible actions need approval |
| **Quality gate bypass** | Agent asks to skip typecheck/lint/test | Gates are non-negotiable |
| **Manifest uncertainty** | Unclear how to decompose user's request | Better to ask than guess wrong |

### NEVER Escalate (Handle Yourself)

| Situation | Action |
|-----------|--------|
| Routine file reservation conflict | Arbitrate: earlier assignment wins |
| Single agent crash | NTM auto-restarts; only escalate after 3+ crashes |
| Simple code questions from agents | Answer from context or codebase |
| Git rebase instructions | Standard recovery pattern |
| Agent needs file context | Instruct agent to search/read in assigned scope first; use `-c` only for immutable references |

### Escalation Format

```
ESCALATION: <trigger-type>
SITUATION: <what happened>
OPTIONS:
  A) <option with tradeoffs>
  B) <option with tradeoffs>
  C) <option with tradeoffs>
RECOMMENDATION: <A/B/C or "need your judgment">
```

---

## Phase 0 — Intake & Planning

Determine what work to distribute. Three input modes:

### Mode A: Beads-Driven

```bash
br ready --json
ntm --robot-plan
```

**Prefer `ntm --robot-plan` over direct `bv` calls.** NTM is the integration hub and handles bv compatibility.

`ntm --robot-plan` returns parallel execution tracks as **advisory input**. The plan may suggest parallelizable work, but **you enforce non-overlapping file scopes** — this is orchestrator policy, not a guaranteed property of any tool's output.

**⚠️ CRITICAL: Never run bare `bv` — it launches TUI and blocks. If you must call bv directly, always use `bv --robot-*` flags.**

### Mode B: Freeform

The user describes work in natural language. Decompose into discrete tasks:
- Each task must have clear description, acceptance criteria, and file scope
- **You assign and enforce non-overlapping file scopes**
- **If the codebase is unfamiliar, proceed to Phase 0.5 first**

### Mode C: Plan File

The user provides a file path. Read it, extract task assignments, map each to an agent slot.

### Task Manifest

Regardless of mode, produce and present:

```
TASK MANIFEST
Session: <session-name>
Agent mix: <N> Claude Code, <M> Codex
Architecture: <discovery doc status>
Scope policy: Non-overlapping file scopes enforced by orchestrator
─────────────────────────────────────────────────────────────────
#  | Task ID/Label     | Agent | File Scope                | Description
1  | bd-101i           | cc    | packages/shared/src/*     | Refactor crypto types
2  | bd-102i           | cc    | packages/extension/src/   | Fix sidepanel layout
3  | improve-tests     | cod   | packages/shared/__tests__/| Add coverage
...

Quality gates: bun run typecheck && bun run lint && bun run test
Estimated duration: <X> minutes
```

**Wait for user confirmation before proceeding.** Use AskUserQuestion if:
- The manifest needs refinement
- You're uncertain how to decompose the work
- File scopes might overlap (must resolve before proceeding)

Default agent mix: `--spawn-cc=7 --spawn-cod=3`. Adjust based on task count and complexity.

Also write a machine-readable copy of the manifest to:
- `<runtime>/<session>/manifest.json`

This is used for audit/handoff and for hook-based validation.

Before spawning, run a scope-overlap check on the manifest:

```bash
RUNTIME_DIR="${NTM_ORCH_RUNTIME_DIR:-${XDG_RUNTIME_DIR:-/tmp}/ntm-orch-$(id -u)}"
MANIFEST="$RUNTIME_DIR/<session>/manifest.json"
jq -r '.tasks[] | .task_id as $id | .file_scope[] | "\($id)\t\(.)"' "$MANIFEST" | \
awk -F'\t' '{for(i=1;i<=n;i++){split(a[i],p,"\t"); if(index($2,p[2])==1||index(p[2],$2)==1){print "OVERLAP\t"p[1]"\t"$1"\t"p[2]"\t"$2; bad=1}} a[++n]=$0} END{exit bad}'
```

If this check reports overlap, revise scopes and do not proceed to Phase 1.

---

## Phase 0.5 — Architecture Validation (Conditional)

**Skip if:** Familiar codebase, user confirms architecture is known, or tasks are trivial/isolated.

**Run if:** Unfamiliar codebase, tasks span multiple components, no recent discovery docs.

### Check Discovery Freshness

```bash
if [ -f docs/architecture/discovery.md ]; then
  age=$(( $(date +%s) - $(stat -c %Y docs/architecture/discovery.md 2>/dev/null || echo 0) ))
  if [ $age -lt 3600 ]; then
    echo "Discovery valid (${age}s old)"
  else
    echo "Discovery stale (${age}s old)"
  fi
else
  echo "No discovery document"
fi
```

### If Missing or Stale

Options:
1. Run exploring-codebase skill as pre-step (~5-10 min)
2. Prompt first agent to run discovery before its task
3. Proceed without if user confirms architecture is known

### Validate the Plan

For large manifests or unfamiliar codebases, send `templates/plan-space-validation.md` to an agent before proceeding to Phase 1. Fill `{{manifest_or_bead_summary}}` with the task manifest. Catching problems in plan-space is far cheaper than fixing them after implementation.

---

## Phase 1 — Spawn & Register

### Step 1: Verify Robot Mode Availability (Non-Destructive)

Robot mode is required for this skill. Do a non-destructive capability check before proceeding:

```bash
# Non-destructive check: confirm robot interface exists
ntm --help | grep -q "--robot-" || {
  echo "NTM robot mode not available in this environment" >&2
  exit 1
}

# Optional sanity check: list sessions via robot interface
ntm --robot-status >/dev/null
```

If robot mode is unavailable, **do not fall back** to subcommands. Escalate to the user (AskUserQuestion) to upgrade/install the correct NTM.

### Step 2: Register orchestrator in Agent Mail

```javascript
register_agent({
  project_key: '<project-slug>',
  program: 'claude-code',
  model: 'opus-4',
  name: 'Orchestrator',
  task_description: 'ntm session orchestrator for <session-name>'
})
```

### Step 3: Spawn session

```bash
ntm --robot-spawn=<session> --spawn-cc=<N> --spawn-cod=<M> --spawn-dir=/path/to/project
```

If spawn fails, escalate (systemic failure) and stop.

**Operational note:** The PreToolUse hook writes runtime markers at `<runtime>/<session>/state.json` (session-scoped) and `<runtime>/active-session.json` (global index) on successful `--robot-spawn`. On `ntm kill`, these marker files are cleared via exact-path deletion. The Stop hook reads the global index to prevent accidental exit while a session is active.

**Runtime invariant:** Keep all orchestration artifacts under `<runtime>/<session>/` and avoid wildcard cleanup.

### Step 4: Verify health

```bash
ntm --robot-health=<session>
```

Parse JSON response. All agents must report healthy. If any fail, wait 10s and retry. After 3 failures, **escalate** (systemic failure).

### Step 5: Record pane mapping

Parse spawn/health output for pane indices. Map each pane to a task. Initialize:
- `REFRESHES: {pane0: 0, pane1: 0, ...}`
- `LAST_TERSE: ""`

---

## Phase 2 — Prompt Distribution

For each task in the manifest:

### Step 1: Build prompt

Use templates from `templates/`:
- `agent-prompt-bead.md` for Mode A
- `agent-prompt-freeform.md` for Mode B
- `agent-prompt-plan.md` for Mode C

Fill variables: `{{task_id}}`, `{{task_description}}`, `{{file_scope}}`, `{{acceptance_criteria}}`, `{{pane_name}}`, `{{session_name}}`, `{{project_slug}}`, `{{quality_gates}}`.

Prompt requirements for every worker:
- Run `cm context "<task description>" --json` before editing
- Maintain `<runtime>/<session>/<pane>-state.json` with the required schema
- On `FILE_RESERVATION_CONFLICT`, stop edits immediately and notify orchestrator

Mid-session templates (used during monitoring and collection, not initial assignment):
- `post-implementation-review.md` — self-review before orchestrator accepts completion
- `agent-peer-review.md` — cross-agent review (uses `{{review_target_pane}}`, `{{review_target_task_id}}`, `{{review_target_file_scope}}`)
- `intelligent-commit-grouping.md` — logical commit grouping as a final step
- `plan-space-validation.md` — manifest review during Phase 0.5

Write to `<runtime>/<session>/pane-<N>.md`.

### Step 2: Send prompt

**Use `ntm send` (not `--robot-send`)** — robot-send pastes text but doesn't submit it.

```bash
ntm send <session> --pane=<N> --file=<runtime>/<session>/pane-<N>.md --json
```

Use `-c` context attachments only when pointing at immutable or tiny reference files:
```bash
ntm send <session> --pane=<N> --file=<runtime>/<session>/pane-<N>.md -c docs/protocol.md --json
```

### Step 3: Stagger sends

Wait 2 seconds between sends to avoid thundering herd.

### Step 4: Verify activation

After all prompts sent, wait 30 seconds:
```bash
ntm --robot-status
```

Confirm all agents active. If any idle, re-send prompt once.

---

## Phase 3 — Monitoring Loop

### Core Principle: State JSON First, Tail as Fallback

Authoritative monitoring source order:
1. Worker pane state files (`<runtime>/<session>/<pane_name>-state.json`)
2. `--robot-status` JSON for session-level health
3. `--robot-tail` only when state files are stale/missing/invalid

Worker state schema:
`{task_id,status,files_modified,gates_passed,last_update_ts,blocker}`

`--robot-terse` remains a cheap change detector, not a structured source.

### Polling Cadence

| Window    | Interval | Primary Tool     | On Change                                |
|-----------|----------|------------------|-------------------------------------------|
| 0–2 min   | No poll  | —                | —                                         |
| 2–10 min  | 120s     | `--robot-terse`  | `--robot-status` + pane state-file reads  |
| 10–30 min | 180s     | `--robot-terse`  | `--robot-status` + state-file anomaly triage |
| 30+ min   | 300s     | `--robot-terse`  | `--robot-status` + `--robot-health`       |

### Each Poll Iteration

1. **Check escalation state.** If `ESCALATION_NEEDED != none`, wait for user response.

2. **Cheap change detection:**
   ```bash
   RUNTIME_DIR="${NTM_ORCH_RUNTIME_DIR:-${XDG_RUNTIME_DIR:-/tmp}/ntm-orch-$(id -u)}"
   current_terse=$(ntm --robot-terse)
   if [ "$current_terse" != "$LAST_TERSE" ]; then
     ntm --robot-status > "$RUNTIME_DIR/<session>/status.json"
     # Parse JSON for authoritative state
   fi
   LAST_TERSE="$current_terse"
   ```

3. **Read per-pane state files first:**
   - Load `"$RUNTIME_DIR/<session>/<pane_name>-state.json"` for each active pane
   - If `last_update_ts` is stale (>5 min), or file missing/invalid, mark pane anomaly

4. **Interpret status from JSON + state files:**
   - `error_count > 0` → `--robot-health=<session>`
   - stale/missing pane state with active task → `--robot-tail` fallback
   - `completion_pct == 100` → Phase 4

5. **Inbox check:** `fetch_inbox(project_key, agent_name="Orchestrator")`

6. **Update state tracking**

7. **Check escalation triggers**

8. **Calculate next poll time**

### Intervention Patterns

| Signal | Action |
|--------|--------|
| Agent asks domain question | Reply if clear; escalate if uncertain |
| Agent asks scope expansion | **ALWAYS escalate** |
| FILE_RESERVATION_CONFLICT | Worker must stop edits immediately; arbitrate/reassign |
| Agent crash | Auto-restart handles; escalate after 3+ |
| Agent stall (>10 min idle) | Nudge, inspect pane state; tail fallback only if needed |
| Agent completes task | Send `post-implementation-review.md` before accepting |
| Agent idle after completion | Redeploy with `agent-peer-review.md` to review another agent's work |
| Context exhaustion | Use refresh pattern |
| Investigation exceeds threshold | Delegate anomaly triage to a short-lived sub-agent |
| Quality gate failure | Agent must fix; do not accept completion |
| Destructive action request | **ALWAYS escalate** |

### Anomaly Delegation Threshold

Do not deep-dive implementation details in the orchestrator context.

- If anomaly diagnosis needs >3 orchestrator tool calls or >5 minutes:
  1. Snapshot current evidence (`status.json`, pane state JSON, latest inbox message)
  2. Spawn a focused triage sub-agent prompt
  3. Ask for: root cause, immediate next action, whether escalation is required

### Context Refresh Pattern

**Claude Code:**
```bash
ntm --robot-tail=<session> --panes=<N> --lines=100
ntm send <session> --pane=<N> "/clear" --json
sleep 5
ntm send <session> --pane=<N> --file=<runtime>/<session>/pane-<N>.md --json
```

**Codex:**
```bash
ntm send <session> --pane=<N> "/new" --json
sleep 5
ntm send <session> --pane=<N> --file=<runtime>/<session>/pane-<N>.md --json
```

Track in `REFRESHES[pane]`. After 2 refreshes without progress → escalate.

---

## Phase 4 — Results Collection

### Verify Quality Gates

**Before accepting completion:**
```bash
cat <runtime>/<session>/<pane_name>-state.json
```

Require gate evidence in pane state JSON and completion message.
If pane state is stale/missing/invalid, use fallback diagnostics:
```bash
ntm --robot-tail=<session> --panes=<N> --lines=80
```

Also require completion evidence to include:
- final pane state JSON
- `cm context` rule ids/summary (or explicit `cm unavailable`)

If gates didn't pass:
1. Send remediation: `ntm send <session> --pane=<N> "Quality gates required. Run: <gates>" --json`
2. Do NOT mark complete
3. Record in synthesis

If agent asks to bypass → **ESCALATE**

### Commit Changes

If agents have uncommitted work, send `templates/intelligent-commit-grouping.md` to have them organize changes into logical, well-documented commits before capture.

### Capture Outputs

```bash
ntm save <session> -o ./outputs
```

Creates per-pane timestamped files in the output directory.

### Gather Metadata

```bash
git log --oneline --since="<session_start_iso>"
br ready --json
```

### Release Reservations

```javascript
release_reservation({
  project_key: '<slug>',
  agent_name: '<pane_name>',
  paths: [<reserved_paths>]
})
```

---

## Phase 5 — Synthesis

Generate report using `templates/status-report.md`:
- Session summary
- Per-task results table
- Quality gate summary
- Conflicts & interventions log
- Escalations and decisions
- Failed tasks with next steps
- Remaining work
- Git state

Present to user. Ask:
1. Results satisfactory?
2. Retry failed tasks?
3. Follow-up beads needed?

---

## Phase 6 — Teardown

Ask user: kill session or keep running?

- Kill: `ntm kill <session> --force`
- Keep: inform user can `ntm attach <session>`

Runtime marker cleanup is handled by hook-managed exact-path deletion on `ntm kill`.

---

## Anti-Patterns

| Bad | Good |
|-----|------|
| `ntm spawn <session>` | `ntm --robot-spawn=<session>` |
| `ntm status` | `ntm --robot-status` |
| `ntm health <session>` | `ntm --robot-health=<session>` |
| `--robot-send --msg-file=...` (doesn't submit) | `ntm send --pane=N --file=... --json` |
| `--robot-kill=session` (doesn't exist) | `ntm kill session --force` |
| `--robot-copy=session` (doesn't exist) | `ntm save session` |
| Bare `bv` | `ntm --robot-plan` or `bv --robot-*` |
| Parse terse for data | Use terse as change detector, JSON for state |
| Treat tail as primary state | Use pane state JSON first; tail as fallback |
| Assume bv guarantees non-overlap | Enforce scope policy yourself |
| Inline 3000-char prompts | Write to file, use `--file` |
| Poll every 30s | Follow cadence table |
| Accept completion without gates | Verify gates or require remediation |
| Make scope decisions | Escalate scope ambiguity |

---

## Token Budget

| Tool | Tokens/call | Frequency (30min) | Total |
|------|-------------|-------------------|-------|
| `--robot-terse` | ~100 | ~12 | ~1,200 |
| `--robot-status` | ~300 | ~6 | ~1,800 |
| `fetch_inbox` | ~200 | ~12 | ~2,400 |
| `--robot-tail` | ~800 | ~3 | ~2,400 |
| `--robot-health` | ~300 | ~2 | ~600 |
| Collection | ~3,000 | 1 | ~3,000 |
| Synthesis | ~2,000 | 1 | ~2,000 |
| **Total** | | | **~14,400** |

If context runs low: write handoff to Agent Mail, create handoff bead, stop gracefully.
