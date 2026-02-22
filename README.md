# ntm-orchestrator

A Claude Code skill for orchestrating parallel AI agent execution via [NTM](https://github.com/Dicklesworthstone/ntm) (Named Tmux Manager). Part of the [Agentic Flywheel](https://agent-flywheel.com/tldr) system.

## Who This Skill Is For

This skill is designed for **power users of the Agentic Flywheel system** who want to:

- Fan out complex tasks across multiple AI agents (Claude Code, Codex, Gemini, Ollama)
- Coordinate agent work through structured messaging (Agent Mail)
- Enforce non-overlapping file scopes to prevent merge conflicts
- Monitor agent progress with minimal token overhead
- Collect and synthesize results from parallel execution

**This is not a standalone tool.** It requires the full flywheel stack to be installed and configured.

## Dependencies

### Required (must be installed and configured)

| Dependency | Purpose | Installation |
|------------|---------|--------------|
| **ntm** ≥ 1.7.0 | Multi-agent session management | ACFS verified installer or `brew install dicklesworthstone/tap/ntm` |
| **br** (beads_rust) | Bead task tracking | ACFS verified installer |
| **tmux** | Terminal multiplexer for agent panes | Included in ACFS wizard |
| **Agent Mail** | Inter-agent coordination MCP server | Included in ACFS wizard |

### Optional (enhance functionality)

| Dependency | Purpose | Notes |
|------------|---------|-------|
| **bv** (Beads Viewer) | Task intelligence and planning | Use via `ntm --robot-plan` or `bv --robot-*` only |
| **exploring-codebase** | Architecture discovery skill | For Phase 0.5 validation (bundled in `Extras/`) |

### Flywheel Installation

If you don't have the flywheel stack installed:

```bash
# Visit the TLDR page for installation options
open https://agent-flywheel.com/tldr

# Or run the ACFS wizard directly
curl -sSL https://agent-flywheel.com/install | bash
```

## Installation

### 1. Clone or copy to your skills directory

```bash
# Clone to Claude Code skills directory
git clone https://github.com/emptyaltoidstin/ntm-orchestrator.git ~/.claude/skills/ntm-orchestrator

# Or copy an existing directory
cp -r /path/to/ntm-orchestrator ~/.claude/skills/ntm-orchestrator
```

### 2. Install Node.js dependencies (for hooks)

```bash
cd ~/.claude/skills/ntm-orchestrator
npm install
```

### 3. Configure hooks in Claude Code

Add to your Claude Code settings (`~/.claude/settings.json` or project `.claude/settings.json`):

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node ~/.claude/skills/ntm-orchestrator/hooks/pre-tool-use.js",
            "timeout": 5
          }
        ]
      }
    ],
    "SubagentStop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "node ~/.claude/skills/ntm-orchestrator/hooks/subagent-stop.js",
            "timeout": 5
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node ~/.claude/skills/ntm-orchestrator/hooks/stop.js",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

**Notes:**
- `timeout` is in seconds (not milliseconds)
- `Stop` has no matcher support (always fires)
- `SubagentStop` matcher `""` matches all agent types
- `PreToolUse` matcher `"Bash"` ensures the hook only fires for Bash tool calls
- If you have existing PreToolUse hooks (e.g., `dcg`), add the ntm hook as an additional entry in the same `hooks` array — they run in parallel

### 4. Verify Agent Mail MCP server is running

```bash
# Check that agent-mail is in your MCP config
cat ~/.claude/mcp.json | grep agent-mail

# Or verify directly
curl http://localhost:3001/health  # adjust port as needed
```

### 5. Verify ntm robot mode is available

```bash
ntm --help | grep -q "--robot-" && echo "Robot mode available" || echo "Robot mode NOT available - update ntm"
```

## Setup for Your Project

### Configure quality gates

The skill expects your project to have quality gates that can be run via shell commands. Update `manifest.yaml` if your project uses different commands:

