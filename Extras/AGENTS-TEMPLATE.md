# AGENTS.md — {{PROJECT_NAME}}

This is the authoritative guide for AI coding agents working in `{{REPO_SLUG}}/`.

---

## RULE 0 — THE FUNDAMENTAL OVERRIDE PREROGATIVE

If I tell you to do something, even if it goes against what follows below, YOU MUST LISTEN TO ME. I AM IN CHARGE, NOT YOU.

---

## RULE 1 — ABSOLUTE (DO NOT EVER VIOLATE THIS)

You may NOT delete any file or directory unless I explicitly give the exact command **in this session**.

- This includes files you just created (tests, tmp files, scripts, etc.).
- You do not get to decide that something is "safe" to remove.
- If you think something should be removed, stop and ask. You must receive clear written approval **before** any deletion command is even proposed.

Treat "never delete files without permission" as a hard invariant.

<!-- OPTIONAL: Add narrow runtime artifact exceptions if your project has specific
     temp/runtime dirs that agents may clean up. Use the format below.

### Narrow Runtime Artifact Exceptions

**Exception N — {{TOOL/RUNTIME}} artifacts** outside the repo, under:

`{{RUNTIME_DIR}}`

Allowed only when ALL conditions are true:

1. Exact file paths only (no globs/wildcards)
2. File is a {{TOOL/RUNTIME}} runtime marker/artifact
3. File is owned by the current user
4. Path resolves inside the runtime directory (no symlink/path traversal escapes)

These exceptions do **not** change the rule for repo files: deleting anything in the
repo still requires explicit user command approval in this session.
-->

---

## Forbidden Git & Filesystem Commands

Absolutely forbidden unless I give the **exact command and explicit approval** in the same message:

- `git reset --hard`
- `git clean -fd`
- `rm -rf`
- Any command that can delete or overwrite code/data

Rules:

1. If you are not 100% sure what a command will delete, do not propose or run it. Ask first.
2. Prefer safe tools: `git status`, `git diff`, `git stash`, copying to backups, etc.
3. After approval, restate the command verbatim, list what it will affect, and wait for confirmation.
4. When a destructive command is run, record in your response:
   - The exact user text authorizing it
   - The command run
   - When you ran it

If that audit trail is missing, then you must act as if the operation never happened.

---

## Project Overview

<!-- PROJECT-SPECIFIC: Replace this entire section with your project's overview. -->

{{PROJECT_DESCRIPTION}}

**Repository:** {{REPO_URL}}
**License:** {{LICENSE}}

### Architecture

<!-- PROJECT-SPECIFIC: Describe your project's architecture here.
     Include component table, communication flow, and any diagrams. -->

{{ARCHITECTURE_DESCRIPTION}}

### Tech Stack

<!-- PROJECT-SPECIFIC: Fill in your actual tech stack. -->

| Layer            | Technology             |
| ---------------- | ---------------------- |
| Language         | {{LANGUAGE}}           |
| UI Framework     | {{UI_FRAMEWORK}}       |
| State Management | {{STATE_MANAGEMENT}}   |
| Bundler          | {{BUNDLER}}            |
| Unit Testing     | {{TEST_FRAMEWORK}}     |
| E2E Testing      | {{E2E_FRAMEWORK}}      |

---

## Package Manager — {{PACKAGE_MANAGER}} ONLY

<!-- PROJECT-SPECIFIC: Specify your package manager and its commands. -->

We **only** use `{{PACKAGE_MANAGER}}` in this project. NEVER use {{FORBIDDEN_PACKAGE_MANAGERS}}.

```bash
{{PM}} install          # Install dependencies
{{PM}} run dev          # Dev server
{{PM}} run build        # Production build
{{PM}} run typecheck    # Type-check (no emit)
{{PM}} run lint         # Lint
{{PM}} run test         # Unit tests
```

Dependencies are managed **exclusively** via `package.json` + `{{LOCKFILE}}`. Do **not** introduce other lockfiles.

---

