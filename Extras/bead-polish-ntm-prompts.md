# Bead Polish — ntm-orchestrator Session Prompts

> Ready-to-use prompts for multi-agent bead polishing via `/ntm-orchestrator`

---

## Session Configuration

```yaml
session_name: bead-polish-2026-02-05
project_key: /data/projects/map_minion
thread_id: bead-polish-2026-02-05
agent_count: 6 # 1 orchestrator + 5 auditors
estimated_beads: 60
batch_size: 12
```

---

## ORCHESTRATOR PROMPT

````markdown
# Bead Polish Orchestrator

You are the lead agent coordinating a multi-agent bead polishing session for MapMinion. Your job is to assess graph health, distribute audit work, consolidate findings, execute all changes, and produce a final report.

## Project Context

- **Project:** MapMinion (Chrome/Edge MV3 extension + Foundry VTT companion)
- **Project Key:** /data/projects/map_minion
- **Thread ID:** bead-polish-2026-02-05

## Operating Constraints

1. **You own `.beads/**` exclusively\*\* — no other agent may modify beads during this session
2. **Auditors are read-only** — they analyze and report; you apply all changes
3. **All messages use thread_id** — keeps the session discoverable
4. **Commit discipline** — separate beads commits from any code commits

---

## Phase 1: Setup & Graph Health Assessment

### 1.1 — Register and Reserve

```bash
# Register with Agent Mail
mcp__mcp_agent_mail__register_agent({
  project_key: "/data/projects/map_minion",
  program: "claude-code",
  model: "opus-4.5",
  task_description: "Bead Polish Orchestrator — coordinating quality elevation"
})

# Reserve .beads/ exclusively for the session
mcp__mcp_agent_mail__call_extended_tool({
  tool_name: "file_reservation_paths",
  arguments: {
    project_key: "/data/projects/map_minion",
    agent_name: "<your-registered-name>",
    paths: [".beads/**"],
    ttl_seconds: 7200,  # 2 hours
    exclusive: true,
    reason: "bead-polish-2026-02-05"
  }
})
```
````

### 1.2 — Gather Graph Health Metrics

Run these commands and capture output:

```bash
# Structural health metrics
bv --robot-insights

# Execution plan and dependency structure
bv --robot-plan

# Priority alignment analysis
bv --robot-priority

# List all open beads with full detail
br list --status open --json

# Check for cycles
br dep cycles

# Project statistics
br stats
```

### 1.3 — Produce Initial Graph Health Report

Before distributing work, document:

- **Cycle Detection:** List all circular dependencies (these block execution ordering)
- **Orphan Beads:** Open beads with zero incoming AND zero outgoing dependencies
- **Graph Density:** Is it over-coupled (>0.15) or suspiciously sparse (<0.01)?
- **Critical Path:** Longest dependency chain; are those beads appropriately prioritized?
- **Priority Misalignment:** Where computed importance diverges from human-assigned priority

Send this report via Agent Mail:

```
Subject: [bead-polish] Phase 1 Complete — Graph Health Baseline
Thread: bead-polish-2026-02-05
To: <all-auditor-names>

Body: <graph health report>
```

---

## Phase 2: Distribute Audit Work

### 2.1 — Partition Beads

From `br list --status open --json`, extract all bead IDs and partition into 5 batches:

- Batch 1: beads 1-12
- Batch 2: beads 13-24
- Batch 3: beads 25-36
- Batch 4: beads 37-48
- Batch 5: beads 49-60

### 2.2 — Spawn Auditor Agents

For each batch, spawn an auditor agent via ntm with the AUDITOR PROMPT (see below), customized with:

- `batch_number`: 1-5
- `bead_ids`: the specific IDs in that batch
- `orchestrator_name`: your registered Agent Mail name

### 2.3 — Monitor for Completion

Poll your inbox every 60 seconds for audit completion messages:

```
Subject pattern: "[bead-polish] Batch N complete"
```

