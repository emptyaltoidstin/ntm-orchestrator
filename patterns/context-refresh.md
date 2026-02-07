# Context Refresh Pattern

## When to Refresh

Refresh an agent's context when:
- Agent explicitly reports context exhaustion
- Agent performance degrades (slow, incomplete, confused)
- Agent stalls for >10 minutes without progress
- Agent requests a fresh start

## Platform-Specific Commands

| Platform | Refresh Command | Behavior |
|----------|-----------------|----------|
| Claude Code | `/clear` | Clears context, maintains session |
| Codex | `/new` | Starts new conversation in pane |
| Gemini | `/reset` | Resets context window |

## Procedure

### Step 1: Capture State Before Refresh

```bash
RUNTIME_DIR="${NTM_ORCH_RUNTIME_DIR:-${XDG_RUNTIME_DIR:-/tmp}/ntm-orch-$(id -u)}"
ntm --robot-tail=<session> --panes=<N> --lines=100 > "$RUNTIME_DIR/<session>/pre-refresh-<N>.txt"
```

This preserves recent work in case you need to debug or reference it.

### Step 2: Send Refresh Command

**Claude Code:**
```bash
ntm send <session> --pane=<N> "/clear" --json
```

**Codex:**
```bash
ntm send <session> --pane=<N> "/new" --json
```

### Step 3: Wait for Refresh

```bash
sleep 5
```

The agent needs time to process the refresh and initialize fresh context.

### Step 4: Re-send Task Prompt

```bash
ntm send <session> --pane=<N> --file=<runtime>/<session>/pane-<N>.md --json
```

The original task prompt should still be saved from Phase 2. Re-send it to restart the task.

### Step 5: Update Tracking

Increment `REFRESHES[pane]` in state tracking:

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
# Detect: Agent-2 stalled for 12 minutes
current_time=$(date +%s)
last_activity=<from status>
if [ $((current_time - last_activity)) -gt 720 ]; then
  # Stall detected, initiate refresh
  
  # 1. Capture state
  RUNTIME_DIR="${NTM_ORCH_RUNTIME_DIR:-${XDG_RUNTIME_DIR:-/tmp}/ntm-orch-$(id -u)}"
  ntm --robot-tail=myapp --panes=2 --lines=100 > "$RUNTIME_DIR/myapp/pre-refresh-2.txt"
  
  # 2. Send refresh (Claude Code)
  ntm send myapp --pane=2 "/clear" --json
  
  # 3. Wait
  sleep 5
  
  # 4. Re-send prompt
  ntm send myapp --pane=2 --file="$RUNTIME_DIR/myapp/pane-2.md" --json
  
  # 5. Update tracking
  REFRESHES[pane2]=$((REFRESHES[pane2] + 1))
  
  # 6. Check escalation threshold
  if [ ${REFRESHES[pane2]} -ge 2 ]; then
    ESCALATION_NEEDED="systemic-failure"
    ESCALATION_REASON="Pane-2 refreshed 2x without progress"
  fi
fi
```

## Anti-Patterns

| Bad | Good |
|-----|------|
| Refresh without capturing state | Capture tail/status first |
| Refresh on first sign of slowness | Wait 10+ minutes, try nudge first |
| Unlimited refreshes | Escalate after 2 without progress |
| Different prompt after refresh | Re-send original task prompt |
| No tracking | Maintain REFRESHES counter |

## Nudge Before Refresh

Before refreshing, try a nudge:

```bash
ntm send <session> --pane=<N> "Status check: What's your current progress on {{task_id}}? Any blockers?" --json
```

Wait 2-3 minutes. If no response or confused response, proceed with refresh.
