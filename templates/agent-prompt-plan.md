# Agent Prompt Template: Plan-Based Tasks

Use this template for Mode C (plan file) task assignments where tasks come from a structured plan document.

## Template

```markdown
# Task Assignment: {{task_id}} (from {{plan_file}})

You are **{{pane_name}}** executing task **{{task_id}}** from the execution plan.

## Plan Reference

This task is defined in: `{{plan_file}}`

Section: {{plan_section}}

## Your Task

{{task_description}}

## File Scope

Your assigned files:
```
{{file_scope}}
```

**Scope is strictly enforced.** The orchestrator has pre-assigned file scopes to prevent conflicts. Do not touch files outside your scope.

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
{"task_id":"{{task_id}}","status":"in_progress","files_modified":[],"gates_passed":false,"last_update_ts":"<ISO-8601>","blocker":null}
```

## Architecture Context

```bash
if [ -f docs/architecture/discovery.md ]; then
  cat docs/architecture/discovery.md
fi
```

## Dependencies

This task depends on: {{dependencies}}

Wait for these to complete before starting dependent work. The Orchestrator will notify you when dependencies are met.

## Acceptance Criteria

From plan:
{{acceptance_criteria}}

## Quality Gates

```bash
{{quality_gates}}
```

If you are the **Integrator**, all gates are mandatory and must pass before completion.
If you are a **Worker**, run requested checks and report outcomes. If global gates fail due to out-of-scope WIP, report and hand off.

## Agent Mail Setup

```javascript
// Register
register_agent({
  project_key: '{{project_slug}}',
  program: '<your-program>',
  model: '<your-model>',
  name: '{{pane_name}}',
  task_description: 'Plan task: {{task_id}}'
})

// Reserve files
request_reservation({
  project_key: '{{project_slug}}',
  agent_name: '{{pane_name}}',
  paths: [{{file_scope_array}}]
})
```

If reservation fails, stop immediately, do not edit further, and notify Orchestrator.

## Completion Protocol

```javascript
// 1. Run verification for your role
// Integrator: all quality gates pass
// Worker: run requested checks and report outcomes
// Run: {{quality_gates}}

// 2. Release reservations
release_reservation({
  project_key: '{{project_slug}}',
  agent_name: '{{pane_name}}',
  paths: [{{file_scope_array}}]
})

// 3. Report completion
send_message({
  project_key: '{{project_slug}}',
  sender_name: '{{pane_name}}',
  to: ['Orchestrator'],
  subject: '[complete] {{task_id}}',
  body_md: `
## Task: {{task_id}}
Plan: {{plan_file}}

## Summary
<What you accomplished>

## Files Changed
- <file1>
- <file2>

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

## Plan Notes
<Any deviations from plan or observations>
`
})
```

## Prohibited Actions

- ❌ Modify files outside assigned scope
- ❌ Skip quality gates
- ❌ Start dependent work before dependencies complete
- ❌ Deviate from plan without Orchestrator approval
- ❌ Delete tests or security files without approval
- ❌ Run `git pull --rebase` in worker mode
- ❌ Run `git push` in worker mode
- ❌ Use `git commit --no-verify`
- ❌ Report completion without required verification evidence

## Handling Plan Deviations

If you discover the plan needs adjustment:

```javascript
send_message({
  project_key: '{{project_slug}}',
  sender_name: '{{pane_name}}',
  to: ['Orchestrator'],
  subject: '[deviation] {{task_id}}',
  body_md: `
## Proposed Deviation

Task: {{task_id}}
Plan section: {{plan_section}}

### Issue
<Why the plan doesn't work as written>

### Proposed Change
<What you'd like to do instead>

### Impact
<How this affects other tasks or timeline>

### Blocking
<yes/no - can you proceed without approval?>
`
})
```

**Wait for Orchestrator approval before deviating from the plan.**

## If Stuck

```javascript
send_message({
  project_key: '{{project_slug}}',
  sender_name: '{{pane_name}}',
  to: ['Orchestrator'],
  subject: '[blocked] {{task_id}}',
  body_md: `
Task: {{task_id}}
Plan: {{plan_file}}

Blocked on: <specific issue>

Tried:
1. <attempt>
2. <attempt>

Need: <what would unblock>
`
})
```

## Project Rules

```bash
if [ -f AGENTS.md ]; then
  cat AGENTS.md
fi
```
```
