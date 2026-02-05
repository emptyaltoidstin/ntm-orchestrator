# Polling Cadence Reference

## Tiered Strategy

The orchestrator's biggest risk is burning its own context window on monitoring. This tiered strategy balances awareness against token cost.

### Cadence Table

| Window    | Interval | Primary Tool               | Secondary (on anomaly)                     | Rationale                              |
|-----------|----------|----------------------------|--------------------------------------------|----------------------------------------|
| 0–2 min   | No poll  | —                          | —                                          | Agents still reading prompts           |
| 2–10 min  | 120s     | `ntm --robot-terse`        | —                                          | Cheap status, detect early crashes     |
| 10–30 min | 180s     | `ntm --robot-terse`        | `ntm --robot-tail <s> --panes=<P> --lines=30` | Check progress on slowest agents   |
| 30+ min   | 300s     | `ntm --robot-terse`        | `ntm health <session> --json`              | Watch for stalls and resource issues   |

### Completion Detection

Move to Phase 4 (Results Collection) when ANY of:
- `--robot-terse` shows `C:100%`
- All agents have sent completion messages via Agent Mail
- Timeout reached (default: 60 minutes)

## Token Costs Per Tool

| Tool                          | Approx Tokens | Notes                              |
|-------------------------------|---------------|------------------------------------|
| `ntm --robot-terse`           | ~100          | Single line, always cheap          |
| `fetch_inbox`                 | ~200          | Depends on message count           |
| `ntm --robot-tail` (30 lines) | ~800-1500    | Per pane; only use on anomaly      |
| `ntm health --json`           | ~300          | Per session; health of all agents  |
| `ntm copy --last 200`         | ~2000-5000   | Per pane; expensive, Phase 4 only  |
| `ntm copy --all`              | ~10000+       | All panes; Phase 4 only, to file   |

## Budget for 30-Minute Session

| Activity                    | Calls | Tokens Each | Total   |
|-----------------------------|-------|-------------|---------|
| `--robot-terse` polls       | ~12   | 100         | 1,200   |
| `fetch_inbox` polls         | ~12   | 200         | 2,400   |
| `--robot-tail` spot checks  | ~3    | 800         | 2,400   |
| `ntm health` checks         | ~2    | 300         | 600     |
| Phase 4 collection          | 1     | 3,000       | 3,000   |
| Phase 5 synthesis           | 1     | 2,000       | 2,000   |
| **Total**                   |       |             | **~12,000** |

This leaves substantial context budget for interventions and user interaction.

## Anomaly Detection from --robot-terse

The terse format: `S:name|A:active/total|W:waiting|I:idle|E:errors|C:completion%`

| Signal              | Meaning                    | Action                              |
|---------------------|----------------------------|-------------------------------------|
| `E:N` where N > 0   | Agent errors               | `ntm health --json` immediately     |
| `I:N` unexpectedly   | Agents idle when should work | `--robot-tail` the idle panes      |
| `A:X/Y` where X < Y | Agents down                | Check health, verify auto-restart   |
| `C:100%`            | All done                   | Transition to Phase 4               |
| `!:Xc`              | Critical alerts            | Investigate immediately             |

## When Orchestrator Context Runs Low

If the orchestrator's own context is approaching limits:
1. Write a handoff summary to Agent Mail (subject: "Orchestrator handoff")
2. Include: current state tracking block, pane→task mapping, completion status
3. Create a bead: `br create "Handoff: ntm-orch <session>" -t task -p 1 --json`
4. Stop gracefully — do not attempt degraded operation