## Repo Layout

<!-- PROJECT-SPECIFIC: Replace with your actual repo structure. -->

```
{{REPO_SLUG}}/
├── README.md
├── AGENTS.md                     # AI agent guidelines (this file)
├── .beads/                       # Issue tracking (ALWAYS COMMIT)
│
{{REPO_TREE}}
```

---

## Where to Change Things (End-to-End Map)

<!-- PROJECT-SPECIFIC: Document common change patterns for your project.
     This section helps agents understand the impact of modifications. -->

{{CHANGE_MAP}}

---

## Code Editing Discipline

- Do **not** run scripts that bulk-modify code (codemods, invented one-off scripts, giant `sed`/regex refactors).
- Large mechanical changes: break into smaller, explicit edits and review diffs.
- Subtle/complex changes: edit by hand, file-by-file, with careful reasoning.

### Backwards Compatibility & File Sprawl

We optimize for a clean architecture now, not backwards compatibility.

- No "compat shims" or "v2" file clones.
- When changing behavior, migrate callers and remove old code.
- New files are only for genuinely new domains that don't fit existing modules.
- The bar for adding files is very high.

---

## Quality Gates — NO EXCEPTIONS

**ABSOLUTE RULE:** You may NOT bypass or weaken quality gates to force a commit. Quality problems must be fixed, not hidden.

### Required Checks (Must All Pass)

```bash
{{PM}} run typecheck    # Zero TypeScript errors
{{PM}} run lint         # Zero lint errors
{{PM}} run test         # 100% test pass rate
ubs --diff              # UBS finds no issues (scan only modified files)
```

### FORBIDDEN Workaround Tactics

These tactics are **BANNED** and will result in immediate work rejection:

**Lint Rule Manipulation:**

```bash
# ❌ NEVER
'@typescript-eslint/no-explicit-any': 'warn'  # Relaxing rules
ignorePatterns: ['problem-file.ts']           # Hiding files
```

**Type Safety Bypasses:**

```typescript
// ❌ NEVER
const value = arr[0]!;   // Non-null assertion without validation
/* eslint-disable ... */  // Inline disables
```

**False Justifications:**

```typescript
// ❌ NEVER
// "Temporarily relaxed for infrastructure commit"
// "We'll fix it in the next PR"
// "It's better to have working code than perfect code"
```

### Correct Approach to Quality Issues

When quality gates fail:

1. **Stop and Assess** — Don't look for workarounds
2. **Understand the Root Cause** — Read error messages carefully
3. **Fix the Actual Problem** — Address the underlying issue
4. **Verify the Fix** — Gates must genuinely pass
5. **If Unfixable Now** — Don't commit. Create beads for follow-up.

<!-- OPTIONAL: Add language-specific best practices here.
     See the MapMinion AGENTS.md for TypeScript-specific examples
     (null handling, error types, API typing). -->

---

## Testing

### Unit Tests

```bash
{{PM}} run test              # Run all
{{PM}} run test:coverage     # With coverage
{{PM}} run test:watch        # Watch mode
```

<!-- PROJECT-SPECIFIC: Document where tests live and any prerequisites. -->

### E2E Tests

<!-- PROJECT-SPECIFIC: Document E2E test setup, prerequisites, and commands. -->

```bash
{{PM}} run test:e2e          # Run E2E tests
```

### Test Coverage Requirements

<!-- PROJECT-SPECIFIC: List the specific areas that require test coverage. -->

- {{COVERAGE_AREAS}}

---

## Session Completion Workflow

**When ending a work session**, choose the correct mode first:

- **Single-Agent / Integrator Mode:** One agent owns git integration for the current tree. Work is NOT complete until `git push` succeeds.
- **Shared-Tree Worker Mode (no worktrees/branches):** Worker agents do implementation + handoff only. Worker work is complete after handoff; workers do NOT pull/rebase/push.

### Shared-Tree Multi-Agent Mode (No Worktrees / No Per-Agent Branches)

