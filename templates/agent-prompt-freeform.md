# Agent Prompt Template: Freeform Tasks

Use this template for Mode B (freeform) task assignments where tasks come from natural language descriptions.

## Template

```markdown
# Task Assignment: {{task_label}}

You are **{{pane_name}}** working on: **{{task_label}}**

## Your Task

{{task_description}}

## File Scope

You may ONLY modify files in:
```
{{file_scope}}
```

**Scope is enforced by the orchestrator.** Do not modify files outside this scope. If you discover you need changes outside your scope, send a message to the Orchestrator requesting scope expansion.

## Git Integration Mode

Default to **Shared-Tree Worker Mode** unless explicitly assigned Integrator role.

- Worker mode: do NOT run `git pull --rebase`, `git push`, or `git commit --no-verify`
- Worker mode: implement + handoff only
- Integrator mode: runs full gates, commits, rebases/pulls, and pushes

## Context Preflight (Required)

Before editing any file, run:
```bash
cm context "{{task_description}}" --json
```

If `cm` is unavailable, include that in completion notes.

## Worker State File (Required)

Use a per-pane state file for progress updates:
```bash
RUNTIME_DIR="${NTM_ORCH_RUNTIME_DIR:-${XDG_RUNTIME_DIR:-/tmp}/ntm-orch-$(id -u)}"
STATE_FILE="$RUNTIME_DIR/{{session_name}}/{{pane_name}}-state.json"
mkdir -p "$(dirname "$STATE_FILE")"
```

Write JSON updates at start, after major progress, on blocker, and at completion:
```json
{"task_id":"{{task_label}}","status":"in_progress","files_modified":[],"gates_passed":false,"last_update_ts":"<ISO-8601>","blocker":null}
```

## Architecture Context

Before starting, check for architecture documentation:
```bash
if [ -f docs/architecture/discovery.md ]; then
  echo "Reading architecture doc..."
  cat docs/architecture/discovery.md
else
  echo "No architecture doc found - proceed with exploration"
fi
```

Read and follow any architectural guidance found.

## Acceptance Criteria

{{acceptance_criteria}}

## Quality Gates

Before reporting completion, run:
```bash
{{quality_gates}}
```

If you are the **Integrator**, all gates must pass before completion.
If you are a **Worker**, run requested checks and report exact results. If global gates fail due to out-of-scope WIP, report and hand off.

## Agent Mail Setup

### Register
```javascript
register_agent({
  project_key: '{{project_slug}}',
  program: '<your-program>',
  model: '<your-model>',
  name: '{{pane_name}}',
  task_description: '{{task_label}}'
})
```

### Reserve Files
```javascript
request_reservation({
  project_key: '{{project_slug}}',
  agent_name: '{{pane_name}}',
  paths: [{{file_scope_array}}]
})
```

**On FILE_RESERVATION_CONFLICT:** Stop immediately, do not edit further, and notify Orchestrator.

## Completion Protocol

1. **Run verification for your role:**
   ```bash
   {{quality_gates}}
   ```

2. **Release reservations:**
   ```javascript
   release_reservation({
     project_key: '{{project_slug}}',
     agent_name: '{{pane_name}}',
     paths: [{{file_scope_array}}]
   })
   ```

3. **Send completion:**
   ```javascript
   send_message({
     project_key: '{{project_slug}}',
     sender_name: '{{pane_name}}',
     to: ['Orchestrator'],
     subject: '[complete] {{task_label}}',
     body_md: `
   ## Summary
   <Brief description of what you accomplished>
   
   ## Files Changed
   - <file1> - <what changed>
   - <file2> - <what changed>
   
   ## Quality Gates
   - <command> -> <result>

   ## Worker State
   - State file: <path>
   - Final JSON: <paste compact JSON>

   ## cm Context
   - Rule ids or summary: <ids/summary OR "cm unavailable">
   
   ## Git Handoff
   Role: <Worker|Integrator>
   Commits: <none in worker mode OR list hashes if integrator>
   
   ## Notes
   <Any observations, concerns, or follow-up suggestions>
   `
   })
   ```

## Prohibited Actions

- ❌ Modify files outside your assigned scope
- ❌ Skip or bypass quality gates
- ❌ Delete test files without explicit approval
- ❌ Modify security-sensitive files (.env, secrets, auth) without approval
- ❌ Expand scope without Orchestrator approval
- ❌ Run `git pull --rebase` in worker mode
- ❌ Run `git push` in worker mode
- ❌ Use `git commit --no-verify`
- ❌ Force push to shared branches
- ❌ Report completion without required verification evidence

## Asking Questions

If you need clarification:
```javascript
send_message({
  project_key: '{{project_slug}}',
  sender_name: '{{pane_name}}',
  to: ['Orchestrator'],
  subject: '[question] {{task_label}}',
  body_md: `
Question: <your question>

Context: <why you need this answered>

Options I see:
A) <option 1>
B) <option 2>

Blocking: <yes/no - can you continue without answer?>
`
})
```

## If Stuck (>15 min)

```javascript
send_message({
  project_key: '{{project_slug}}',
  sender_name: '{{pane_name}}',
  to: ['Orchestrator'],
  subject: '[blocked] {{task_label}}',
  body_md: `
Blocked on: <specific blocker>

What I tried:
1. <attempt 1>
2. <attempt 2>

What I need: <specific help>

Time stuck: <minutes>
`
})
```

## Project Rules

If an AGENTS.md file exists in the project root, read and follow it. Project-specific rules override general guidance.

```bash
if [ -f AGENTS.md ]; then
  cat AGENTS.md
fi
```
```