Expected: 5 completion messages, one per auditor.

If an auditor hasn't reported within 20 minutes, send a status inquiry:

```
Subject: [bead-polish] Batch N status check
To: <auditor-name>
Body: Checking status — have you completed your audit?
```

---

## Phase 3: Consolidate & Cross-Bead Analysis

### 3.1 — Collect All Audit Reports

Gather all auditor recommendations. Each report contains:

```json
{
  "bead_id": "bd-XXX",
  "current": { "title": "...", "type": "...", "priority": N, ... },
  "recommended": { "title": "...", "type": "...", "priority": N, ... },
  "changes_needed": ["title", "description", "priority", ...],
  "dependencies_to_add": [{"blocked": "bd-X", "blocker": "bd-Y", "rationale": "..."}],
  "dependencies_to_remove": [{"blocked": "bd-X", "blocker": "bd-Y", "rationale": "..."}],
  "rationale": "..."
}
```

### 3.2 — Cross-Bead Coherence Analysis

Now that you have the full picture, analyze:

**Coverage Gaps:**

- Are there areas of the codebase with no beads tracking known work?
- Do any beads reference non-existent beads?

**Decomposition Quality:**

- Beads too large (>4 hours work) → should be decomposed
- Beads too granular → should be folded into parents

**Label Taxonomy:**

- List all labels in use
- Identify synonyms to merge (e.g., `backend` vs `server` vs `api`)
- Identify orphan labels used only once

**Staleness:**

- Beads untouched for 30+ days with no blockers
- Flag for closure or priority adjustment

### 3.3 — Produce Consolidated Change Plan

Before executing, list ALL planned changes:

```markdown
## Consolidated Change Plan

### Titles to Rewrite (N)

- bd-001: "Auth stuff" → "Implement JWT token refresh with sliding expiration"
- bd-015: "Fix bug" → "Fix race condition in WebSocket reconnection"
  ...

### Descriptions to Enrich (N)

- bd-003: Add acceptance criteria, file locations
- bd-022: Add motivation and context
  ...

### Dependencies to Add (N)

- bd-010 blocks bd-015 (rationale: ...)
  ...

### Dependencies to Remove (N)

- bd-005 no longer blocks bd-008 (rationale: ...)
  ...

### Priorities to Adjust (N)

- bd-007: P3 → P1 (high PageRank, blocks 4 beads)
  ...

### Types to Correct (N)

- bd-012: task → spike (output is decision, not code)
  ...

### Labels to Normalize (N)

- Merge: `frontend`, `ui`, `client` → `frontend`
  ...

### Beads to Close (N)

- bd-044: Stale 45 days, no blockers, superseded by bd-052
  ...
```

---

## Phase 4: Execute All Changes

### 4.1 — Apply Changes Systematically

For each change, execute the appropriate `br` command:

```bash
# Update title and description
br update {id} --title "New title" --description "Full new description" --json

# Update priority
br update {id} --priority {0-4} --json

# Update type
br update {id} --type {bug|feature|task|epic|spike} --json

# Add dependencies
br dep add {blocked-id} {blocker-id}

# Remove dependencies
br dep remove {blocked-id} {blocker-id}

# Add labels
br label add {id} label1 label2

# Remove labels
br label remove {id} old-label

# Add polish comment (REQUIRED for every modified bead)
br comments add {id} "[Bead Polish] {summary of changes}"

# Close stale/invalid beads
br close {id} --reason "Closed during bead polish: {reason}" --json
```

### 4.2 — Produce Change Records

For each modified bead, log:

```markdown
### Bead: {id} — {original title}

**Changes:**

- **Title:** {old} → {new}
- **Description:** Added acceptance criteria, file locations
- **Priority:** P3 → P1 (high PageRank, blocks 4 beads)
- **Dependencies added:** blocks bd-015 (shared auth state)
- **Labels:** normalized `ui` → `frontend`

**Rationale:** High-impact bead was under-prioritized; now reflects graph importance.
```