Use this mode when multiple agents edit the same working tree in parallel.

1. Assign exactly one **Integrator** for the session.
2. Worker agents reserve files, implement scoped changes, and send handoff summaries.
3. Worker agents MUST NOT run `git pull --rebase`, `git push`, or `git commit --no-verify`.
4. Worker agents report:
   - Files changed
   - Commands run
   - Check results
   - Remaining risks/blockers
5. Integrator runs full quality gates on the combined tree, then performs commit/pull/push.

### Quality Gate Order (CRITICAL)

For **Single-Agent / Integrator Mode**, run quality gates **BEFORE committing** (on uncommitted changes):

```bash
{{PM}} run typecheck && {{PM}} run lint && {{PM}} run test && ubs --diff
```

<!-- OPTIONAL: Add a convenience alias if your project has one, e.g.:
```bash
{{PM}} run gates
```
-->

⚠️ Running `ubs --diff` on already-committed code is **FORBIDDEN** — it bypasses validation.

### Commit and Push Workflow (Single-Agent / Integrator Mode)

**Preferred:** Use `/commit` (git-committer skill) for intelligent grouping and detailed commit messages.

**Manual fallback:**

```bash
# 1. Run quality gates on uncommitted changes (see above)
# 2. Fix any issues and re-run until clean
# 3. File issues for remaining work
br create "Issue title" -t task -p 2 --json

# 4. Sync beads and commit
br sync --flush-only
git add .beads/
git commit -m "chore: update beads"

# 5. Commit code changes
git add .
git commit -m "feat/fix/chore: description"

# 6. Push (MANDATORY)
git pull --rebase
git push

# 7. Verify
git status  # MUST show "up to date with origin"
```

**CRITICAL RULES:**

- In **Single-Agent / Integrator Mode**, work is NOT complete until `git push` succeeds
- In **Single-Agent / Integrator Mode**, NEVER stop before pushing
- In **Single-Agent / Integrator Mode**, NEVER say "ready to push when you are" — you must push
- In **Shared-Tree Worker Mode**, NEVER push; hand off to the Integrator
- If push fails, resolve and retry until it succeeds

---

## Issue Tracking with br (Beads)

All issue tracking goes through **Beads**. No other TODO systems.

**Note:** `br` is a convenience alias for `bd`. Use either.

### Basics

```bash
br ready --json                           # Check unblocked work
br query list --json                      # List saved triage queries
br query run <name> --json                # Run saved query
br create "Title" -t bug|feature|task -p 0-4 --json  # Create issue
br update br-42 --status in_progress --json   # Claim work
br close br-42 --reason "Completed" --json    # Complete work
br sync --flush-only                          # Export for commit
```

### Saved Queries — Pre-Triage (MANDATORY)

Before selecting work, agents MUST check for saved queries first:

1. Run `br query list --json`
2. If a relevant query exists, run `br query run <name> --json` and pick from that output
3. If no relevant query exists, fall back to `br ready --json` (or `bv --robot-triage` for graph-aware triage)

### Shell Quoting — Long Descriptions

For any `br create -d` description over ~200 characters, write it to a temp file first to avoid JSON parse errors from multiline text and special characters:

```bash
printf '%s' "Your long description here..." > /tmp/bead-desc.md
br create "Title" -t task -p 2 -d "$(cat /tmp/bead-desc.md)" --json
```

### Bead Quality Template

Use `.beads/high-quality-bead-template.md` when creating new beads. The template standardizes:

- Background + objective + scope boundaries
- Checkbox-based acceptance criteria
- Explicit testing requirements
- Dependency wiring (`blocks`, `parent-child`)
- Evidence-rich close reasons

### Types and Priorities

**Types:** `bug`, `feature`, `task`, `epic`, `chore`

**Priorities:** `0` (Critical) → `1` (High) → `2` (Medium) → `3` (Low) → `4` (Backlog)

### Agent Workflow — Claim Protocol (MANDATORY)

