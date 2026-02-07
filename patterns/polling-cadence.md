# Polling Cadence & Terse-as-Change-Detector

## Core Principle

**Pane state JSON is authoritative for per-task progress. `--robot-terse` is a cheap change detector.**

Its format may change between NTM versions. The skill must not depend on parsing its structure.

## Strategy

1. Read pane state files from `<runtime>/<session>/<pane_name>-state.json`.
2. Poll `--robot-terse` for cheap session change detection.
3. On change, fetch `--robot-status` for session health.
4. Use `--robot-tail` only when pane state files are stale/missing/invalid.

This decouples the skill from terse format changes while keeping polling cheap.

## Implementation

```bash
# Each poll iteration
RUNTIME_DIR="${NTM_ORCH_RUNTIME_DIR:-${XDG_RUNTIME_DIR:-/tmp}/ntm-orch-$(id -u)}"
current_terse=$(ntm --robot-terse)

if [ "$current_terse" != "$LAST_TERSE" ]; then
  # Something changed - fetch authoritative state
  ntm --robot-status > "$RUNTIME_DIR/<session>/status.json"
  
  # Parse JSON for state fields (example with jq)
  active_count=$(jq '.sessions[0].active_count' "$RUNTIME_DIR/<session>/status.json")
  error_count=$(jq '.sessions[0].error_count' "$RUNTIME_DIR/<session>/status.json")
  completion_pct=$(jq '.sessions[0].completion_pct' "$RUNTIME_DIR/<session>/status.json")
  
  # Update state tracking from JSON
  # ...
fi

LAST_TERSE="$current_terse"
```

## Cadence Table

| Window | Interval | Primary Tool | On Change | Rationale |
|--------|----------|--------------|-----------|-----------|
| 0–2 min | No poll | — | — | Agents initializing |
| 2–10 min | 120s | `--robot-terse` | `--robot-status` | Active work, need visibility |
| 10–30 min | 180s | `--robot-terse` | `--robot-status` + state-file check, tail fallback on anomaly | Steady state |
| 30+ min | 300s | `--robot-terse` | `--robot-status` + `--robot-health` | Long-running, check health |

## Token Cost Analysis

### Per-Poll Costs

| Tool | Tokens | When Used |
|------|--------|-----------|
| `--robot-terse` | ~100 | Every poll |
| `--robot-status` | ~300 | On terse change |
| `--robot-tail` (30 lines) | ~800 | On anomaly fallback |
| `--robot-health` | ~300 | Window 30+ or error |
| `fetch_inbox` | ~200 | Every poll |

### 30-Minute Session Example

| Window | Polls | Terse | Status (est. 50% change) | Inbox | Total |
|--------|-------|-------|--------------------------|-------|-------|
| 0-2 min | 0 | 0 | 0 | 0 | 0 |
| 2-10 min | 4 | 400 | 600 | 800 | 1,800 |
| 10-30 min | 7 | 700 | 1,050 | 1,400 | 3,150 |
| **Total** | 11 | 1,100 | 1,650 | 2,200 | **4,950** |

Plus collection (~3,000) and synthesis (~2,000) = ~10,000 total for monitoring phase.

## Why Not Parse Terse?

The terse output is designed for human glanceability, not machine parsing:

```
S:myapp|A:5/10|W:2|I:3|E:0|C:50%
```

Problems:
1. **Format not guaranteed.** NTM may change field order, add fields, or change encoding.
2. **Meaning may shift.** What "A:5/10" means could change (active/total? assigned/total?).
3. **Error handling is fragile.** Regex failures are silent and produce wrong state.

The JSON from `--robot-status` has a schema. Fields have documented meanings. Parsing is reliable.

## Handling Anomalies

When pane state files or `--robot-status` show anomalies:

| Condition | Action |
|-----------|--------|
| `error_count > 0` | Fetch `--robot-health=<session>` for details |
| State file stale/missing with active task | Fetch `--robot-tail` to check for stalls |
| `completion_pct == 100` | Transition to Phase 4 |
| Repeated identical status | Possible stall, fetch `--robot-tail` |

## State Updates

Only update orchestrator state from JSON fields:

```javascript
// Good: from JSON
state.active_count = json.sessions[0].active_count
state.error_count = json.sessions[0].error_count
state.completion_pct = json.sessions[0].completion_pct

// Bad: from terse parsing
const match = terse.match(/A:(\d+)\/(\d+)/)  // DON'T DO THIS
state.active_count = match[1]
```

## Fallback Behavior

If `--robot-terse` is unavailable (old NTM version):

```bash
# Fall back to periodic --robot-status
# Higher token cost, but still functional
ntm --robot-status > "$RUNTIME_DIR/<session>/status.json"
```

The skill remains functional, just less token-efficient.
