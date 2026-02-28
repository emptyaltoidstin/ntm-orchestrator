---
name: exploring-codebase
description: |
  Systematic codebase exploration that maps architecture, components, and dependencies.
  Use when you need to understand how a feature works across a codebase, explore an
  unfamiliar project's architecture, trace data flow through multiple layers, or plan
  changes that span several components. Maps the high-level structure first, then
  dispatches parallel agents to explore each area in depth. Produces a synthesis with
  file:line references, execution flows, and actionable recommendations.

trigger:
  - "understand this codebase"
  - "explore the architecture"
  - "how is this code organized"
  - "how does [feature] work across the system"
  - "give me an overview of this project"
  - "starting work on unfamiliar codebase or component"
  - "planning changes that span multiple layers/components"
  - "map the dependencies / module boundaries"
  - "trace how [data/request] flows through the system"

skip_when:
  - "Pure reference lookup (function signature, type definition)"
  - "Checking if specific file exists (yes/no question)"
  - "Reading a single known file"
  - "User explicitly asked for grep/find, not exploration"
---

# Codebase Exploration

## Overview

This skill takes a two-phase approach: **discover** the structure of the codebase first, then **deep dive** into each discovered area with targeted parallel agents. The codebase reveals its own organization; you don't assume it upfront.

**Core rule:** Always run Phase 1 (discovery) before Phase 2 (deep dives). Discovery takes 6-10 minutes and prevents hours of wrong assumptions, repeated grep cycles, and fixes applied to the wrong component. Do not skip it even under time pressure — especially under time pressure.

---

## When to Use vs. Skip

| Use this skill | Use grep/read instead |
|---|---|
| "How does authentication work?" | "What's the signature of `CreateUser`?" |
| "I need to understand the payment system" | "Does `config.yaml` exist?" |
| "What's the architecture of this project?" | "What's on line 45 of `main.go`?" |
| "Plan changes across multiple services" | "Read the error message in `app.log`" |
| Prior knowledge may be stale or incomplete | You already ran discovery recently |

---

## Phase 1: Discovery

**Agent:** `agents/discovery-agent.md`
**Model:** haiku (cost-effective for breadth)
**Goal:** Map the territory — architecture pattern, components, layers, boundaries.

The discovery agent examines directory structure, config files, documentation, and samples key files to produce a structural map. It does not do deep analysis.

**Dispatch:**
```
Task(
  description: "Discover codebase architecture",
  subagent_type: "Explore",
  model: "haiku",
  prompt: "Read agents/discovery-agent.md for your instructions. Discover the architecture of this codebase. Target: [USER_TARGET]. Produce output matching the required format in that file."
)
```

**Discovery output must include:**
- Architecture pattern with file evidence (not "probably hexagonal")
- Complete component/module list with paths
- Layer/boundary map with dependency directions
- Recommended deep-dive priorities for the user's target

### Validation Gate

**Before proceeding to Phase 2, verify the discovery output contains:**
- [ ] Architecture pattern identified (with file:line evidence)
- [ ] All major components enumerated (with paths)
- [ ] Boundaries/layers documented
- [ ] Deep-dive priorities ranked by relevance to target

If any are missing, re-prompt the discovery agent for the missing sections. Do not proceed with incomplete discovery.

---

## Phase 2: Deep Dives

**Agent:** `agents/deep-dive-agent.md` (N parallel instances)
**Model:** sonnet (thorough for depth)
**Goal:** Understand how [TARGET] works within each discovered area.

Spawn one deep-dive agent per component/layer identified in Phase 1. All run in parallel.

**Dispatch (all in a single message):**
```
Task(
  description: "Deep dive [LAYER_1]",
  subagent_type: "Explore",
  model: "sonnet",
  prompt: "Read agents/deep-dive-agent.md for your instructions. Explore [TARGET] in [LAYER_1]. Area path: [PATH]. Focus on: [FOCUS_POINTS_FROM_DISCOVERY]. Produce output matching the required format."
)
Task(
  description: "Deep dive [LAYER_2]",
  subagent_type: "Explore",
  model: "sonnet",
  prompt: "Read agents/deep-dive-agent.md for your instructions. Explore [TARGET] in [LAYER_2]. Area path: [PATH]. Focus on: [FOCUS_POINTS_FROM_DISCOVERY]. Produce output matching the required format."
)
// ... one per discovered component/layer
```