**Before claiming any bead, you MUST complete steps 0–5 in order. Skipping steps causes duplicate work.**

0. **Query check first**: `br query list --json` then prefer `br query run <name> --json` when available; otherwise use `br ready --json`
1. **Check bead status**: `br show <id> --json` — if `status: "in_progress"`, **skip it** and pick another
2. **Check inbox**: `fetch_inbox` for messages in the last 5 minutes — if another agent announced a claim on that bead's thread, **skip it**
3. **Reserve files**: `file_reservation_paths(...)` with the bead id as `reason` — if you get `FILE_RESERVATION_CONFLICT`, **the bead is taken, back off**
4. **Announce via Agent Mail**: `send_message(thread_id: "<bead-id>", subject: "[<bead-id>] Starting: <title>")` — this is **non-optional** and must happen **after** reservation succeeds but **before** editing any files
5. **Claim in Beads**: `br update <id> --status in_progress`

**After claiming:**

6. Implement + test
7. Create follow-up beads if you discover new work
8. Close when done: `br close <id> --reason "..."`
9. Release file reservations
10. Send completion message in the same thread

### Dependency Wiring Verification

After batching `br update <id> --deps <ids>` calls, spot-check 2–3 beads to confirm deps registered correctly — command exit codes alone don't prove the dependency array was updated:

```bash
br show <id> --json   # look for "dependencies" array in output
```

### Beads Commit Discipline

- **Commit beads changes immediately** after any `bd update`, `bd close`, or `br sync` — do not let them accumulate
- **Separate beads commits from code commits**: `git add .beads/ && git commit -m "chore: update beads"` — never mix beads state changes into code commits
- This prevents one agent's beads mutations from being swept into another agent's code commit

---

## Tool Quick References

### br query — Saved Filters

Use saved queries to standardize selection across agents.

```bash
br query list --json                             # List available saved queries
br query run <name> --json                       # Run a saved query
br query save <name> --description "..." -l e2e --status open --json  # Save current filter set
```

### bv — Beads Viewer / Triage

⚠️ **CRITICAL:** Use ONLY `--robot-*` flags. Bare `bv` launches interactive TUI that blocks your session.

```bash
bv --robot-triage        # Full triage analysis
bv --robot-next          # Single top-priority pick
bv --robot-plan          # Parallel execution tracks
bv --robot-priority      # Priority misalignment detection
bv --robot-insights      # Full graph metrics
```

### UBS — Ultimate Bug Scanner

```bash
ubs file.ts file2.ts                    # Specific files
ubs $(git diff --name-only --cached)    # Staged files
ubs $(git diff --name-only)             # Uncommitted changes
ubs .                                   # Whole project
```

Exit 0 = safe. Exit >0 = fix and re-run.

### cass — Cross-Agent Search

Never run bare `cass` (TUI). Always use `--robot` or `--json`.

```bash
cass health
cass search "token validation" --robot --limit 5
cass view /path/to/session.jsonl -n 42 --json
```

### DCG — Destructive Command Guard

Auto-blocks: `git reset --hard`, `git push --force`, `git clean -f`, `rm -rf <non-temp>`

When blocked: Read the reason, ask the user to run manually if truly needed, consider safer alternatives.

### cm — Context Manager (Playbook)

Retrieves contextual rules, anti-patterns, and history before starting work; trains the playbook after completing work.

⚠️ **CRITICAL:** Always use `--json` flag for agent use.

```bash
cm context "<task description>" --json   # Get relevant rules/anti-patterns before starting a task
cm mark <id> --helpful --json            # Mark a rule as helpful after completing work
cm mark <id> --harmful --reason "<why>" --json  # Mark a rule as harmful with explanation
```

**Workflow integration:**

1. **Before starting any task:** `cm context "<task description>" --json` — review returned rules before proceeding
2. **After completing a task:** `cm mark <id> --helpful --json` or `cm mark <id> --harmful --reason "<reason>" --json` — this trains the playbook for future sessions

### APR — Automated Plan Reviser Pro

