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

**All gates must pass.** Fix failures before reporting completion. Do not ask to skip gates.

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

**On FILE_RESERVATION_CONFLICT:** Stop immediately and notify Orchestrator.

## Completion Protocol

1. **Verify gates pass:**
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
   ✓ typecheck
   ✓ lint  
   ✓ test
   
   ## Commits
   - <hash> <message>
   
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
- ❌ Force push to shared branches
- ❌ Report completion with failing gates

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