Each deep-dive agent traces entry points, execution flows, data transformations, and integration points within its assigned area. All claims require file:line references.

### Validation Gate

**Before proceeding to synthesis, verify each deep-dive output contains:**
- [ ] Entry points documented with file:line
- [ ] At least one complete execution flow traced
- [ ] Integration points (inbound and outbound) mapped
- [ ] All required sections from deep-dive-agent.md present

Re-prompt any agent whose output is incomplete.

---

## Phase 3: Synthesis

**Actor:** You (the orchestrating agent)
**Goal:** Integrate all findings into a single actionable document.

1. Collect all deep-dive outputs
2. Identify cross-cutting patterns (things that appear in multiple areas)
3. Resolve conflicts between perspectives (if agent A says X calls Y but agent B disagrees)
4. Produce output matching `templates/synthesis-output.md`
5. Include concrete recommendations tied to the user's original goal

---

## State Tracking

Maintain this status block and update after each phase transition:

```
SKILL: exploring-codebase
PHASE: [1-Discovery | 2-DeepDive | 3-Synthesis]
TARGET: [what user asked about]
DISCOVERY_COMPLETE: [true/false]
PERSPECTIVES_FOUND: [N]
DEEP_DIVES_COMPLETE: [M/N]
BLOCKED: [any blockers]
```

---

## Exit Criteria

The skill is complete only when ALL of these are true:

**Discovery:**
- [ ] Architecture pattern identified with evidence
- [ ] All major components enumerated
- [ ] Layers/boundaries documented
- [ ] File:line references for structural elements

**Deep Dives:**
- [ ] Every discovered perspective explored
- [ ] Target documented in each area
- [ ] Execution flows traced with file:line
- [ ] Integration points identified

**Synthesis:**
- [ ] Discovery + deep dives integrated into single document
- [ ] Cross-cutting patterns identified
- [ ] Conflicting findings resolved or flagged
- [ ] Recommendations specific to user's goal
- [ ] Next steps are concrete and actionable

---

## Adaptive Examples

### Microservices Architecture

**Discovery finds:** 5 services (Auth, User, Order, Payment, Notification), event-driven via message bus.

**Deep dives adapt:** 5 parallel agents, one per service. Each focuses on target within their service, with special attention to event publishing/subscribing at boundaries.

### Monolithic Hexagonal Architecture

**Discovery finds:** Single app, 4 layers (HTTP → Application → Domain → Infrastructure), dependency inversion at boundaries.

**Deep dives adapt:** 4 parallel agents, one per layer. Each traces the target through their layer, focusing on port/adapter contracts.

---

## Output Format

Final output follows `templates/synthesis-output.md`:

```markdown
# [TARGET] Exploration Results

## Architecture Overview
[Pattern, evidence, structure diagram from Phase 1]

## Component Map
[Table: component, path, purpose, key interfaces]

## [TARGET] Analysis

### In [Component/Layer 1]
[Entry points, execution flow, key files from deep-dive agent 1]

### In [Component/Layer 2]
[From deep-dive agent 2]

## Cross-Cutting Patterns
[Patterns observed across multiple areas]

## Integration Points
[How components connect regarding TARGET, with flow diagram]

## Recommendations
[Actionable guidance for user's original goal]

## Next Steps
[Specific actions with file references]
```

---

## Do / Don't

| Do | Don't |
|---|---|
| Always run Phase 1 before Phase 2 | Skip discovery because you "already know" |
| Require file:line evidence for all claims | Accept vague statements like "probably in the service layer" |
| Dispatch deep-dive agents in parallel | Run them sequentially |
| Adapt Phase 2 scope based on Phase 1 findings | Use a fixed template regardless of architecture |
| Synthesize into actionable guidance | Dump raw agent outputs |
| Validate outputs at each gate before proceeding | Proceed with incomplete data |
| Use for multi-component understanding | Use for single-file lookups (use Read/Grep) |

---

## Integration

This skill works standalone or as a pre-step for other workflows:

- **Before implementation planning:** Run exploration to understand what you're changing
- **Before debugging:** Map the system to find the right component to investigate
- **As Phase 0.5 of ntm-orchestrator:** Provides architecture context for parallel task distribution
- **On new/unfamiliar projects:** Build a mental model before writing any code
