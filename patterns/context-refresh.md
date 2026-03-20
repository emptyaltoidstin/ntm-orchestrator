# Context Refresh Pattern

## When to Refresh

Refresh an agent's context when:
- Agent sends a `[context-warning]` message via Agent Mail (proactive — preferred)
- `--robot-agent-health` reports context below 30% (detected during 30+ min polling)
- Agent performance degrades (slow, incomplete, confused responses)
- Agent stalls for >10 minutes without progress (after nudge attempt)
- Agent explicitly requests a fresh start

## Detection Priority

1. **`[context-warning]` inbox message** — agent self-reported, highest confidence. Agent has already saved state and stopped working.
2. **`--robot-agent-health` context percentage** — proactive detection during 30+ min polling window. Agent may still be working.
3. **Behavioral signals** — stall, degradation, confused output. Lowest confidence; nudge before refreshing.

## Platform-Specific Refresh Commands

| Platform | Refresh Command | Behavior |
|----------|-----------------|----------|
| Claude Code | `/clear` | Clears context, maintains session |
| Codex | `/new` | Starts new conversation in pane |
| Gemini | `/reset` | Resets context window |

## Procedure

### Step 1: Interrupt the Agent

If the agent is still working (detection via polling or behavioral signals, not `[context-warning]`), interrupt first to prevent mid-edit compaction:

```bash
ntm --robot-interrupt=<session> --panes=<N>
```

If the agent sent `[context-warning]`, it has already stopped — skip this step.

### Step 2: Wait for Settle

```bash
sleep 3
```

### Step 3: Capture State

Gather everything needed to build the continuation prompt:

```bash
RUNTIME_DIR="${NTM_ORCH_RUNTIME_DIR:-${XDG_RUNTIME_DIR:-/tmp}/ntm-orch-$(id -u)}"

# 1. Worker state JSON (authoritative progress)
cat "$RUNTIME_DIR/<session>/<pane_name>-state.json"

# 2. Git diff stat for the agent's file scope
git diff --stat -- <file_scope_paths>

# 3. Recent output (diagnostic backup)
ntm --robot-tail=<session> --panes=<N> --lines=100 > "$RUNTIME_DIR/<session>/pre-refresh-<N>.txt"
```

Also check Agent Mail for the agent's last message (especially `[context-warning]` or `[blocked]` messages):
```javascript
fetch_inbox(project_key, agent_name="Orchestrator")
// Filter for messages from this pane
```

### Step 4: Build Continuation Prompt

Fill `templates/agent-prompt-continuation.md` with the captured state:
- `{{worker_state_json}}` — from the state file
- `{{git_diff_stat}}` — from `git diff --stat`
- `{{last_agent_message}}` — from Agent Mail
- `{{refresh_count}}` — from `REFRESHES[pane]` (incremented this cycle)
- All original task variables from `<runtime>/<session>/manifest.json`

Write the filled template:
```bash
# Write to runtime dir (not the original prompt file)
RUNTIME_DIR="${NTM_ORCH_RUNTIME_DIR:-${XDG_RUNTIME_DIR:-/tmp}/ntm-orch-$(id -u)}"
# Write continuation prompt to: $RUNTIME_DIR/<session>/pane-<N>-continuation.md
```

### Step 5: Send Refresh Command

**Claude Code:**
```bash
ntm send <session> --pane=<N> "/clear" --json
```

**Codex:**
```bash
ntm send <session> --pane=<N> "/new" --json
```

### Step 6: Wait for Refresh

```bash
sleep 5
```

The agent needs time to process the refresh and initialize fresh context.

### Step 7: Send Continuation Prompt

```bash
RUNTIME_DIR="${NTM_ORCH_RUNTIME_DIR:-${XDG_RUNTIME_DIR:-/tmp}/ntm-orch-$(id -u)}"
ntm send <session> --pane=<N> --file="$RUNTIME_DIR/<session>/pane-<N>-continuation.md" --json
```

### Step 8: Update Tracking

Increment `REFRESHES[pane]` in state tracking and write updated `orchestrator-state.json`:

```
REFRESHES: {pane0: 0, pane1: 1, pane2: 0, ...}
                     ^ incremented
```

## Escalation Threshold

**After 2 refreshes on the same task without progress:**

1. Set `ESCALATION_NEEDED: systemic-failure`
2. Set `ESCALATION_REASON: Pane-N refreshed 2x without progress on task X`
3. Present options to user:
   - **A)** Reassign task to different agent
   - **B)** Split task into smaller pieces
   - **C)** Mark task as blocked, continue with others
   - **D)** Investigate manually

## Complete Example

```bash
# Scenario: Agent-2 sent [context-warning] via Agent Mail

RUNTIME_DIR="${NTM_ORCH_RUNTIME_DIR:-${XDG_RUNTIME_DIR:-/tmp}/ntm-orch-$(id -u)}"

# Step 1: Skip interrupt — agent already stopped after [context-warning]

# Step 3: Capture state
cat "$RUNTIME_DIR/myapp/cc_2-state.json"
git diff --stat -- src/components/
ntm --robot-tail=myapp --panes=2 --lines=100 > "$RUNTIME_DIR/myapp/pre-refresh-2.txt"
# Also: fetch_inbox() for last message from cc_2

# Step 4: Build continuation prompt from template
# Fill agent-prompt-continuation.md with captured data
# Write to: $RUNTIME_DIR/myapp/pane-2-continuation.md

# Step 5: Send refresh (Claude Code)
ntm send myapp --pane=2 "/clear" --json

# Step 6: Wait
sleep 5

# Step 7: Send continuation prompt
ntm send myapp --pane=2 --file="$RUNTIME_DIR/myapp/pane-2-continuation.md" --json

# Step 8: Update tracking
REFRESHES[pane2]=$((REFRESHES[pane2] + 1))

# Check escalation threshold
if [ ${REFRESHES[pane2]} -ge 2 ]; then
  ESCALATION_NEEDED="systemic-failure"
  ESCALATION_REASON="Pane-2 refreshed 2x without progress"
fi
```

## Anti-Patterns

| Bad | Good |
|-----|------|
| Refresh without capturing state | Capture worker state JSON + git diff first |
| Refresh on first sign of slowness | Wait 10+ minutes, try nudge first |
| Unlimited refreshes | Escalate after 2 without progress |
| Re-send original prompt after refresh | Build and send continuation prompt |
| No tracking | Maintain REFRESHES counter |
| Send `/clear` while agent is mid-edit | Interrupt first, then clear |
| Ignore `[context-warning]` messages | Treat as highest-priority intervention |

## Nudge Before Refresh

For behavioral detection (not `[context-warning]`), try a nudge before committing to refresh:

```bash
ntm send <session> --pane=<N> "Status check: What's your current progress on {{task_id}}? Any blockers?" --json
```

Wait 2-3 minutes. If no response or confused response, proceed with the full refresh procedure.

For `[context-warning]` messages, skip the nudge — the agent has already reported and stopped.