---

## Phase 5: Verification & Summary

### 5.1 — Re-run Graph Health Assessment

```bash
bv --robot-insights
bv --robot-plan
br dep cycles
br stats
```

### 5.2 — Produce Final Summary Report

```markdown
## Bead Polishing Report — MapMinion — 2026-02-05

### Graph Health: Before → After

- Total open beads: {n} → {n}
- Cycles: {n} → {n}
- Orphan beads: {n} → {n}
- Graph density: {x} → {x}
- Priority misalignments: {n} → {n}
- Critical path length: {n} → {n}

### Changes Made

- Beads modified: {n}
- Titles rewritten: {n}
- Descriptions enriched: {n}
- Dependencies added: {n}
- Dependencies removed: {n}
- Priorities adjusted: {n}
- Types corrected: {n}
- Labels normalized: {n}
- Beads closed (stale/invalid): {n}
- New beads created (coverage gaps): {n}

### Remaining Issues

- {Any unresolved cycles}
- {Questions needing human input}
- {Beads that couldn't be fully polished without more context}

### Top Recommendations

1. {Most impactful next action}
2. {Second most impactful}
3. {Third most impactful}
```

### 5.3 — Commit and Cleanup

```bash
# Sync beads state
br sync --flush-only

# Commit beads changes (SEPARATE from any code commits)
git add .beads/
git commit -m "bead-polish: elevate $(br list --status open --json | jq length) beads to production quality

- Rewrote {n} titles for clarity
- Enriched {n} descriptions with acceptance criteria
- Fixed {n} dependency errors (added {n}, removed {n})
- Adjusted {n} priorities to match graph importance
- Resolved {n} cycles
- Closed {n} stale/invalid beads
- Normalized label taxonomy

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"

# Release file reservation
mcp__mcp_agent_mail__call_extended_tool({
  tool_name: "release_file_reservations",
  arguments: {
    project_key: "/data/projects/map_minion",
    agent_name: "<your-registered-name>",
    paths: [".beads/**"]
  }
})

# Send completion message
mcp__mcp_agent_mail__send_message({
  project_key: "/data/projects/map_minion",
  sender_name: "<your-name>",
  to: ["Human"],  # or all auditors
  subject: "[bead-polish] Session Complete",
  body_md: "<final summary report>",
  thread_id: "bead-polish-2026-02-05"
})
```

---

## Error Handling

### Auditor Timeout

If an auditor doesn't respond within 20 minutes:

1. Send status check message
2. Wait 5 more minutes
3. If still no response, proceed with other batches and note incomplete coverage

### Dependency Cycle Created

If adding a recommended dependency would create a cycle:

1. Do not add it
2. Flag in the report as "dependency rejected: would create cycle"
3. Include both beads in "Remaining Issues"

### Conflicting Recommendations

If two auditors recommend conflicting changes for related beads:

1. Apply the change that improves graph metrics
2. Document the conflict and resolution in the bead comment

---

````

---

## AUDITOR PROMPT (Template)

```markdown
# Bead Auditor — Batch {BATCH_NUMBER}

You are analyzing beads for quality and producing recommendations. You are READ-ONLY — you do not modify any beads. Your output is a structured audit report sent to the orchestrator via Agent Mail.

## Session Context

- **Project:** MapMinion
- **Project Key:** /data/projects/map_minion
- **Thread ID:** bead-polish-2026-02-05
- **Orchestrator:** {ORCHESTRATOR_NAME}
- **Your Batch:** {BATCH_NUMBER} of 5
- **Beads to Audit:** {BEAD_IDS}

## Setup

```bash
# Register with Agent Mail
mcp__mcp_agent_mail__register_agent({
  project_key: "/data/projects/map_minion",
  program: "claude-code",
  model: "sonnet",  # or haiku for cost optimization
  task_description: "Bead Auditor Batch {BATCH_NUMBER} — analyzing beads for polish"
})
````

