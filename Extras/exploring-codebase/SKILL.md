---
name: exploring-codebase
version: 1.0.0
description: |
  Autonomous two-phase codebase exploration - first discovers natural perspectives
  (layers, components, boundaries), then dispatches adaptive deep-dive explorers
  based on what was discovered. Synthesizes findings into actionable insights.

trigger:
  - "Need to understand how a feature/system works across the codebase"
  - "Starting work on unfamiliar codebase or component"
  - "Planning changes that span multiple layers/components"
  - "User asks 'how does X work?' for non-trivial X"

skip_when:
  - "Pure reference lookup (function signature, type definition)"
  - "Checking if specific file exists (yes/no question)"
  - "Reading error message from known file location"
---

# Autonomous Two-Phase Codebase Exploration

## Overview

Traditional exploration assumes structure upfront or explores sequentially. This skill takes an autonomous two-phase approach: **discover** the natural perspectives of the codebase first, then **deep dive** into each discovered perspective with targeted explorers.

**Core principle:** Let the codebase reveal its own structure, then explore each structure element thoroughly with adaptive parallel agents.

---

## MANDATORY ANNOUNCEMENT

When starting this skill, you MUST output:

```
I'm using the exploring-codebase skill to autonomously discover and explore the codebase structure.

Before proceeding, I've checked the Red Flags table and confirmed:
- [ ] Production pressure makes me WANT to skip discovery → Using skill anyway
- [ ] I think I 'already know' the structure → Discovery will validate assumptions
- [ ] This seems like a simple question → Location without context is incomplete
- [ ] Colleague gave me high-level info → Discovery finds what they forgot

The skill's core principle: **When pressure is highest, systematic approach matters most.**
```

Check the boxes that apply to your current situation. This creates accountability.

---

## 🚨 Red Flags: When You're About to Make a Mistake

**STOP and use this skill if you catch yourself thinking:**

| Red Flag Thought | What It Means | Do This Instead |
|------------------|---------------|-----------------|
| "I already know this architecture" | ⚠️ Dunning-Kruger | Run discovery to validate assumptions |
| "Grep is faster for this simple question" | ⚠️ Optimizing for feeling productive | One exploration > multiple follow-ups |
| "Production is down, no time for process" | ⚠️ Panic mode | High stakes demand MORE rigor |
| "Colleague told me the structure" | ⚠️ Trusting abstractions | Discovery finds what they forgot |
| "Being pragmatic means skipping this" | ⚠️ Conflating speed with value | Real pragmatism = doing it right |
| "This is overkill for..." | ⚠️ Underestimating complexity | Incomplete understanding compounds |
| "I'll explore progressively if I get stuck" | ⚠️ Reactive vs proactive | Discovery prevents getting stuck |
| "Let me just quickly check..." | ⚠️ Ad-hoc investigation trap | Systematic > ad-hoc |

**If 2+ red flags triggered: YOU NEED THIS SKILL.**

---

## 💥 Violation Consequences: Real Costs of Skipping

### Consequence 1: The Cascade Effect
**Skip discovery → Fix wrong component → Break integration → New production issue**

- Bug: "Account creation failing"
- Assumption: "It's in onboarding component"
- Reality: Transaction component has new validation
- Your fix: Modify onboarding (wrong component)
- Result: Original bug persists + NEW bug in onboarding

**Discovery would have revealed:** Transaction component owns the validation now.

### Consequence 2: The Multiple Round-Trip Effect
**Grep for location → Answer → Follow-up → Grep again → Another follow-up**

- Q1: "Where is validation?" → `validation.go:45`
- Q2: "How does it integrate?" → Read files → "Called from use case"
- Q3: "What else validates?" → Grep again → "Assert package + HTTP layer"
- **Total: 3 round trips, 15 minutes, incomplete mental model**

**Exploration would have provided:** All answers in one document, 10 minutes total.

### Consequence 3: The Stale Knowledge Effect
**"I already know" → Work based on old mental model → Code changed → Wrong implementation**

- Your knowledge: "3 components (onboarding, transaction, crm)"
- Reality: New `audit` component added last month
- Your fix: Modify account creation in onboarding
- Missing: Audit component now logs all account operations
- Result: Account created but not audited, compliance violation

### Cost Summary Table