```yaml
# Default (bun-based TypeScript projects)
defaults:
  quality_gates: "bun run typecheck && bun run lint && bun run test"

# For npm-based projects
defaults:
  quality_gates: "npm run typecheck && npm run lint && npm run test"

# For Python projects
defaults:
  quality_gates: "mypy . && ruff check . && pytest"
```

### Configure temp file location

The skill uses a private runtime directory by default:

```bash
${XDG_RUNTIME_DIR:-/tmp}/ntm-orch-$(id -u)
```

Set `NTM_ORCH_RUNTIME_DIR` to override. The runtime directory is expected to be mode `0700`.

If you need a different location, update the paths in:

- `manifest.yaml` (`defaults.temp_file_pattern`)
- `hooks/pre-tool-use.js` (state file functions)
- `SKILL.md` (documentation references)

### Smoke testing

Before using in production, run the smoke tests in `tests/smoke-runs.md` against a test project:

1. Choose a project with quality gates configured
2. Adapt the task descriptions to target files in your project
3. Run through Smoke 1 (Minimal Lifecycle) to verify the full phase sequence works

## Usage

Trigger the skill by asking Claude Code to orchestrate agents:

```
"Spawn 3 agents to work on these tasks in parallel: [task list]"
"Fan out this work across multiple agents"
"Start an ntm session to parallelize the refactoring"
```

The orchestrator will:

1. **Phase 0 - Planning**: Analyze tasks, create non-overlapping file scopes, present manifest for approval
2. **Phase 0.5 - Validation** (optional): Run architecture discovery if codebase is unfamiliar
3. **Phase 1 - Spawn**: Start ntm session, register with Agent Mail, verify agent health
4. **Phase 2 - Distribute**: Preflight-validate prompts (v1.7.0+), send to each agent with their assigned scope
5. **Phase 3 - Monitor**: Use pane state JSON as primary progress source, poll status, handle interventions, detect stalls. Long sessions (30+ min) additionally use `--robot-agent-health` for detailed cost/context tracking
6. **Phase 4 - Collect**: Verify quality gates from state/completion evidence (tail fallback), capture outputs, release file reservations
7. **Phase 5 - Synthesize**: Generate summary report, present results
8. **Phase 6 - Teardown**: Kill session (after capture), clean up temp files

## Supported Agent Types

| Agent | Alias | Best For |
|-------|-------|----------|
| Claude Code | `cc` | Complex multi-file refactoring, architecture decisions, nuanced code review |
| Codex | `cod` | Fast code generation, test writing, documentation |
| Gemini | `gmi` | Documentation review, large context analysis, research tasks |
| Ollama | `oll` | Local inference (no API cost), privacy-sensitive tasks, rapid prototyping |

Default agent mix: `--spawn-cc=7 --spawn-cod=3`. Adjust based on task count and complexity.

## Security Considerations

### State file visibility

The hooks write state files into a private runtime directory (mode `0700`). These files contain:

- Session names
- Timestamps (spawn time, last poll time)
- Process IDs
- Partial command strings (truncated)

On shared systems, verify the runtime directory owner and mode match your user.

### Fail-open design

The hooks use a **fail-open** pattern: if JSON parsing fails or an unexpected error occurs, the operation is **allowed** rather than blocked. This prevents a buggy hook from deadlocking your workflow, but means enforcement is best-effort.

If you need stricter enforcement, modify the `failOpen()` functions in the hooks to `process.exit(2)` instead.

### Capture-before-kill enforcement

The `pre-tool-use` hook enforces that `ntm save <session>` must be run before `ntm kill <session>`. This converts "should save" into "cannot skip save" — even under user pressure to abort immediately. See `hooks/README.md` for the design rationale.

### Session name sanitization

Session names are sanitized via `safeSession()` which strips non-alphanumeric characters. However, session names flow through to:

- Filenames in `/tmp/`
- Shell command arguments
- Agent Mail project keys

Avoid using session names that could be confused with shell metacharacters or path traversal sequences.

### Agent Mail trust model

The skill assumes all agents in a session are trusted collaborators. Agents can:

- Read each other's messages
- See file reservation state
- Send messages to any registered agent

