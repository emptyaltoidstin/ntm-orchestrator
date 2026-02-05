# Error Recovery Patterns

## Agent Crash

### Detection
- `--robot-health=<session>` shows pane in error state
- `--robot-status` JSON shows `error_count > 0`
- Completion message missing after expected time

### Recovery

1. **Single crash:** `--spawn-auto-restart` handles automatically. Monitor for recovery.

2. **Repeated crashes (2x same pane):**
   ```bash
   # Check recent output for error
   ntm --robot-tail=<session> --panes=<N> --lines=50
   
   # If recoverable error visible, send guidance
   ntm --robot-send=<session> --pane=<N> --message="Retry with: <specific fix>"
   ```

3. **Systemic failure (3+ crashes in 5 min):**
   - Set `ESCALATION_NEEDED: systemic-failure`
   - Present options to user: continue, pause, or abort

### Anti-Pattern

Don't manually restart agents — let `--spawn-auto-restart` handle it. Only escalate after 3+ failures.

---

## Git Conflicts

### Detection
- Agent Mail message with subject containing "conflict" or "rebase"
- `--robot-tail` shows git error output

### Recovery

1. **Standard conflict:**
   ```bash
   ntm --robot-send=<session> --pane=<N> --message="Git conflict detected. Run:
   git fetch origin
   git rebase origin/main
   # Resolve conflicts in your assigned files only
   git add <files>
   git rebase --continue"
   ```

2. **Conflict in file outside agent's scope:**
   - Arbitrate: agent with file reservation handles conflict
   - Other agent waits or works on different task

3. **Stuck on conflict:**
   ```bash
   # Get current state
   ntm --robot-tail=<session> --panes=<N> --lines=100
   
   # Provide specific resolution commands
   ntm --robot-send=<session> --pane=<N> --file=/tmp/ntm-orch-<session>-conflict-help.md
   ```

---

## Context Exhaustion

### Detection
- Agent reports "context limit" or "token limit"
- Performance degradation (slow responses, incomplete work)
- Agent explicitly requests refresh

### Recovery: Context Refresh

**Claude Code panes:**
```bash
# 1. Capture state before refresh
ntm --robot-copy=<session> --pane=<N> --last=100 --output=/tmp/ntm-orch-<session>-pre-refresh-<N>.txt

# 2. Send refresh command
ntm --robot-send=<session> --pane=<N> --message="/clear"

# 3. Wait for refresh
sleep 5

# 4. Re-send task prompt with current state
ntm --robot-send=<session> --pane=<N> --file=/tmp/ntm-orch-<session>-pane<N>.md
```

**Codex panes:**
```bash
ntm --robot-send=<session> --pane=<N> --message="/new"
sleep 5
ntm --robot-send=<session> --pane=<N> --file=/tmp/ntm-orch-<session>-pane<N>.md
```

### Tracking

Increment `REFRESHES[pane]` after each refresh. After 2 refreshes on same task without progress:
- Set `ESCALATION_NEEDED: systemic-failure`
- Options: reassign task, split task smaller, or mark blocked

---

## Quality Gate Failure

### Detection
- Agent claims completion but `--robot-tail` shows failing gates
- Completion message lacks gate confirmation

### Recovery

1. **First failure:**
   ```bash
   ntm --robot-send=<session> --pane=<N> --message="Quality gates required before completion. Run:
   {{quality_gates}}
   
   Fix any failures before reporting complete."
   ```

2. **Repeated failure:**
   - Check if it's a test environment issue vs code issue
   - Provide specific guidance based on error output

3. **Agent requests bypass:**
   - Set `ESCALATION_NEEDED: quality-bypass`
   - Never approve bypass automatically

### Anti-Pattern

Don't accept completion without verifying gates. Check `--robot-tail` output for gate passage.

---

## File Reservation Conflict

### Detection
- Agent Mail reports FILE_RESERVATION_CONFLICT
- Two agents attempting same file

### Recovery

1. **Query current state:**
   ```javascript
   query_reservations({ project_key: 'slug' })
   ```

2. **Arbitrate:** Earlier reservation wins.

3. **Notify losing agent:**
   ```javascript
   send_message({
     project_key: 'slug',
     sender_name: 'Orchestrator',
     to: ['Pane-2'],
     subject: '[conflict] Wait for Pane-1',
     body_md: 'Pane-1 has reservation on these files. Wait for completion or work on different task.'
   })
   ```

4. **Options for waiting agent:**
   - Wait for other agent to complete
   - Work on unrelated task
   - If urgent, escalate for human decision

---

## Destructive Operation Request

### Detection
- Agent asks to delete tests, drop tables, remove files
- Agent wants to modify security-sensitive files (.env, secrets)

### Recovery

**Always escalate.** Set `ESCALATION_NEEDED: destructive-op` or `security`.

Present to user:
```
ESCALATION: destructive-op
SITUATION: Pane-2 requests to delete src/__tests__/auth.test.ts
OPTIONS:
  A) Approve deletion (tests may be obsolete)
  B) Deny - instruct agent to update tests instead
  C) Pause agent and investigate
RECOMMENDATION: B - prefer updating over deleting
```

---

## Multiple Simultaneous Failures

### Detection
- 3+ agents in error state simultaneously
- Multiple unrelated failures in short window

### Recovery

**Always escalate.** This indicates systemic issues.

```
ESCALATION: systemic-failure
SITUATION: 3 agents failed in last 5 minutes
  - Pane-1: API timeout
  - Pane-3: Git conflict
  - Pane-5: Process killed
OPTIONS:
  A) Continue monitoring (may recover)
  B) Pause all work and investigate
  C) Abort session and retry later
RECOMMENDATION: B - investigate before continuing
```

---

## Timeout Approaching

### Detection
- Session elapsed time > 80% of timeout
- Completion < 60% of assigned tasks

### Recovery

**Always escalate.** Human decides: extend, reduce scope, or stop.

```
ESCALATION: timeout
SITUATION: 48min of 60min elapsed, 4/10 tasks complete (40%)
OPTIONS:
  A) Extend timeout by 30 minutes
  B) Mark incomplete tasks as blocked, proceed to collection
  C) Prioritize specific tasks, abandon others
RECOMMENDATION: Need your judgment based on task priorities
```
