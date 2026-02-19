# Anti-Rationalization Table: exploring-codebase

**MANDATORY: This table prevents you from skipping required exploration steps.**

## How to Use This Table

When you catch yourself thinking any rationalization from this table:
1. **STOP** - Do not proceed with the shortcut
2. **Check the counter** - Read why it's wrong
3. **Execute the Required Action** - Do what the skill requires
4. **Continue** - Proceed with systematic exploration

---

## Rationalization → Counter → Action

| Rationalization | Why It Feels Right | Why It's WRONG | Required Action |
|-----------------|-------------------|----------------|-----------------|
| **"I already know this architecture"** | You've worked here before, you remember the structure | Prior knowledge is incomplete. Code changes. Mental models drift. Assumptions about "known" code cause most bugs. | **Run discovery to validate assumptions** |
| **"Simple question about location"** | User just asked "where is X?" - seems straightforward | Location questions lead to "how does it work?" next. One exploration answers current + future questions. | **Use skill to provide comprehensive answer** |
| **"Production emergency, no time"** | Pressure is real, users are affected, every minute counts | High stakes demand MORE rigor. 6-10 min discovery prevents hours debugging wrong assumptions. Wrong fix = more downtime. | **Proceed with skill - it's faster overall** |
| **"Colleague told me the structure"** | Authority figure provided info, they work here daily | High-level ≠ implementation details. Colleagues forget things. Colleagues have stale knowledge. | **Discovery finds what they forgot** |
| **"Grep is faster for this"** | Single command vs. multi-phase process | One systematic exploration > multiple ad-hoc greps + follow-up questions + debugging wrong assumptions | **Complete Phase 1 before targeted searches** |
| **"This is overkill"** | Seems like more process than needed | Incomplete understanding compounds. The cost of skipping > cost of doing. Every "overkill" saves hours later. | **Apply full process** |
| **"I'll explore progressively if stuck"** | Reactive approach seems efficient | Reactive exploration is always less efficient than proactive discovery. Getting unstuck costs more than not getting stuck. | **Proactive discovery prevents getting stuck** |
| **"Let me just quickly check..."** | Quick check feels productive | Ad-hoc investigation trap. "Quick checks" multiply. Systematic beats quick every time. | **Use structured process** |
| **"Being pragmatic means..."** | Flexibility is good, right? | False pragmatism. Real pragmatism = investing upfront to save later. Shortcuts compound into tech debt. | **Real pragmatism = doing it right** |
| **"User asked me to skip"** | Honoring user requests seems right | User doesn't know the cost of skipping. Your job is to provide best outcome, not just follow instructions. | **Explain trade-offs, proceed correctly** |

---

## Pressure-Specific Counters

### Time Pressure

| They Say | You Think | Reality | Action |
|----------|-----------|---------|--------|
| "Production is down" | "I should skip process" | Wrong fix costs more downtime than discovery | Use skill |
| "Urgent, do it now" | "Speed over process" | Fast + wrong < methodical + right | Use skill |
| "Every minute counts" | "Can't afford discovery" | Can't afford wrong fix even more | Use skill |

### Scope Pressure

| They Say | You Think | Reality | Action |
|----------|-----------|---------|--------|
| "Just find X" | "Simple lookup" | Location → "how does it work" → follow-ups | Use skill |
| "Quick answer only" | "Don't over-deliver" | Incomplete answer = more questions | Use skill |
| "I only need Y" | "Narrow scope" | Context makes Y actually useful | Use skill |

### Authority Pressure

| They Say | You Think | Reality | Action |
|----------|-----------|---------|--------|
| "I know the architecture" | "Trust their knowledge" | Even experts have incomplete mental models | Validate with skill |
| "Colleague said X" | "Trust the team" | High-level ≠ implementation details | Verify with skill |
| "We've always done it this way" | "Follow convention" | Convention may be wrong or outdated | Verify with skill |

---

## Self-Check Protocol

Before proceeding without the skill, ask yourself:

1. **Am I feeling pressure to skip?** → Pressure = signal to use skill
2. **Am I rationalizing?** → Check this table
3. **Would I bet my reputation on this shortcut?** → If no, use skill
4. **What's the cost of being wrong?** → Usually higher than discovery cost

**If any answer suggests risk → Use the skill.**

---

## The Math That Always Wins

| Shortcut "Savings" | Actual Cost When Wrong | Net Result |
|--------------------|------------------------|------------|
| 6-10 min | 2+ hours debugging | **-110 to -114 min** |
| 6-10 min | 3 round trips × 5 min | **-5 to -9 min** |
| 6-10 min | Wrong fix cascade | **-hours to -days** |
| 6-10 min | Compliance violation | **-career damage** |

**The shortcut never wins.**
