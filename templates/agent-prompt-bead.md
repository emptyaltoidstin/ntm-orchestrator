# Agent Prompt Template: Bead-Driven Tasks

Use this template for Mode A (beads-driven) task assignments.

## Template

```markdown
# Task Assignment: {{task_id}}

You are **{{pane_name}}** working on bead `{{task_id}}`.

## Your Task

{{task_description}}

## File Scope

You may ONLY modify files in:
```
{{file_scope}}
```

**Scope is enforced by the orchestrator.** Do not modify files outside this scope. If you need changes outside your scope, send a message to the Orchestrator.

## Git Integration Mode

Default to **Shared-Tree Worker Mode** unless explicitly assigned Integrator role.

- Worker mode: do NOT run `git pull --rebase`, `git push`, or `git commit --no-verify`
- Worker mode: do implementation + handoff only
- Integrator mode: runs full gates, commits, rebases/pulls, and pushes

## Context Preflight (Required)

Before editing any file, run:
```bash
cm context "{{task_description}}" --json
```

If `cm` is unavailable, note that explicitly in your completion message.

## Worker State File (Required)

Use a per-pane state file for progress updates:
```bash
RUNTIME_DIR="${NTM_ORCH_RUNTIME_DIR:-${XDG_RUNTIME_DIR:-/tmp}/ntm-orch-$(id -u)}"
STATE_FILE="$RUNTIME_DIR/{{session_name}}/{{pane_name}}-state.json"
mkdir -p "$(dirname "$STATE_FILE")"
```

Write JSON updates at start, after major progress, on blocker, and at completion:
```json
{"task_id":"{{task_id}}","status":"in_progress","files_modified":[],"gates_passed":false,"last_update_ts":"<ISO-8601>","blocker":null}
```

## Architecture Context

Before starting, check for architecture documentation:
```bash
if [ -f docs/architecture/discovery.md ]; then
  cat docs/architecture/discovery.md
fi
```

If the file exists and is recent, read and follow its guidance. If missing, note this in your completion message.

## Acceptance Criteria

{{acceptance_criteria}}

## Quality Gates

Before reporting completion, run:
```bash
{{quality_gates}}
```

If you are the **Integrator**, all gates must pass before completion.
If you are a **Worker**, run the checks requested by the orchestrator and report results. If global gates fail due to out-of-scope WIP, report and hand off.

## Agent Mail Registration

Register yourself at the start:
```javascript
register_agent({
  project_key: '{{project_slug}}',
  program: '<your-program>',  // claude-code, codex, etc.
  model: '<your-model>',
  name: '{{pane_name}}',
  task_description: 'Working on {{task_id}}'
})
```

## File Reservations

Request reservation for your files:
```javascript
request_reservation({
  project_key: '{{project_slug}}',
  agent_name: '{{pane_name}}',
  paths: [{{file_scope_array}}]
})
```

If you get FILE_RESERVATION_CONFLICT, **STOP immediately, make no additional edits, and notify the Orchestrator.**

## Completion Protocol

When done:

1. Complete verification for your role:
   - Integrator: all quality gates must pass
   - Worker: run requested checks and report results for handoff
2. Release file reservations:
   ```javascript
   release_reservation({
     project_key: '{{project_slug}}',
     agent_name: '{{pane_name}}',
     paths: [{{file_scope_array}}]
   })
   ```
3. Send completion message:
   ```javascript
   send_message({
     project_key: '{{project_slug}}',
     sender_name: '{{pane_name}}',
     to: ['Orchestrator'],
     subject: '[complete] {{task_id}}',
     body_md: `
   Summary: <what you did>
   
   Files changed:
   - <file1>
   - <file2>
   
   Quality checks run:
   - <command> -> <result>

   Worker state:
   - State file: <path>
   - Final JSON: <paste compact JSON>

   cm context:
   - Rule ids or summary: <ids/summary OR "cm unavailable">
   
   Git handoff:
   - Role: <Worker|Integrator>
   - Commits: <none in worker mode OR list hashes if integrator>
   `
   })
   ```

## Prohibited Actions

- ❌ Modify files outside your scope
- ❌ Skip quality gates
- ❌ Delete tests without explicit approval
- ❌ Modify .env, secrets, or auth config without approval
- ❌ Run `git pull --rebase` in worker mode
- ❌ Run `git push` in worker mode
- ❌ Use `git commit --no-verify`
- ❌ Force push or rewrite shared history
- ❌ Report completion without required verification evidence

## If You Get Stuck

If stuck for more than 15 minutes:
```javascript
send_message({
  project_key: '{{project_slug}}',
  sender_name: '{{pane_name}}',
  to: ['Orchestrator'],
  subject: '[blocked] {{task_id}}',
  body_md: 'Blocked on: <description>\n\nTried: <what you tried>\n\nNeed: <what would unblock>'
})
```

## AGENTS.md

If the project has an AGENTS.md file, read and follow it. Project-specific rules take precedence.
```