| Skip Reason | Time "Saved" | Actual Cost | Net Loss |
|-------------|--------------|-------------|----------|
| "I already know" | 6-10 min | 2+ hours debugging stale knowledge | -110 to -114 min |
| "Simple question" | 6-10 min | 3 round trips × 5 min = 15 min | -5 to -9 min |
| "Production emergency" | 6-10 min | Wrong fix + cascade = 2+ hours | -110 to -114 min |
| "Colleague told me" | 6-10 min | Missing component = 1+ hour rework | -50 to -54 min |

---

## The Two-Phase Process

### Phase 1: Discovery Pass (Meta-Exploration)

**Agent:** `agents/discovery-agent.md`
**Model:** haiku (cost-effective)
**Goal:** Understand "What IS this codebase?"

Dispatch the discovery agent to identify:
- Architecture pattern (hexagonal, layered, microservices, etc.)
- Major components/modules
- Natural boundaries and layers
- Organization principles
- Key technologies and frameworks

**Dispatch command:**
```
Task(
  subagent_type: "exploring-codebase:discovery-agent",
  model: "haiku",
  prompt: "Discover the architecture of this codebase. Target: [USER_TARGET]"
)
```

**Wait for output:** Structural map with discovered perspectives.

### Phase 2: Deep Dive Pass (Adaptive Exploration)

**Agent:** `agents/deep-dive-agent.md` (N instances)
**Model:** sonnet (thorough)
**Goal:** Understand "How does [TARGET] work in each discovered area?"

Based on Phase 1 discoveries, spawn N targeted explorers:
- One explorer per discovered perspective/component/layer
- Each explorer focuses on the target within their scope
- All explorers run **in parallel**

**Dispatch command (parallel):**
```
// Single message with N Task calls
Task(subagent_type: "exploring-codebase:deep-dive-agent", model: "sonnet",
     prompt: "Explore [TARGET] in [LAYER_1]. Focus on: [LAYER_1_DETAILS]")
Task(subagent_type: "exploring-codebase:deep-dive-agent", model: "sonnet",
     prompt: "Explore [TARGET] in [LAYER_2]. Focus on: [LAYER_2_DETAILS]")
// ... one per discovered layer/component
```

**Wait for all outputs:** Deep findings from each perspective.

### Phase 3: Synthesis (Main Agent)

**Actor:** You (orchestrator)
**Goal:** Integrate all findings into actionable guidance

1. Collect all deep-dive outputs
2. Identify cross-cutting patterns
3. Resolve any conflicts between perspectives
4. Apply `templates/synthesis-output.md` format
5. Provide implementation guidance

---

## State Tracking

Maintain this status throughout skill execution:

```
SKILL: exploring-codebase
PHASE: [1-Discovery | 2-DeepDive | 3-Synthesis]
TARGET: [what user asked about]
DISCOVERY_COMPLETE: [true/false]
PERSPECTIVES_FOUND: [N]
DEEP_DIVES_COMPLETE: [M/N]
BLOCKED: [any blockers]
```

Update after EACH phase transition.

---

## Exit Criteria

You may ONLY claim this skill is complete when ALL of these are true:

**Phase 1 (Discovery) completeness:**
- [ ] Architecture pattern identified with evidence
- [ ] All major components/modules enumerated
- [ ] Layers/boundaries documented
- [ ] Organization principle clear
- [ ] File:line references for structural elements

**Phase 2 (Deep Dive) completeness:**
- [ ] All discovered perspectives explored
- [ ] [TARGET] found and documented in each area
- [ ] Execution flows traced with file:line
- [ ] Integration points identified
- [ ] Patterns documented per area

**Synthesis quality:**
- [ ] Discovery and deep dive integrated
- [ ] Cross-cutting insights identified
- [ ] Inconsistencies explained
- [ ] Implementation guidance specific
- [ ] Next steps clear and actionable

**Incomplete checklist = not done. Do not claim completion.**

---

## Common Traps

### ❌ Trap 1: "Simple Question About Location"

**Rationalization:** "User just asked 'where is X?' - grep is faster"

**Reality:** Location questions lead to "how does X work?" next
- Question: "Where is validation logic?"
- Grep answer: `validation.go:45`
- Follow-up: "How does it integrate with the system?"
- Follow-up: "What else validates this?"
- **Result:** 3 questions, incomplete picture, wasted time

**Counter:** Run exploration once, answer current + future questions.

### ❌ Trap 2: "I Already Know the Architecture"