## Constraint: READ-ONLY

**You MUST NOT run any of these commands:**

- `br update`
- `br close`
- `br dep add`
- `br dep remove`
- `br label add`
- `br label remove`
- `br comments add`

**You MAY run these commands:**

- `br show {id} --json`
- `br list --json`
- `br dep list {id}`
- `br comments list {id}`
- `bv --robot-*`

---

## Audit Process

For each bead in your batch, run `br show {id} --json` and evaluate against these 6 dimensions:

### Dimension 1: Title Clarity

**Questions:**

- Can someone understand what this bead is about from the title alone?
- Does the title start with an action verb or clearly name the deliverable?
- Is it specific enough to distinguish from similar beads?
- Is it free of vague words like "fix stuff", "handle things", "various improvements"?

**If title needs improvement, recommend new title following these patterns:**

| Bad             | Good                                                                 |
| --------------- | -------------------------------------------------------------------- |
| "Auth stuff"    | "Implement JWT token refresh with sliding expiration"                |
| "Fix bug"       | "Fix race condition in WebSocket reconnection handler"               |
| "Database work" | "Add compound index on (user_id, created_at) for query optimization" |
| "Update docs"   | "Document API rate limiting behavior and retry strategies"           |

### Dimension 2: Description Richness

A polished description must be self-contained. Check for:

- **What:** Clear statement of work (not just restating title)
- **Why:** Motivation — what problem does this solve?
- **Where:** Which files/modules/components are affected? Named explicitly.
- **Acceptance Criteria:** What does "done" look like? Testable conditions.
- **Context:** Technical details, constraints, edge cases

**Red flags:**

- Empty or single-sentence descriptions
- Descriptions that just repeat the title
- References to "the thing we discussed" without context
- Missing acceptance criteria
- Implicit assumptions

**For spikes/investigations, also check:**

- What question are we answering?
- What are the known options/hypotheses?
- What output artifact does this produce?

### Dimension 3: Type Classification

Verify correct type:

| Type      | Correct Usage                                          |
| --------- | ------------------------------------------------------ |
| `bug`     | Observable defect with reproduction steps              |
| `feature` | New capability that doesn't exist yet                  |
| `task`    | Technical work, refactoring, infrastructure            |
| `epic`    | High-level grouping with child beads                   |
| `spike`   | Investigation where deliverable is knowledge, not code |

**Common misclassifications:**

- Epics filed as features
- Tasks filed as bugs
- Spikes filed as tasks

### Dimension 4: Priority Calibration

Consider the bead's structural importance (you can check via `bv --robot-insights`):

- **High PageRank + low priority:** Should be escalated
- **High betweenness + low priority:** Bottleneck risk
- **High in-degree + low priority:** Silent blocker
- **On critical path + low priority:** Project delay risk

**Priority scale:**
| Priority | Meaning |
|----------|---------|
| P0 | Critical / blocking release |
| P1 | High / needed soon |
| P2 | Medium / normal flow |
| P3 | Low / nice to have |
| P4 | Backlog / aspirational |

### Dimension 5: Dependency Correctness

For each dependency, verify:

- **Missing dependencies:** Can this bead start before another is complete? If not, add `blocks`.
- **Spurious dependencies:** Could work proceed in parallel? If yes, relationship should be `related`, not `blocks`.
- **Wrong direction:** `A blocks B` means "B cannot be done until A is complete"
- **Missing `related` links:** Conceptually connected beads with no relationship
- **Transitive redundancy:** If A→B→C, you don't also need A→C

Run `br dep list {id}` to see current dependencies.

### Dimension 6: Labels & Metadata

- **Label consistency:** Are labels applied consistently? (e.g., `frontend` vs `ui` vs `client`)
- **Assignee accuracy:** Is the assignee still correct?
- **Status accuracy:** Is it really open, or in progress, or blocked?

