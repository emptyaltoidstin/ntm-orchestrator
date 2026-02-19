# [TARGET] Exploration Results

> This document synthesizes findings from autonomous two-phase codebase exploration.
> Target: **[TARGET]**
> Codebase: **[CODEBASE_NAME]**
> Date: **[DATE]**

---

## Architecture Overview

**Pattern:** [Hexagonal | Clean | Layered | Microservices | etc.]
**Confidence:** [High | Medium | Low]
**Evidence:** [Brief explanation with key file references]

### Structure Diagram

```
[ASCII representation of architecture]
Example:
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   HTTP      │────▶│  Application│────▶│   Domain    │
│   Adapter   │     │   Service   │     │   Logic     │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │Infrastructure│
                    │   (DB, etc) │
                    └─────────────┘
```

---

## Component Map

| Component | Path | Purpose | Key Interfaces |
|-----------|------|---------|----------------|
| [Name] | `path/` | [Brief purpose] | [Main interfaces] |
| [Name] | `path/` | [Brief purpose] | [Main interfaces] |
| [Name] | `path/` | [Brief purpose] | [Main interfaces] |

---

## [TARGET] Analysis

### In [Component/Layer 1]: [Name]

**Summary:** [2-3 sentences on how TARGET manifests here]

**Entry Points:**
- `file.ext:line` - [Brief description]
- `file.ext:line` - [Brief description]

**Execution Flow:**
```
[Entry] → [Step 1] → [Step 2] → [Exit]
   │          │          │
   └──────────┴──────────┴── [Integration points]
```

**Key Files:**
| File | Purpose | Critical Lines |
|------|---------|----------------|
| `path/file.ext` | [Purpose] | L12-45 |
| `path/file.ext` | [Purpose] | L50-80 |

---

### In [Component/Layer 2]: [Name]

**Summary:** [2-3 sentences on how TARGET manifests here]

**Entry Points:**
- `file.ext:line` - [Brief description]

**Execution Flow:**
```
[Entry] → [Processing] → [Exit]
```

**Key Files:**
| File | Purpose | Critical Lines |
|------|---------|----------------|
| `path/file.ext` | [Purpose] | L10-30 |

---

### In [Component/Layer N]: [Name]

[Repeat pattern for each discovered perspective]

---

## Cross-Cutting Patterns

### Pattern 1: [Name]
**Observed in:** [List of components/layers]
**Description:** [What the pattern is]
**Example:** `file.ext:line`

### Pattern 2: [Name]
**Observed in:** [List of components/layers]
**Description:** [What the pattern is]
**Example:** `file.ext:line`

---

## Integration Points

### How [TARGET] Flows Across Boundaries

```
[Visual representation of data/control flow across components]

Example:
HTTP Request
    │
    ▼
┌─────────────┐  validates   ┌─────────────┐  stores    ┌─────────────┐
│   Handler   │─────────────▶│   Service   │──────────▶│ Repository  │
└─────────────┘              └─────────────┘            └─────────────┘
    creates ▲                      │ transforms              │ returns
            │                      ▼                         │
            └────────── Response ◀─────────────────────────┘
```

### Interface Contracts

| From | To | Interface | Data Shape | Location |
|------|-----|-----------|------------|----------|
| [A] | [B] | [Function/API] | [Input → Output] | `file:line` |
| [B] | [C] | [Function/API] | [Input → Output] | `file:line` |

---

## Data Transformations

| Stage | Location | Input | Output | What Changes |
|-------|----------|-------|--------|--------------|
| 1 | `file:line` | [Type] | [Type] | [Description] |
| 2 | `file:line` | [Type] | [Type] | [Description] |
| 3 | `file:line` | [Type] | [Type] | [Description] |

---

## Recommendations

### For Understanding [TARGET]

Start here: `path/file.ext:line`
- This is the primary entry point for [TARGET]
- Follow the flow to understand the full lifecycle

Key concepts to understand:
1. [Concept 1] - defined at `file:line`
2. [Concept 2] - defined at `file:line`

### For Modifying [TARGET]

**If adding new [TARGET]-related functionality:**
- Add to `path/component/` following existing patterns
- Interface with `existing-interface` at `file:line`
- Register in `config/file.ext:line`

**If fixing bugs in [TARGET]:**
- Check validation at `file:line` first
- Trace data transformation at `file:line`
- Verify integration points at `file:line`

### Potential Concerns Noticed

| Concern | Location | Severity | Suggestion |
|---------|----------|----------|------------|
| [Issue] | `file:line` | [L/M/H] | [Brief suggestion] |

---

## Next Steps

Based on your goal of [ORIGINAL_USER_GOAL]:

### Immediate Actions
1. [ ] [Specific action with file reference]
2. [ ] [Specific action with file reference]
3. [ ] [Specific action with file reference]

### Follow-up Exploration
- [ ] [Area that may need deeper investigation]
- [ ] [Related topic to explore]

### Questions to Clarify
- [ ] [Any ambiguities discovered]

---

## Exploration Metadata

| Metric | Value |
|--------|-------|
| **Discovery Time** | [X minutes] |
| **Deep Dive Time** | [X minutes] |
| **Total Files Analyzed** | [N] |
| **Components Discovered** | [N] |
| **Deep Dives Completed** | [N] |

---

*Generated by exploring-codebase skill v1.0.0*