**Rationalization:** "I worked here before, discovery is redundant"

**Reality:** Prior knowledge is dangerously incomplete
- You know high-level (components exist)
- You don't know details (how they're wired, what changed)
- Assumptions about "known" code cause most bugs

**Counter:** Discovery validates assumptions and reveals what changed.

### ❌ Trap 3: "Production Emergency, No Time"

**Rationalization:** "Production is down, skip the process"

**Reality:** High stakes demand MORE rigor, not less
- 6-10 min discovery prevents hours of wrong assumptions
- Production bugs from incomplete context cost >> discovery time
- "The Surgeon Textbook" analogy is wrong: surgeon has years of training, you don't have complete codebase knowledge

**Counter:** The stakes are high. Do it right.

### ❌ Trap 4: "Colleague Told Me Structure"

**Rationalization:** "Colleague said 3 microservices, discovery would be redundant"

**Reality:** High-level ≠ implementation details
- Colleague gives mental model, not file:line specifics
- Colleague may have stale knowledge
- Colleague may have forgotten or not known some components

**Counter:** Discovery finds what they forgot or didn't know.

---

## Anti-Patterns

| ❌ Bad | ✅ Good |
|--------|---------|
| Skip discovery, assume structure | Always run Phase 1 discovery first |
| Use same agents for all codebases | Adapt Phase 2 agents based on Phase 1 |
| Accept vague discoveries | Require file:line evidence |
| Run explorers sequentially | Dispatch all in parallel (per phase) |
| Skip synthesis step | Always integrate discovery + deep dive |
| Provide raw dumps | Synthesize into actionable guidance |
| Use for single file lookup | Use Read/Grep instead |

---

## Pressure Resistance

When facing pressure to skip or shortcut:

| User Says | This Is | Your Response |
|-----------|---------|---------------|
| "Just grep for it" | Shortcut pressure | "Systematic exploration > ad-hoc greps. One exploration answers current + future questions." |
| "We don't have time" | Time pressure | "6-10 min discovery prevents hours of wrong assumptions. High stakes demand rigor." |
| "I already know the architecture" | Knowledge assumption | "Discovery validates assumptions and reveals what changed. Prior knowledge is incomplete." |
| "Just find the file" | Scope minimization | "Location without context is incomplete. I'll provide comprehensive understanding." |
| "Skip phase 1, just dive in" | Process shortcut | "Phase 1 discovery determines what to explore in Phase 2. Cannot skip." |

**Your invariant response:** "Systematic exploration is faster than ad-hoc investigation when you account for follow-up questions and debugging wrong assumptions."

---

## Integration with Other Skills

| Skill | When to use together |
|-------|----------------------|
| **brainstorming** | Use exploring-codebase in Understanding phase to gather context |
| **writing-plans** | Use exploring-codebase before creating implementation plans |
| **executing-plans** | Use exploring-codebase if plan execution reveals gaps |
| **systematic-debugging** | Use exploring-codebase to understand system before debugging |

---

## Adaptive Examples

### Example 1: Microservices Architecture

**Phase 1 Discovery finds:**
- 5 microservices (Auth, User, Order, Payment, Notification)
- Each service is independent
- Event-driven communication via message bus

**Phase 2 adapts:**
- Launch 5 deep dive agents (one per service)
- Each explores target within their service
- Focus on event publishing/subscribing for integration

### Example 2: Monolithic Hexagonal Architecture

**Phase 1 Discovery finds:**
- Single application
- Hexagonal architecture (adapters + domain)
- 4 layers: HTTP → Application → Domain → Infrastructure

**Phase 2 adapts:**
- Launch 4 deep dive agents (one per layer)
- Each explores target within their layer
- Focus on dependency inversion at boundaries

---

## Output Format

When skill completes, provide output matching `templates/synthesis-output.md`:

```markdown
# [TARGET] Exploration Results

## Architecture Overview
[From Phase 1 discovery]

## Component Map
[Discovered structure with file:line references]

## [TARGET] Analysis

### In [Component/Layer 1]
[From deep-dive agent 1]

### In [Component/Layer 2]
[From deep-dive agent 2]

[... for each perspective ...]

## Cross-Cutting Patterns
[Patterns observed across multiple areas]

## Integration Points
[How components connect regarding TARGET]

## Recommendations
[Actionable guidance for user's original goal]

## Next Steps
[Specific actions based on findings]
```