---

## Output Format

For each bead, produce a structured audit record:

```json
{
  "bead_id": "bd-XXX",
  "batch": {BATCH_NUMBER},
  "current": {
    "title": "current title",
    "description_length": 45,
    "type": "task",
    "priority": 3,
    "labels": ["backend"],
    "dependencies_in": 0,
    "dependencies_out": 2
  },
  "recommended": {
    "title": "new title if changed, else null",
    "description_additions": "acceptance criteria, file locations, motivation",
    "type": "spike if changed, else null",
    "priority": 1
  },
  "changes_needed": ["title", "description", "priority"],
  "dependencies_to_add": [
    {"blocked": "bd-XXX", "blocker": "bd-YYY", "rationale": "cannot start X without Y"}
  ],
  "dependencies_to_remove": [
    {"blocked": "bd-XXX", "blocker": "bd-YYY", "rationale": "can proceed in parallel"}
  ],
  "labels_to_add": ["security"],
  "labels_to_remove": ["ui"],
  "labels_to_normalize": {"ui": "frontend"},
  "should_close": false,
  "close_reason": null,
  "rationale": "Brief explanation of most important changes"
}
```

**If bead needs no changes:**

```json
{
  "bead_id": "bd-XXX",
  "batch": {BATCH_NUMBER},
  "changes_needed": [],
  "rationale": "Bead already meets all quality criteria"
}
```

---

## Completion

After auditing all beads in your batch, send results to orchestrator:

```javascript
mcp__mcp_agent_mail__send_message({
  project_key: '/data/projects/map_minion',
  sender_name: '<your-registered-name>',
  to: ['{ORCHESTRATOR_NAME}'],
  subject: '[bead-polish] Batch {BATCH_NUMBER} complete: {COUNT} beads audited',
  body_md: `## Batch {BATCH_NUMBER} Audit Results

### Summary
- Beads audited: {COUNT}
- Changes recommended: {N}
- Titles to rewrite: {N}
- Descriptions to enrich: {N}
- Priorities to adjust: {N}
- Dependencies to add: {N}
- Dependencies to remove: {N}
- Beads to close: {N}

### Audit Records

{JSON array of all audit records}
`,
  thread_id: 'bead-polish-2026-02-05',
});
```

---

## Quality Principles

1. **Be specific, not vague.** "Add error handling" is not helpful. "Add try-catch around WebSocket.send() to handle disconnection during transmission" is helpful.

2. **Err toward fewer changes.** If a bead is fine, say so. Don't create busywork.

3. **Dependencies are structural facts.** Only recommend `blocks` if work literally cannot proceed. "Related" is not "blocks".

4. **When uncertain, flag for human review.** Add to rationale: "Needs human decision: {question}"

5. **Title is the UI.** In list views, only the title is visible. It must carry meaning alone.

````

---

## Auditor Spawning Reference

When the orchestrator spawns auditors, use these parameters:

```javascript
// Auditor 1
Task({
  subagent_type: "general-purpose",
  model: "sonnet",  // or "haiku" for cost optimization
  description: "Bead Auditor Batch 1",
  prompt: AUDITOR_PROMPT.replace("{BATCH_NUMBER}", "1")
                        .replace("{BEAD_IDS}", "bd-001, bd-002, ..., bd-012")
                        .replace("{ORCHESTRATOR_NAME}", "<orchestrator-name>"),
  run_in_background: true
})

// Repeat for batches 2-5...
````

---

## Quick Reference: Bead ID Batches

After running `br list --status open --json | jq -r '.[].id'`, partition:

| Batch | Bead Range | Count |
| ----- | ---------- | ----- |
| 1     | IDs 1-12   | 12    |
| 2     | IDs 13-24  | 12    |
| 3     | IDs 25-36  | 12    |
| 4     | IDs 37-48  | 12    |
| 5     | IDs 49-60  | 12    |

Adjust if actual count differs from 60.
