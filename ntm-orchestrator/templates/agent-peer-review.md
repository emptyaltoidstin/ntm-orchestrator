# Agent Prompt Template: Peer Review

Use this template to have one agent review another agent's work. Useful when an agent
finishes early and can be redeployed, or when the orchestrator wants independent
verification of critical changes.

## When to Use

- Phase 3: an agent finishes its task and another agent's work needs review
- High-risk changes (auth, crypto, data migrations) that warrant a second pair of eyes
- When an agent's self-review found no issues but the orchestrator wants independent confirmation

## Template

```markdown
# Peer Review: {{review_target_task_id}}

**{{pane_name}}** — you are reviewing work done by **{{review_target_pane}}** on task `{{review_target_task_id}}`.

## Scope of Review

Review the following files/directories which were modified by {{review_target_pane}}:
```
{{review_target_file_scope}}
```

## Review Process

1. Read each changed file carefully, tracing execution flow through imports and callers
2. Look for:
   - Logic errors and incorrect assumptions
   - Missing edge cases and error handling gaps
   - Security issues (injection, auth bypass, data leaks)
   - Performance problems (N+1 queries, unnecessary allocations, blocking calls)
   - Reliability issues (race conditions, unhandled promise rejections)
   - Code that contradicts the project's patterns or AGENTS.md rules
3. Use first-principles analysis — don't just look at the surface

## Do NOT

- Modify any files — this is a review, not an implementation task
- Nitpick style if it matches existing codebase conventions
- Expand review beyond {{review_target_pane}}'s file scope

## Report Findings

```javascript
send_message({
  project_key: '{{project_slug}}',
  sender_name: '{{pane_name}}',
  to: ['Orchestrator'],
  cc: ['{{review_target_pane}}'],
  subject: '[peer-review] {{review_target_task_id}}',
  body_md: `
## Review Summary
<one-line verdict: clean / minor issues / significant issues>

## Issues Found
- **[severity]** <file>:<line> — <description>
  Root cause: <why this is wrong>
  Suggested fix: <how to fix>

## Positive Observations
- <anything notably well-done>

## Verdict
<approve / request-changes>
`
})
```

If no issues found, still send the report with a clean verdict — the orchestrator
needs confirmation either way.
```
