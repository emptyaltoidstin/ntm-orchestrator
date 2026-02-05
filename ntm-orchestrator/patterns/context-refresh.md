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
ntm --robot-copy=<session> --pane=<N> --last=100 --output=/tmp/ntm-orch-<session>-pre-refresh-<N>.txt
```

This preserves recent work in case you need to debug or reference it.

### Step 2: Send Refresh Command

**Claude Code:**
```bash
ntm --robot-send=<session> --pane=<N> --message="/clear"
```

**Codex:**
```bash
ntm --robot-send=<session> --pane=<N> --message="/new"
```

### Step 3: Wait for Refresh

```bash
sleep 5
```

The agent needs time to process the refresh and initialize fresh context.

### Step 4: Re-send Task Prompt

```bash
ntm --robot-send=<session> --pane=<N> --file=/tmp/ntm-orch-<session>-pane<N>.md
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
  ntm --robot-copy=myapp --pane=2 --last=100 --output=/tmp/ntm-orch-myapp-pre-refresh-2.txt
  
  # 2. Send refresh (Claude Code)
  ntm --robot-send=myapp --pane=2 --message="/clear"
  
  # 3. Wait
  sleep 5
  
  # 4. Re-send prompt
  ntm --robot-send=myapp --pane=2 --file=/tmp/ntm-orch-myapp-pane2.md
  
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
| Refresh without capturing state | Always `--robot-copy` first |
| Refresh on first sign of slowness | Wait 10+ minutes, try nudge first |
| Unlimited refreshes | Escalate after 2 without progress |
| Different prompt after refresh | Re-send original task prompt |
| No tracking | Maintain REFRESHES counter |

## Nudge Before Refresh

Before refreshing, try a nudge:

```bash
ntm --robot-send=<session> --pane=<N> --message="Status check: What's your current progress on {{task_id}}? Any blockers?"
```

Wait 2-3 minutes. If no response or confused response, proceed with refresh.
