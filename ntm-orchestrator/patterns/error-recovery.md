# Error Recovery Patterns

## Agent Crash

**Detection:** `ntm health <session> --json` shows agent unhealthy, or `E > 0` in terse output.

**Recovery:**
1. `--auto-restart` handles most crashes automatically
2. If same agent crashes 3+ times, mark its task as failed
3. If panes are available, spawn a replacement: `ntm add <session> --cc=1`
4. Send the failed task's prompt to the new pane
5. Record the failure in the intervention log

## Context Window Exhaustion

**Detection:** Agent output contains handoff message, or agent goes idle mid-task with no completion message.

**Recovery:**
1. Capture current output: `ntm copy <session>:<pane> --last 300 --output /tmp/ntm-orch-<session>-handoff-<pane>.txt`
2. Read the handoff to understand progress
3. If a replacement pane is available, send a continuation prompt that includes:
   - What was already done (from the handoff)
   - What remains
   - The original file scope
4. If no panes available, note the partial completion and include it in the synthesis

## FILE_RESERVATION_CONFLICT

**Detection:** Agent reports conflict via Agent Mail, or reservation call returns conflict.

**Recovery:**
1. Determine which agent has priority (earlier assignment wins)
2. Send the conflicting agent a narrowed scope or different task
3. If scopes genuinely need to overlap, coordinate sequential access:
   - Agent A finishes and releases → Agent B proceeds
   - Use Agent Mail thread to coordinate the handoff

## Git Merge Conflict

**Detection:** Agent reports push failure or merge conflict via Agent Mail.

**Recovery:**
1. Instruct the agent to:
   ```
   git pull --rebase
   # resolve conflicts
   git add <resolved-files>
   git rebase --continue
   git push
   ```
2. If the agent can't resolve (conflicting changes from another agent):
   - Identify which agent's changes should take precedence
   - Instruct the lower-priority agent to `git stash`, pull, then re-apply on top
3. If persistent, this usually means file scopes weren't properly non-overlapping. Note for future manifest improvement.

## Rate Limiting

**Detection:** Agent output shows rate limit errors, or agent goes idle unexpectedly.

**Recovery:**
1. ntm has a `rotate` command for API key rotation: `ntm rotate <session>`
2. If rotation isn't available, redistribute the task to a different agent type
3. Note the rate-limited agent type in the synthesis (helps plan future sessions)

## Agent Stall

**Detection:** Agent shows idle for >10 minutes with no completion message and no questions in Agent Mail.

**Recovery:**
1. First, nudge: `ntm send <session> -p <pane> "Status check: are you blocked? Reply via Agent Mail if you need help."`
2. Wait 2 minutes for response
3. If no response, check output: `ntm --robot-tail <session> --panes=<pane> --lines=50`
4. If the agent is genuinely stuck (looping, confused), interrupt: `ntm interrupt <session>`
5. Re-send the prompt or reassign to a different pane

## Timeout

**Detection:** Session duration exceeds the configured timeout (default: 60 minutes).

**Recovery:**
1. Do NOT immediately kill the session
2. Check which agents are still working vs idle
3. For working agents, send: "You have 5 minutes to wrap up. Commit what you have and send a status message."
4. Wait 5 minutes
5. Proceed to Phase 4 (Results Collection) regardless
6. Mark incomplete tasks in the synthesis report

## Multiple Simultaneous Failures

If 3+ agents fail within a 5-minute window:
1. Pause and assess — this likely indicates a systemic issue (API outage, bad base state, etc.)
2. Escalate to user via AskUserQuestion with the failure details
3. Options: retry the session, kill and investigate, or continue with remaining agents
