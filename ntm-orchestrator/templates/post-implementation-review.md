# Agent Prompt Template: Post-Implementation Review

Use this template after an agent completes its primary task. Send it to the same agent
to have them review their own work before the orchestrator accepts completion.

## When to Use

- Phase 3 → 4 transition: agent reports completion but before orchestrator accepts it
- After a context refresh where the agent resumed interrupted work
- When quality gates pass but the orchestrator wants higher confidence

## Template

```markdown
# Post-Implementation Review: {{task_id}}

**{{pane_name}}** — before your task is accepted, do a thorough self-review.

## What to Review

Carefully re-read all code you wrote or modified during this task with fresh eyes:

```
{{file_scope}}
```

## Checklist

For each file you changed:
1. Re-read the diff — does every change make sense in context?
2. Look for obvious bugs, off-by-one errors, missed edge cases
3. Check for accidental debug artifacts (console.log, TODO hacks, commented-out code)
4. Verify error handling — are failures caught and reported?
5. Confirm naming is clear and consistent with the codebase

## Do NOT

- Add new features or refactor unrelated code
- Expand beyond your file scope
- Skip this review to save time

## After Review

If you found and fixed issues:
```javascript
send_message({
  project_key: '{{project_slug}}',
  sender_name: '{{pane_name}}',
  to: ['Orchestrator'],
  subject: '[review-done] {{task_id}}',
  body_md: `
Issues found and fixed:
- <issue 1>: <fix>
- <issue 2>: <fix>

Quality gates: ✓ re-verified after fixes
`
})
```

If everything looks clean:
```javascript
send_message({
  project_key: '{{project_slug}}',
  sender_name: '{{pane_name}}',
  to: ['Orchestrator'],
  subject: '[review-done] {{task_id}}',
  body_md: 'Self-review complete. No issues found. Ready for acceptance.'
})
```
```
