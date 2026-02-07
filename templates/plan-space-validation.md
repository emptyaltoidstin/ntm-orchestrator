# Agent Prompt Template: Plan-Space Validation

Use this template during Phase 0.5 to have an agent critically review the task manifest
or bead plan before any implementation begins. Catching problems in plan-space is far
cheaper than fixing them after implementation.

## When to Use

- Phase 0.5: before distributing a large batch of beads or freeform tasks
- When the orchestrator is uncertain about task decomposition
- After generating a manifest from `ntm --robot-plan` that needs sanity-checking

## Template

```markdown
# Plan-Space Validation

**{{pane_name}}** — review the following task plan before we begin implementation.

## The Plan

{{manifest_or_bead_summary}}

## Validation Checklist

For each task/bead, evaluate:
1. **Does it make sense?** Is the goal clear and achievable?
2. **Is it scoped correctly?** Too broad (should be split) or too narrow (should be merged)?
3. **Are dependencies correct?** Would executing in this order cause problems?
4. **Are file scopes non-overlapping?** Flag any potential conflicts
5. **Is anything missing?** Are there implicit prerequisites not captured as tasks?
6. **Is anything unnecessary?** Tasks that don't serve the project's goals?
7. **Could the overall approach be better?** Alternative strategies worth considering?

## Do NOT

- Start implementing anything
- Create new beads or tasks — just recommend changes
- Spend time on trivial wording tweaks

## Report

```javascript
send_message({
  project_key: '{{project_slug}}',
  sender_name: '{{pane_name}}',
  to: ['Orchestrator'],
  subject: '[plan-review] Task manifest validation',
  body_md: `
## Verdict
<ready / needs-revision>

## Issues
- **Task #N**: <problem> → <recommended change>

## Missing Work
- <any tasks that should be added>

## Suggested Reordering
- <dependency or ordering changes if any>

## Overall Assessment
<brief paragraph on plan quality and readiness>
`
})
```
```
