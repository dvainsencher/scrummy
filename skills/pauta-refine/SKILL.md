---
name: pauta-refine
description: This skill should be used to check whether a candidate or existing pauta issue (and its spec, if any) is well-defined before filing or keeping it as-is — phrases like "review this issue for clarity", "is this spec complete", "polish this backlog item", or "check definition consistency". Other pauta skills (pauta-add-issue, pauta-scratchpad-import) call this as a helper before filing; it can also be invoked directly on an existing issue id.
---

# pauta: refine

This project tracks work with `pauta`, a flat-file backlog/sprint manager. The one
rule that matters: **the `pauta` CLI is the only writer to `docs/roadmap/*`.** You
read the plan via `pauta show --json` and you write to it only by calling `pauta`
commands — never by editing `docs/roadmap/issues.jsonl`, `docs/roadmap/sprints.json`,
or `docs/roadmap/specs/*.md` directly (spec *content* is the exception — see
`pauta-add-issue`).

This skill doesn't file or move anything itself — it's a quality check, used either
directly on an existing issue or as a helper another skill calls on a candidate
issue before filing it.

## Checks

For the issue (and its spec, if it has one) under review, apply:

1. **Definition clarity** — is the title a clear, scoped one-liner, or is it vague/
   generic? Trips on short titles (under ~4 words with no further context) or
   generic vague-verb patterns ("fix X", "improve Y", "update Z") that don't say
   *what* is broken or *what* "improved" means.
2. **Consistency** — run `pauta show --json` and check whether this duplicates or
   contradicts an existing issue (same feature area, overlapping scope, or a title
   that reads as a rephrasing of one already on the backlog).
3. **Spec quality** — if a spec exists at `specs/<id>.md`, are Problem/Approach/
   Acceptance criteria/Open questions actually filled in, or still the empty
   skeleton headers left by `pauta spec <id>`?

## Steps

1. Apply the checks above to the issue(s) in scope.
2. If nothing trips: say so in one line — don't manufacture feedback for an
   issue that's already clear, non-duplicate, and (if it has one) has a filled-in
   spec.
3. If something trips: **ask one calibrating question or suggest one concrete
   edit per issue** — a tighter title, a pointer to the issue it might duplicate,
   or which spec section is still empty. Propose in chat; don't rewrite anything
   yourself unless the user confirms. Where this skill is being called as a
   helper by another skill that's about to file or import something, the calling
   skill decides whether to surface the question to the user or (per BACKLOG #109)
   degrade to a plain chat prompt — this skill just produces the finding.

Keep findings to one line per issue — this is a quick check, not a full review.