Iterative spec refinement via GPT Pro Extended Reasoning. Bundles README + spec + implementation, sends through multiple AI review rounds, and tracks convergence.

⚠️ **CRITICAL:** For agent use, always use `robot` subcommand (JSON API). Bare `apr run` may launch interactive browser sessions.

**Workflow commands:**

```bash
apr setup                      # Interactive wizard (first time per workflow)
apr run <N>                    # Run revision round N
apr run <N> -i                 # Include implementation doc
apr run <N> -d                 # Dry-run preview
apr show <N>                   # View round output
```

**Analysis commands:**

```bash
apr diff <N> [M]               # Compare rounds (N vs M, or N vs N-1)
apr stats                      # Convergence analytics + remaining rounds estimate
apr integrate <N> -c           # Claude Code prompt → clipboard (KEY COMMAND)
```

**Management commands:**

```bash
apr status [--hours 24]        # Oracle session status
apr attach <slug>              # Reattach to session
apr list                       # List workflows
apr history                    # Round history
apr backfill                   # Generate metrics from existing rounds
apr update                     # Self-update
```

**Robot mode (JSON API):**

```bash
apr robot workflows                        # List configured workflows
apr robot validate <N> -w <workflow>       # Validate round config
apr robot run <N> -w <workflow>            # Execute round N
apr robot status --format json             # Check Oracle session status
apr robot status --format toon             # Token-optimized output (requires tru)
apr stats -w <workflow> --json --detailed  # Convergence analytics
apr integrate <N> -w <workflow> --copy     # Generate Claude Code integration prompt
```

**Key paths:**

- `.apr/workflows/*.yaml` — Workflow configs (README, spec, impl paths, model)
- `.apr/rounds/<workflow>/round_N.md` — GPT output per round
- `.apr/analytics/<workflow>/metrics.json` — Convergence data

**Convergence:** Score ≥0.75 signals design stability. Use `apr stats` to decide when to stop iterating.

**After saving a new round:** Always backfill metrics immediately so `apr stats` reflects current state:

```bash
apr backfill -w <workflow> --force
```

**Resuming a workflow:** Read the handoff doc first — not the spec, not the round files. The handoff has the decision context, current status, and workflow steps in one place:

```
.apr/rounds/<workflow>/handoff-round<N>.md
```

**First run requires** `apr run 1 --login --wait` for manual ChatGPT browser login.

---

## MCP Agent Mail

This project uses MCP Agent Mail for inter-agent coordination.

**What it is:** A mail-like layer that lets coding agents coordinate asynchronously via MCP tools and resources. Provides identities, inbox/outbox, searchable threads, and advisory file reservations, with human-auditable artifacts in Git.

**Why it's useful:**

- Prevents agents from stepping on each other with explicit file reservations (leases)
- Keeps communication out of your token budget by storing messages in a per-project archive
- Offers quick reads via resource URIs and macros that bundle common flows

### Registration

```javascript
mcp__mcp_agent_mail__register_agent({
  project_key: '{{PROJECT_PATH}}',
  program: '{{AGENT_PROGRAM}}',
  model: '{{AGENT_MODEL}}',
  task_description: 'Brief description of current work',
});
```

### File Reservations

**CRITICAL:** Reserve files before editing to signal intent and avoid conflicts.

```javascript
// Reserve files exclusively before editing
mcp__mcp_agent_mail__call_extended_tool({
  tool_name: 'file_reservation_paths',
  arguments: {
    project_key: '{{PROJECT_PATH}}',
    agent_name: 'YourName',
    paths: ['{{EXAMPLE_GLOB_PATTERN}}'],
    ttl_seconds: 3600,
    exclusive: true,
    reason: 'bd-101i',
  },
});

// Release when done
mcp__mcp_agent_mail__call_extended_tool({
  tool_name: 'release_file_reservations',
  arguments: {
    project_key: '{{PROJECT_PATH}}',
    agent_name: 'YourName',
    paths: ['{{EXAMPLE_GLOB_PATTERN}}'],
  },
});
```

