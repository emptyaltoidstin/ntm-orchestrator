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
     task_description: '{{task_id}}: {{task_label}}'
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
   If you get `FILE_RESERVATION_CONFLICT`, stop and notify the Orchestrator immediately.

3. Announce start:
   ```
   send_message({
     project_key: '{{project_slug}}',
     sender_name: '{{pane_name}}',
     to: ['Orchestrator'],
     subject: '[{{task_id}}] Starting: {{task_label}}',
     body_md: 'Claiming {{task_id}}. File scope: {{file_scope}}',
     thread_id: '{{task_id}}'
   })
   ```

## Your Task

**ID:** {{task_id}}
**Label:** {{task_label}}

### Plan Section
{{plan_section}}

### File Scope
You MUST only edit files matching: {{file_scope}}
Do NOT touch files outside this scope.

### Acceptance Criteria
{{acceptance_criteria}}

## Workflow

1. Read the plan section above carefully — it is your source of truth
2. Read and understand the relevant code in your file scope
3. Follow the project's AGENTS.md guidelines (especially quality gates)
4. Implement exactly what the plan describes — no more, no less
5. Run quality gates before committing
6. Commit and push (only your files)
7. Release file reservations
8. Send completion message to Orchestrator:
   ```
   send_message({
     project_key: '{{project_slug}}',
     sender_name: '{{pane_name}}',
     to: ['Orchestrator'],
     subject: '[{{task_id}}] Completed: {{task_label}}',
     body_md: '<summary of changes, commits, deviations from plan if any>',
     thread_id: '{{task_id}}'
   })
   ```

## If You Get Stuck

Send a message to Orchestrator via Agent Mail explaining the blocker. Do not spend more than 15 minutes stuck without reporting.
