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

**All gates must pass.** Do not report completion until gates pass. If a gate fails, fix the issue and re-run.

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

If you get FILE_RESERVATION_CONFLICT, **STOP** and notify the Orchestrator.

## Completion Protocol

When done:

1. Ensure all quality gates pass
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
   
   Quality gates: ✓ typecheck ✓ lint ✓ test
   
   Commits:
   - <hash> <message>
   `
   })
   ```

## Prohibited Actions

- ❌ Modify files outside your scope
- ❌ Skip quality gates
- ❌ Delete tests without explicit approval
- ❌ Modify .env, secrets, or auth config without approval
- ❌ Force push or rewrite shared history
- ❌ Report completion without passing gates

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
