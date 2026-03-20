# Agent Prompt Template: Continuation After Context Refresh

Use this template when an agent's context has been refreshed (via `/clear`, `/new`, etc.) and needs to resume interrupted work. The orchestrator fills this template with captured state before sending.

## When to Use

- After context refresh in Phase 3 monitoring
- Instead of re-sending the original prompt (`pane-<N>.md`)
- The orchestrator builds this from worker state JSON, git diff, and Agent Mail history

## Template

```markdown
# Task Continuation: {{task_id}}

You are **{{pane_name}}** resuming work on: **{{task_id}}**

## Important: You Were Refreshed

Your context was cleared due to context pressure (refresh #{{refresh_count}} for this task). You have no memory of your prior work, but your changes are preserved on disk and your state was captured before the refresh.

**Do NOT start over.** Review your prior state below, verify your existing changes are sound, then continue from where you left off.

## Your Prior State

### Worker State (captured before refresh)

```json
{{worker_state_json}}
```

### Files Changed on Disk

```
{{git_diff_stat}}
```

### Your Last Message to Orchestrator

{{last_agent_message}}

## Your Task

{{task_description}}

## File Scope

You may ONLY modify files in:
```
{{file_scope}}
```

**Scope is enforced by the orchestrator.** Do not modify files outside this scope.

## Git Integration Mode

Default to **Shared-Tree Worker Mode** unless explicitly assigned Integrator role.

- Worker mode: do NOT run `git pull --rebase`, `git push`, or `git commit --no-verify`
- Worker mode: implement + handoff only
- Integrator mode: runs full gates, commits, rebases/pulls, and pushes

## Resumption Steps

1. **Read your changed files** — review the diffs shown above and verify they look correct
2. **Check for partial edits** — if your last edit was interrupted, finish or revert it cleanly
3. **Consult your worker state** — the `status`, `files_modified`, and `blocker` fields tell you where you were
4. **Continue implementation** — pick up from where you left off, don't redo completed work
5. **Update worker state** — write a fresh state update reflecting your resumed progress

## Worker State File (Required)

Continue using the same state file:
```bash
RUNTIME_DIR="${NTM_ORCH_RUNTIME_DIR:-${XDG_RUNTIME_DIR:-/tmp}/ntm-orch-$(id -u)}"
STATE_FILE="$RUNTIME_DIR/{{session_name}}/{{pane_name}}-state.json"
```

Write an immediate state update after resuming:
```json
{"task_id":"{{task_id}}","status":"in_progress","files_modified":[<carry forward from prior state>],"gates_passed":false,"last_update_ts":"<ISO-8601>","blocker":null}
```

## Context Pressure Protocol

If you notice context pressure again (warnings, degradation, or your context feeling long):

1. **Immediately** update your worker state file with current progress
2. Send an urgent message:
   ```javascript
   send_message({
     project_key: '{{project_slug}}',
     sender_name: '{{pane_name}}',
     to: ['Orchestrator'],
     subject: '[context-warning] {{task_id}}',
     body_md: `
   ## Context Pressure Alert

   Task: {{task_id}}
   Refresh count so far: {{refresh_count}}

   ### Progress Since Last Refresh
   - <what you accomplished since resuming>

   ### Files Modified
   - <files touched since resuming>

   ### Remaining Work
   - <what still needs to be done>

   ### Worker State
   - State file updated: yes
   - Current status: <in_progress|blocked>
   `
   })
   ```
3. **Stop working and wait** for the Orchestrator to respond. Do not continue — the Orchestrator will either refresh you again or reassign the task.

## Acceptance Criteria

{{acceptance_criteria}}

## Quality Gates

Before reporting completion, run:
```bash
{{quality_gates}}
```

## Agent Mail

Your registration and file reservations from the previous context are still active. You do not need to re-register or re-reserve.

If reservations were released before refresh, re-reserve:
```javascript
request_reservation({
  project_key: '{{project_slug}}',
  agent_name: '{{pane_name}}',
  paths: [{{file_scope_array}}]
})
```

## Completion Protocol

Same as your original assignment:

1. Run verification for your role
2. Release reservations:
   ```javascript
   release_reservation({
     project_key: '{{project_slug}}',
     agent_name: '{{pane_name}}',
     paths: [{{file_scope_array}}]
   })
   ```
3. Send completion:
   ```javascript
   send_message({
     project_key: '{{project_slug}}',
     sender_name: '{{pane_name}}',
     to: ['Orchestrator'],
     subject: '[complete] {{task_id}}',
     body_md: `
   ## Summary
   <What you accomplished (across all context sessions)>

   ## Files Changed
   - <file1> - <what changed>

   ## Quality Gates
   - <command> -> <result>

   ## Worker State
   - State file: <path>
   - Final JSON: <paste compact JSON>
   - Context refreshes: {{refresh_count}}

   ## Git Handoff
   Role: <Worker|Integrator>
   Commits: <none in worker mode OR list hashes if integrator>

   ## Notes
   <Any observations, concerns, or follow-up suggestions>
   `
   })
   ```

## Prohibited Actions

- Do not modify files outside your scope
- Do not skip quality gates
- Do not delete tests without approval
- Do not modify .env, secrets, or auth config without approval
- Do not expand scope without Orchestrator approval
- Do not run `git pull --rebase` or `git push` in worker mode
- Do not use `git commit --no-verify`
- Do not report completion without verification evidence

## Project Rules

```bash
if [ -f AGENTS.md ]; then
  cat AGENTS.md
fi
```
```

## Orchestrator: How to Fill This Template

Before sending, the orchestrator gathers:

1. **Worker state JSON:** `cat <runtime>/<session>/<pane_name>-state.json`
2. **Git diff stat:** `git diff --stat -- <file_scope_paths>`
3. **Last Agent Mail message:** `fetch_inbox()` filtered for messages from this pane
4. **Original task details:** from `<runtime>/<session>/manifest.json` or the original `pane-<N>.md`
5. **Refresh count:** from `REFRESHES[pane]` in state tracking

Write the filled template to `<runtime>/<session>/pane-<N>-continuation.md` before sending.
