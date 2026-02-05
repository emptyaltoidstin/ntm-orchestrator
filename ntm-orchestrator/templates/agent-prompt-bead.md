# Task Assignment: {{task_id}}

You are an autonomous agent in an orchestrated ntm session. The Orchestrator is monitoring your progress via Agent Mail.

## Setup (Do This First)

1. Register in Agent Mail:
   ```
   register_agent({
     project_key: '{{project_slug}}',
     program: '<your-program>',
     model: '<your-model>',
     name: '{{pane_name}}',
     task_description: '{{task_id}}: {{task_title}}'
   })
   ```

2. Reserve files before editing:
   ```
   file_reservation_paths({
     project_key: '{{project_slug}}',
     agent_name: '{{pane_name}}',
     paths: [{{file_scope_patterns}}],
     ttl_seconds: 3600,
     exclusive: true,
     reason: '{{task_id}}'
   })
   ```
   If you get `FILE_RESERVATION_CONFLICT`, stop and notify the Orchestrator immediately via Agent Mail.

3. Announce start:
   ```
   send_message({
     project_key: '{{project_slug}}',
     sender_name: '{{pane_name}}',
     to: ['Orchestrator'],
     subject: '[{{task_id}}] Starting: {{task_title}}',
     body_md: 'Claiming {{task_id}}. File scope: {{file_scope}}',
     thread_id: '{{task_id}}'
   })
   ```

## Your Task

**Bead:** {{task_id}} — {{task_title}}
**Priority:** {{priority}}
**Type:** {{bead_type}}

### Description
{{task_description}}

### Acceptance Criteria
{{acceptance_criteria}}

### File Scope
You MUST only edit files matching: {{file_scope}}
Do NOT touch files outside this scope.

## Workflow

1. Read and understand the relevant code in your file scope
2. Follow the project's AGENTS.md guidelines (especially quality gates)
3. Implement the changes
4. Run quality gates: `bun run typecheck && bun run lint && bun run test`
5. Commit and push:
   ```bash
   git add <your-files-only>
   git commit -m "feat/fix/chore: <description>"
   git pull --rebase && git push
   ```
6. Close the bead: `br close {{task_id}} --reason "Completed: <summary>"`
7. Release file reservations
8. Send completion message:
   ```
   send_message({
     project_key: '{{project_slug}}',
     sender_name: '{{pane_name}}',
     to: ['Orchestrator'],
     subject: '[{{task_id}}] Completed: {{task_title}}',
     body_md: '<summary of changes, commits, any follow-up needed>',
     thread_id: '{{task_id}}'
   })
   ```

## If You Get Stuck

Send a message to Orchestrator via Agent Mail explaining the blocker. Do not spend more than 15 minutes stuck without reporting. The Orchestrator can reassign, clarify, or escalate.
