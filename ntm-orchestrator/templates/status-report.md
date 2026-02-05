# Orchestration Report: {{session_name}}

## Summary

| Metric | Value |
|--------|-------|
| Duration | {{duration}} |
| Agents | {{total_agents}} ({{cc_count}} Claude Code, {{cod_count}} Codex) |
| Tasks | {{total_tasks}} total, {{completed}} completed, {{failed}} failed |
| Interventions | {{intervention_count}} |

## Task Results

| # | Task ID | Agent | Status | Commits | Summary |
|---|---------|-------|--------|---------|---------|
{{task_rows}}

## Conflicts & Interventions

{{intervention_log}}

## Failed Tasks

{{failure_details}}

## Remaining Work

{{remaining_beads}}

## Git State

{{git_summary}}

---

*Full agent output archived at `/tmp/ntm-orch-{{session_name}}-full.txt`*
*Code blocks extracted to `/tmp/ntm-orch-{{session_name}}-code.txt`*