**Tip:** Set `AGENT_NAME` in your environment so the pre-commit guard can block commits that conflict with others' active exclusive file reservations.

### Resource URIs

Resource URIs use the **project slug**, not the raw path:

| Resource          | Correct URI                                                       |
| ----------------- | ----------------------------------------------------------------- |
| Projects list     | `resource://projects`                                             |
| Agents in project | `resource://agents/{{PROJECT_SLUG}}`                              |
| Inbox (fast read) | `resource://inbox/{Agent}?project=<abs-path>&limit=20`            |
| Thread            | `resource://thread/{id}?project=<abs-path>&include_bodies=true`   |

**Common Mistakes:**

- ❌ `resource://agents//data/projects/foo` (double slash, raw path)
- ✅ `resource://agents/{{PROJECT_SLUG}}` (slug format)

### Operations

```javascript
// Check inbox
mcp__mcp_agent_mail__fetch_inbox({
  project_key: '{{PROJECT_PATH}}',
  agent_name: 'YourName',
});

// Send message (use thread_id for related discussions)
mcp__mcp_agent_mail__send_message({
  project_key: '{{PROJECT_PATH}}',
  sender_name: 'YourName',
  to: ['OtherAgent'],
  subject: '[bd-101i] Starting auth refactor',
  body_md: 'Message content',
  thread_id: 'bd-101i',
});

// Acknowledge messages that require it
mcp__mcp_agent_mail__call_extended_tool({
  tool_name: 'acknowledge_message',
  arguments: {
    project_key: '{{PROJECT_PATH}}',
    agent_name: 'YourName',
    message_id: 42,
  },
});
```

### Macros vs Granular Tools

**Prefer macros** when you want speed or are on a smaller model:

- `macro_start_session` — register + check inbox in one call
- `macro_prepare_thread` — set up a thread with reservations
- `macro_file_reservation_cycle` — reserve, work, release pattern
- `macro_contact_handshake` — link agents across repos

**Use granular tools** when you need fine control:

- `register_agent`, `file_reservation_paths`, `send_message`, `fetch_inbox`, `acknowledge_message`

### Beads + Agent Mail Integration

Use Beads for task status/priority/dependencies; use Agent Mail for conversation, decisions, and attachments.

**Shared identifiers:** Use the Beads issue id (e.g., `bd-101i`) as the Mail `thread_id` and prefix message subjects with `[bd-101i]`.

#### Thread IDs (REQUIRED)

To keep work discoverable and to prevent "orphan" discussions, **all work-related Agent Mail messages MUST use a `thread_id`.**

- If the message is about a bead, set `thread_id` to the **exact bead id** (example: `bd-101i`) and start the subject with `[bd-101i]`.
- Use one bead per thread. If the topic changes materially, create/use a different bead and start a new thread.
- For rare non-bead coordination (e.g., urgent ops), use `thread_id: ops-YYYY-MM-DD-<topic>` and create a bead immediately after.
- Prefer `reply_message(...)` when continuing an existing thread so the thread linkage is preserved automatically.

**Typical flow:**

1. **Pick ready work** (Beads): `br query list --json` → if relevant query exists run `br query run <name> --json`, else `br ready --json`
2. **Reserve edit surface** (Mail): `file_reservation_paths(..., reason="bd-101i")`
3. **Announce start** (Mail): `send_message(..., thread_id="bd-101i", subject="[bd-101i] Start: <title>")`
4. **Work and update**: Reply in-thread with progress; keep discussion in one thread per issue
5. **Complete and release**:
   - `br close bd-101i --reason "Completed"` (Beads is status authority)
   - `release_file_reservations(...)` (Mail)
   - Final Mail reply: `[bd-101i] Completed` with summary

### Common Pitfalls

