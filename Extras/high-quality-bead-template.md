# High-Quality Bead Template

Use this template for new beads so they are executable work specs, not reminders.

## Quality Bar

- Clear problem context and objective
- Explicit scope and out-of-scope
- Verifiable acceptance criteria
- Test requirements defined up front
- Dependencies declared when sequencing matters
- Closure reason includes concrete evidence

## Create Command

For long descriptions, avoid shell quoting issues:

```bash
cat > /tmp/bead-desc.md <<'EOF'
# <Short outcome-oriented title>

## Background
<Why this matters now. Include current behavior and impact.>

## Objective
<What will be true when this bead is done.>

## Scope
- <In-scope item 1>
- <In-scope item 2>
- <In-scope item 3>

## Out of Scope
- <Boundary 1>
- <Boundary 2>

## Acceptance Criteria
- [ ] <Observable behavior 1>
- [ ] <Observable behavior 2>
- [ ] <Edge case behavior>
- [ ] <No regression requirement>

## Tests Required
- Unit: <what to test>
- Integration/E2E: <if applicable>
- Security/negative paths: <if applicable>

## Dependencies
- blocks: <bead-id or "none">
- parent-child: <parent-bead-id or "none">

## Notes
<Implementation hints, risks, constraints, links to spec/doc sections>
EOF

br create "<Title>" -t task -p 2 -d "$(cat /tmp/bead-desc.md)" --json
```

## Title Patterns

- `Fix <component>: <specific failure mode>`
- `Implement <capability> in <module>`
- `Test <module>: <risk/behavior>`
- `Docs: <artifact> for <audience/use>`

Avoid vague titles like `cleanup`, `misc fixes`, `improve code`.

## Acceptance Criteria Rules

- Use checkboxes with concrete, externally testable outcomes.
- Include at least one edge-case criterion.
- Include one non-regression criterion.
- Avoid criteria that are only implementation details.

## Testing Rules

- State test type and target file area.
- Include failure-mode/negative-path coverage when relevant.
- Prefer explicit test scenarios over "tests pass".

## Dependency Rules

- Add `parent-child` for hierarchy beads.
- Add `blocks` for sequencing constraints.
- If bead truly has no dependencies, write that explicitly.

## Close Reason Template

When closing, include implementation evidence:

```text
Implemented in <path1>, <path2>. Added/updated tests in <test-path>.
Verified with: bun run typecheck, bun run lint, bun run test, ubs --diff.
```

Short reasons like `done` are allowed only for trivial/admin beads.
