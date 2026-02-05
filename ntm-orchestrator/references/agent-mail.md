# Agent Mail Reference

Agent Mail is an MCP server providing inter-agent coordination through messaging, file reservations, and completion tracking.

## Core Functions

### Registration

Every agent must register before participating:

```javascript
register_agent({
  project_key: 'your-project-slug',  // Project slug
  program: 'claude-code',                    // claude-code | codex | gemini
  model: 'opus-4',                           // Model identifier
  name: 'Orchestrator',                      // Display name
  task_description: 'Session orchestrator'   // What this agent does
})
```

**Project key:** Derived from project path. Use consistent slugs across all agents in a session.

### Messaging

```javascript
// Send message
send_message({
  project_key: 'slug',
  sender_name: 'Orchestrator',
  to: ['Agent-1'],           // Or ['all'] for broadcast
  subject: 'Task assigned',
  body_md: 'Your task: ...'
})

// Fetch inbox
fetch_inbox({
  project_key: 'slug',
  agent_name: 'Orchestrator'
})
```

### File Reservations

Prevent concurrent edits:

```javascript
// Request reservation
request_reservation({
  project_key: 'slug',
  agent_name: 'Agent-1',
  paths: ['src/auth/**', 'src/types.ts']
})

// Release reservation
release_reservation({
  project_key: 'slug',
  agent_name: 'Agent-1',
  paths: ['src/auth/**', 'src/types.ts']
})

// Query reservations
query_reservations({
  project_key: 'slug'
})
```

### Completion Tracking

```javascript
// Mark complete
mark_complete({
  project_key: 'slug',
  agent_name: 'Agent-1',
  task_id: 'bd-101i',
  summary: 'Implemented auth middleware. All tests pass.',
  files_changed: ['src/auth/middleware.ts', 'src/auth/index.ts']
})
```

---

## Orchestrator Patterns

### Session Setup

```javascript
// 1. Register orchestrator
register_agent({
  project_key: 'slug',
  program: 'claude-code',
  model: 'opus-4',
  name: 'Orchestrator',
  task_description: 'ntm session orchestrator for feature-x'
})

// 2. After spawning agents, broadcast session info
send_message({
  project_key: 'slug',
  sender_name: 'Orchestrator',
  to: ['all'],
  subject: '[session] Started',
  body_md: `
Session: feature-x
Quality gates: bun run typecheck && bun run lint && bun run test
File scope policy: Non-overlapping, enforced by orchestrator
`
})
```

### Task Assignment

```javascript
// Reserve files for agent
request_reservation({
  project_key: 'slug',
  agent_name: 'Pane-1',
  paths: ['packages/shared/src/*']
})

// Send task (via ntm --robot-send, not Agent Mail)
// Agent Mail handles coordination, ntm handles prompts
```

### Conflict Resolution

When agents report FILE_RESERVATION_CONFLICT:

```javascript
// Query current state
const reservations = query_reservations({ project_key: 'slug' })

// Arbitrate: earlier reservation wins
// Tell later agent to wait or reassign
send_message({
  project_key: 'slug',
  sender_name: 'Orchestrator',
  to: ['Pane-2'],
  subject: '[conflict] Wait for Pane-1',
  body_md: 'Pane-1 has reservation on src/auth/*. Wait for their completion.'
})
```

### Completion Handling

```javascript
// On receiving completion message in inbox
const inbox = fetch_inbox({ project_key: 'slug', agent_name: 'Orchestrator' })

for (const msg of inbox.messages) {
  if (msg.subject.includes('[complete]')) {
    // Verify quality gates before accepting
    // Check via ntm --robot-tail
    
    // Release their reservations
    release_reservation({
      project_key: 'slug',
      agent_name: msg.sender_name,
      paths: ['...']  // From their completion message
    })
  }
}
```

### Session Teardown

```javascript
// Broadcast session end
send_message({
  project_key: 'slug',
  sender_name: 'Orchestrator',
  to: ['all'],
  subject: '[session] Complete',
  body_md: 'Session ending. All tasks processed.'
})

// Release any remaining reservations
const reservations = query_reservations({ project_key: 'slug' })
for (const r of reservations) {
  if (r.session === 'feature-x') {
    release_reservation({
      project_key: 'slug',
      agent_name: r.agent_name,
      paths: r.paths
    })
  }
}
```

---

## Message Conventions

### Subject Prefixes

| Prefix | Meaning |
|--------|---------|
| `[task]` | Task assignment |
| `[complete]` | Work completed |
| `[blocked]` | Agent is blocked |
| `[question]` | Agent has question |
| `[conflict]` | Resource conflict |
| `[session]` | Session lifecycle |
| `[arch]` | Architecture updates |

### Completion Message Format

```markdown
Subject: [complete] bd-101i Auth middleware

Summary: Implemented JWT validation middleware.

Files changed:
- src/auth/middleware.ts (new)
- src/auth/index.ts (modified)
- src/auth/__tests__/middleware.test.ts (new)

Quality gates: ✓ typecheck ✓ lint ✓ test

Commits:
- abc123 feat: add auth middleware
- def456 test: add middleware tests
```

### Question Message Format

```markdown
Subject: [question] Scope clarification

I'm working on bd-101i and need clarification:

Should the auth middleware also handle refresh tokens,
or just access token validation?

Options:
A) Access tokens only (simpler, matches current scope)
B) Both token types (more complete, larger change)

Blocking on: This decision affects the interface design.
```

---

## Error Handling

### Reservation Conflict

```javascript
// When request_reservation fails
{
  error: 'FILE_RESERVATION_CONFLICT',
  conflicting_agent: 'Pane-1',
  paths: ['src/auth/middleware.ts']
}
```

**Resolution:** Orchestrator arbitrates. Earlier reservation wins. Later agent waits or gets reassigned.

### Agent Not Found

```javascript
// When send_message fails
{
  error: 'AGENT_NOT_FOUND',
  agent_name: 'Pane-5'
}
```

**Resolution:** Agent may have crashed. Check ntm health. Re-register if needed.

### Project Not Found

```javascript
{
  error: 'PROJECT_NOT_FOUND',
  project_key: 'wrong-slug'
}
```

**Resolution:** Verify project_key matches across all agents. Use consistent slugs.