| Error                       | Cause                                     | Fix                                                    |
| --------------------------- | ----------------------------------------- | ------------------------------------------------------ |
| `from_agent not registered` | Forgot to register                        | Call `register_agent` first with correct `project_key` |
| `FILE_RESERVATION_CONFLICT` | Another agent holds exclusive reservation | Adjust patterns, wait for expiry, or use non-exclusive |
| Auth errors                 | JWT/JWKS mismatch                         | Include bearer token with matching `kid`               |

### Coordination Best Practices

**Do:**

- Register at session start with your agent name
- Before starting any task, run `cm context "<task description>" --json` and review the returned rules, anti-patterns, and history snippets before proceeding
- After completing a task, mark rules that helped with `cm mark <id> --helpful --json` or hurt with `cm mark <id> --harmful --reason "<reason>" --json` — this trains the playbook
- Reserve files before editing; include beads id in the `reason`
- Use `thread_id` to keep related discussion in a single thread
- Keep subjects concise and specific (aim for ≤80 characters)
- Address only relevant recipients; use CC/BCC sparingly
- If you discover follow-up work, create a bead and notify the team
- Avoid "communication purgatory": send a short update, then keep shipping

**Don't:**

- Create or manage tasks in Mail — treat Beads as the single task queue
- Send large, repeated binaries — reuse prior attachments when possible
- Change topics mid-thread — start a new thread for a new subject
- Broadcast to all agents unnecessarily — target just agents who need to act

---

## Low Context Handoff

If your context window is getting low:

1. Create a bead titled `Handoff: <topic>` with:
   - Current branch/head SHA
   - What's implemented vs missing
   - Commands run and results
   - Next concrete steps
2. Optionally send a team mail summarizing the same
3. If you are the Single-Agent/Integrator, commit and push before you lose critical state
4. If you are a Shared-Tree Worker, send a handoff update and stop (no pull/rebase/push)

---

## Multi-Agent Environment

If you see uncommitted changes you didn't make, those are from other agents working on the project. NEVER stash, revert, or disturb other agents' work. Treat those changes as if you made them yourself.

---

## Important Files Reference

<!-- PROJECT-SPECIFIC: List your key files and their purposes. -->

| File                         | Purpose                          |
| ---------------------------- | -------------------------------- |
| {{FILE_PATH_1}}              | {{PURPOSE_1}}                    |
| {{FILE_PATH_2}}              | {{PURPOSE_2}}                    |

---

<!-- OPTIONAL: Add a Security Checklist section if your project has security-sensitive code.

## Security Checklist

Before any PR touching security-sensitive code:

- [ ] {{SECURITY_CHECK_1}}
- [ ] {{SECURITY_CHECK_2}}
-->

## UBS Quick Reference for AI Agents

UBS stands for "Ultimate Bug Scanner": **The AI Coding Agent's Secret Weapon: Flagging Likely Bugs for Fixing Early On**

**Install:** `curl -sSL https://raw.githubusercontent.com/Dicklesworthstone/ultimate_bug_scanner/master/install.sh | bash`

**Golden Rule:** `ubs <changed-files>` before every commit. Exit 0 = safe. Exit >0 = fix & re-run.

**Commands:**

```bash
ubs file.ts file2.py                    # Specific files (< 1s) — USE THIS
ubs $(git diff --name-only --cached)    # Staged files — before commit
ubs --only=js,python src/               # Language filter (3-5x faster)
ubs --ci --fail-on-warning .            # CI mode — before PR
ubs --help                              # Full command reference
ubs sessions --entries 1                # Tail the latest install session log
ubs .                                   # Whole project (ignores things like .venv and node_modules automatically)
```

**Output Format:**

```
⚠️  Category (N errors)
    file.ts:42:5 – Issue description
    💡 Suggested fix
Exit code: 1
```

Parse: `file:line:col` → location | 💡 → how to fix | Exit 0/1 → pass/fail

**Fix Workflow:**

1. Read finding → category + fix suggestion
2. Navigate `file:line:col` → view context
3. Verify real issue (not false positive)
4. Fix root cause (not symptom)
5. Re-run `ubs <file>` → exit 0
6. Commit

