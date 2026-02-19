# Hooks for exploring-codebase Skill

This directory contains hooks that **actively enforce** the skill's discipline. Unlike documentation that agents can rationalize around, these hooks **block** violations.

## Hook Overview

| Hook | Event | Purpose |
|------|-------|---------|
| `pre-tool-use.js` | PreToolUse (Bash) | Prevents grep shortcuts that bypass discovery |
| `validate-completion.js` | SubagentStop | Validates subagent output completeness |
| `validate-exit-criteria.js` | Stop | Ensures all exit criteria met before skill completion |

## How Hooks Work

### Input Contract

All hooks receive JSON via stdin:

```json
{
  "skill_name": "exploring-codebase",
  "skill_phase": "phase-1",
  "tool_name": "Bash",
  "tool_input": { "command": "grep -r 'pattern' ." },
  "session_context": "SKILL: exploring-codebase\nPHASE: 1-Discovery\n...",
  "agent_type": "discovery-agent",
  "stop_hook_active": false
}
```

### Output Contract

Hooks output JSON to stdout:

```json
{
  "decision": "approve|block",
  "reason": "Explanation shown to agent",
  "inject_context": "Optional context added to agent's next prompt"
}
```

### Decision Types

- **`approve`**: Allow the action to proceed
- **`block`**: Prevent the action, show `reason` to agent

## Hook Details

### pre-tool-use.js

**Triggers on:** Bash tool calls during skill execution

**Blocks:**
- Grep shortcuts during Phase 1 (before discovery complete)
- Find shortcuts with `| head` (quick peeks)
- Commands containing red flag phrases ("just quickly", "faster to")

**Allows:**
- Directory structure discovery (`find -type d`)
- Documentation reading (`cat README.md`)
- File inventory (`ls -la`, `wc -l`)

**Example Block:**
```
Grep/find shortcut detected during Discovery phase.

Per Red Flags table: "Grep is faster for this simple question" is a TRAP.

REQUIRED: Complete Phase 1 discovery first.
```

### validate-completion.js

**Triggers on:** SubagentStop event

**Validates:**
- All required sections present in output
- No incomplete indicators (TODO, placeholders, ellipsis)
- Sufficient file:line references (minimum 3)
- Not excessive speculation (too many "probably", "likely")

**Example Block:**
```
Subagent output validation failed.

ISSUES FOUND:
- Missing required sections: INTEGRATION POINTS, KEY FILES
- Ends with ellipsis (incomplete)

REQUIRED: Complete all required sections with file:line evidence.
```

### validate-exit-criteria.js

**Triggers on:** Stop event (skill completion attempt)

**Validates:**
- Phase 1: Discovery complete with architecture, components, layers
- Phase 2: All perspectives explored with target documented
- Phase 3: Synthesis complete with cross-cutting insights

**Example Block:**
```
Cannot complete skill - exit criteria not met.

FAILED CRITERIA:

  ❌ All discovered perspectives explored
     Phase: Phase 2 (Deep Dive)
     Recovery: Run deep-dive-agent for remaining perspectives

CURRENT STATE:
- Discovery complete: true
- Deep dives: 2/4
- Synthesis complete: false

Complete the required phases before attempting to finish.
```

## Platform Integration

### Claude Code

Add to `~/.claude/hooks.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "~/.claude/skills/exploring-codebase/hooks/pre-tool-use.js"
          }
        ]
      }
    ],
    "SubagentStop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "~/.claude/skills/exploring-codebase/hooks/validate-completion.js"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "~/.claude/skills/exploring-codebase/hooks/validate-exit-criteria.js"
          }
        ]
      }
    ]
  }
}
```

### Other Platforms

For platforms without native hook support, the hook logic can be:

1. **Embedded in prompts**: Add validation checks as part of agent instructions
2. **Post-processing**: Validate output after agent responds
3. **Wrapper scripts**: Run hooks as pre/post processors around agent calls

## Testing Hooks

```bash
# Test pre-tool-use hook
echo '{"skill_name":"exploring-codebase","tool_name":"Bash","tool_input":{"command":"grep -r pattern ."},"session_context":"PHASE: 1"}' | node pre-tool-use.js

# Test completion validation
echo '{"skill_name":"exploring-codebase","agent_type":"discovery-agent","subagent_output":"## DISCOVERY SUMMARY\n..."}' | node validate-completion.js

# Test exit criteria
echo '{"skill_name":"exploring-codebase","session_context":"DISCOVERY_COMPLETE: true\nDEEP_DIVES_COMPLETE: 4/4\n..."}' | node validate-exit-criteria.js
```

## Design Principles

1. **Fail closed**: When in doubt, block and explain why
2. **Clear recovery**: Every block includes how to proceed
3. **Evidence-based**: Checks are objective, not subjective
4. **No false positives**: Legitimate exploration patterns allowed
5. **Transparent**: Agent sees exactly why they were blocked