Do not use this skill for adversarial multi-agent scenarios.

### CLAUDECODE environment variable

When spawning from within a Claude Code session, the spawn command uses `env -u CLAUDECODE` to unset the `CLAUDECODE` environment variable. Claude Code 2.1.45+ sets `CLAUDECODE=1` in its environment; without stripping it, spawned panes inherit the variable and refuse to launch nested CC instances.

## Directory Structure

```
ntm-orchestrator/
├── SKILL.md              # Main skill prompt (loaded by Claude Code)
├── manifest.yaml         # Machine-readable metadata and configuration
├── package.json          # Node.js dependencies for hooks
├── README.md             # This file
├── hooks/
│   ├── pre-tool-use.js   # Enforces skill constraints at tool boundary
│   ├── stop.js           # Prevents exit while session is active
│   ├── subagent-stop.js  # Quality gate evidence check for subagents
│   └── README.md         # Hook documentation
├── templates/
│   ├── agent-prompt-*.md # Prompt templates for different task modes
│   ├── status-report.md  # Synthesis report template
│   └── ...               # Mid-session templates (review, commit grouping)
├── patterns/
│   ├── context-refresh.md
│   ├── error-recovery.md
│   └── polling-cadence.md
├── palette/              # Quick-reference task snippets
├── references/           # Documentation for ntm, br, agent-mail
│   └── ntm-commands.md   # Full NTM robot mode command reference
├── Extras/               # Supplementary resources
│   ├── AGENTS-TEMPLATE.md           # Template for project AGENTS.md files
│   ├── bead-polish-ntm-prompts.md   # Prompt polish bead template
│   ├── high-quality-bead-template.md # Bead authoring template
│   └── exploring-codebase/          # Architecture discovery skill
│       ├── SKILL.md
│       ├── manifest.yaml
│       ├── agents/
│       ├── hooks/
│       ├── patterns/
│       ├── templates/
│       └── tests/
└── tests/
    ├── smoke-runs.md     # End-to-end test scenarios
    ├── scenarios.yaml    # Hook unit test scenarios
    └── run.js            # Test runner
```

## Troubleshooting

### "Robot mode not available"

Update ntm to v1.7.0+ which includes robot mode:

```bash
# Via ACFS
curl -sSL https://agent-flywheel.com/install | bash

# Or via Homebrew
brew install dicklesworthstone/tap/ntm

# Or via Cargo
cargo install ntm --force
```

### Hook blocks unexpectedly

Check the specific block message. Common causes:

- **Polling too fast**: Wait 90 seconds between status checks
- **Kill without capture**: Run `ntm save <session>` before killing
- **Bare bv command**: Use `ntm --robot-plan` or `bv --robot-*` flags
- **Missing preflight**: Use `ntm preflight --file=... --json` before `ntm send`

### Session marker is stale

If the stop hook blocks but the session is dead:

```bash
# Verify tmux session is gone
tmux list-sessions | grep <session-name>

# Runtime directory used by hooks
RUNTIME_DIR="${NTM_ORCH_RUNTIME_DIR:-${XDG_RUNTIME_DIR:-/tmp}/ntm-orch-$(id -u)}"

# Inspect markers (exact files)
ls -la "$RUNTIME_DIR/active-session.json"
ls -la "$RUNTIME_DIR/<session>/state.json"
```

### Agent Mail not responding

Verify the MCP server is running and configured:

```bash
# Check MCP config
cat ~/.claude/mcp.json

# Test health endpoint
curl http://localhost:<port>/health
```

## Contributing

This skill is part of the Agentic Flywheel system. For issues and contributions:

- Flywheel repository: <https://github.com/Dicklesworthstone>
- Installation guide: <https://agent-flywheel.com/tldr>

## License

See the Agentic Flywheel repository for license information.

## Version History

- **1.1.0** - NTM v1.7.0+ support: preflight validation, agent health monitoring, ollama agent type, CLAUDECODE env fix, updated model versions, extras bundle
- **1.0.0** - Initial public release as companion to Agentic Flywheel