**Speed Critical:** Scope to changed files. `ubs src/file.ts` (< 1s) vs `ubs .` (30s). Never full scan for small edits.

**Bug Severity:**

- **Critical** (always fix): Null safety, XSS/injection, async/await, memory leaks
- **Important** (production): Type narrowing, division-by-zero, resource leaks
- **Contextual** (judgment): TODO/FIXME, console logs

**Anti-Patterns:**

- ❌ Ignore findings → ✅ Investigate each
- ❌ Full scan per edit → ✅ Scope to file
- ❌ Fix symptom (`if (x) { x.y }`) → ✅ Root cause (`x?.y`)

---

<!--
=============================================================================
TEMPLATE USAGE GUIDE

To use this template for a new project:

1. Copy this file to your project root as AGENTS.md
2. Find-and-replace the following placeholders:

   {{PROJECT_NAME}}            — Your project's display name
   {{REPO_SLUG}}               — Directory/repo name (e.g., my_project)
   {{PROJECT_DESCRIPTION}}     — 1-2 paragraph project overview
   {{REPO_URL}}                — GitHub/GitLab URL
   {{LICENSE}}                 — License type (MIT, Apache-2.0, etc.)
   {{ARCHITECTURE_DESCRIPTION}}— Architecture overview with component table
   {{LANGUAGE}}                — Primary language (TypeScript, Python, etc.)
   {{UI_FRAMEWORK}}            — UI framework or "N/A"
   {{STATE_MANAGEMENT}}        — State management or "N/A"
   {{BUNDLER}}                 — Build tool (Vite, Webpack, esbuild, etc.)
   {{TEST_FRAMEWORK}}          — Unit test framework (Vitest, Jest, pytest, etc.)
   {{E2E_FRAMEWORK}}           — E2E framework (Playwright, Cypress, etc.) or "N/A"
   {{PACKAGE_MANAGER}}         — Package manager name (bun, npm, yarn, pnpm, pip)
   {{FORBIDDEN_PACKAGE_MANAGERS}} — Package managers NOT to use
   {{PM}}                      — Package manager CLI command (bun, npm, yarn)
   {{LOCKFILE}}                — Lock file name (bun.lock, package-lock.json, etc.)
   {{REPO_TREE}}               — Your project's directory tree
   {{CHANGE_MAP}}              — End-to-end guide for common modifications
   {{COVERAGE_AREAS}}          — Areas requiring test coverage
   {{PROJECT_PATH}}            — Absolute path to project (e.g., /data/projects/foo)
   {{PROJECT_SLUG}}            — Slug-format path (e.g., data-projects-foo)
   {{AGENT_PROGRAM}}           — Agent program name (claude-code, cursor, etc.)
   {{AGENT_MODEL}}             — Model name (opus-4.6, gpt-4, etc.)
   {{EXAMPLE_GLOB_PATTERN}}    — Example file glob for reservations
   {{FILE_PATH_N}}             — Key file paths for reference table
   {{PURPOSE_N}}               — Descriptions for reference table

3. Remove HTML comments (<!-- ... -->) after filling in sections
4. Add/remove optional sections (Runtime Exceptions, Security Checklist,
   language-specific best practices) as needed for your project
5. Copy .beads/high-quality-bead-template.md to your project's .beads/ dir

TOOLS REFERENCED IN THIS TEMPLATE:
  br / bd   — Beads issue tracker    (https://github.com/emptyaltoidstin/beads)
  bv        — Beads Viewer / triage  (TUI + --robot-* CLI)
  UBS       — Ultimate Bug Scanner   (https://github.com/Dicklesworthstone/ultimate_bug_scanner)
  DCG       — Destructive Command Guard
  cm        — Context Manager / Playbook
  APR       — Automated Plan Reviser Pro
  cass      — Cross-Agent Search
  Agent Mail— MCP Agent Mail (inter-agent coordination)
  ntm       — NTM Orchestrator (if applicable)
=============================================================================
-->
