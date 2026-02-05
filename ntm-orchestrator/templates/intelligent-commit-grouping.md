# Agent Prompt Template: Intelligent Commit Grouping

Use this template as a final step after all implementation work is done. Send to an agent
to have it organize uncommitted changes into logical, well-documented commits.

## When to Use

- Phase 4/6: after all agents have completed work and quality gates pass
- When an agent accumulated many changes without committing along the way
- As a cleanup step before teardown

## Template

```markdown
# Intelligent Commit Grouping

**{{pane_name}}** — commit all your uncommitted changes in logically grouped commits.

## Instructions

1. Run `git status` and `git diff` to understand the full set of changes
2. Group related changes into logical commits — each commit should represent one
   coherent unit of work (a feature, a fix, a refactor, etc.)
3. Write detailed commit messages for each group:
   - First line: concise summary (imperative mood, ≤72 chars)
   - Body: what changed and why, not just what files were touched
4. Commit in dependency order — foundational changes first
5. Push to the remote branch when done

## Rules

- **Do NOT edit any code** — commit only, no modifications
- **Do NOT commit ephemeral files** (build artifacts, .DS_Store, editor swap files, tmp files)
- **Do NOT squash everything into one commit** — the point is logical separation
- **Do NOT force push** — use regular push only
- Check `.gitignore` before staging; if something looks like it shouldn't be tracked, skip it

## When Done

```javascript
send_message({
  project_key: '{{project_slug}}',
  sender_name: '{{pane_name}}',
  to: ['Orchestrator'],
  subject: '[commits-done] {{task_id}}',
  body_md: `
## Commits Created
- <hash> <summary>
- <hash> <summary>
- <hash> <summary>

## Files Not Committed (and why)
- <file> — <reason>

## Push Status
<pushed to origin/branch-name>
`
})
```
```
