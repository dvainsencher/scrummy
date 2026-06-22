---
name: pauta-refine
description: This skill should be used to check whether a candidate or existing pauta issue (and its spec, if any) is well-defined before filing or keeping it as-is — phrases like "review this issue for clarity", "is this spec complete", "polish this backlog item", or "check definition consistency". Other pauta skills (pauta-add-issue, pauta-scratchpad-import) call this as a helper before filing; it can also be invoked directly on an existing issue id, or as an explicit batch pass over a whole set of issues — phrases like "refine the migrated backlog", "clean up duplicates after the migration", or "review everything we just imported" — most commonly right after pauta-migrate.
---

# pauta: refine

This project tracks work with `pauta`, a flat-file backlog/sprint manager. The one
rule that matters: **the `pauta` CLI is the only writer to `docs/roadmap/*`.** You
read the plan via `pauta show --json` and you write to it only by calling `pauta`
commands — never by editing `docs/roadmap/issues.jsonl`, `docs/roadmap/sprints.json`,
or `docs/roadmap/specs/*.md` directly (spec *content* is the exception — see
`pauta-add-issue`).

This skill doesn't file or move anything itself — it's a quality check, invoked
three ways: directly on one existing issue, as a helper another skill calls on a
candidate issue before filing it, or as an **explicit batch pass over a whole
issue set** (see "Batch mode" below) — most commonly right after `pauta-migrate`,
since `pauta-migrate` and `pauta-audit` never resolve duplicate/quality ambiguity
themselves, only flag it. This is the explicit fix for this project's own dry-run
mistake: a scratchpad note once got auto-merged into an existing issue's spec
without asking. Whichever way this skill is invoked, a suggested edit/move/merge
is **never applied without the user's explicit approval first.**

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

## Steps (single issue, or called as a helper)

1. Apply the checks above to the issue in scope.
2. If nothing trips: say so in one line — don't manufacture feedback for an
   issue that's already clear, non-duplicate, and (if it has one) has a filled-in
   spec.
3. If something trips: **ask one calibrating question or suggest one concrete
   edit** — a tighter title, a pointer to the issue it might duplicate, or which
   spec section is still empty. Propose in chat; don't rewrite anything yourself
   unless the user confirms. Where this skill is being called as a helper by
   another skill that's about to file or import something, the calling skill
   decides whether to surface the question to the user or (per BACKLOG #109)
   degrade to a plain chat prompt — this skill just produces the finding.

Keep findings to one line per issue — this is a quick check, not a full review.

## Batch mode (explicit pass over a whole issue set, e.g. after a migration)

This mode runs the same checks across many issues at once, but the approval
discipline matters more here: a batch invites silently "cleaning up" everything
at once, which is exactly the mistake this skill exists to prevent.

1. Determine scope: the issues `pauta-migrate` just created (if the
   `docs/roadmap-legacy/_migration-plan.md` artifact is still present, its rows
   tell you which ones those are), a named sprint, or an explicit set the user
   gives you. Run `pauta show --json` to read them — this excludes `done`
   issues by default, and that's deliberate: refining completed historical
   work is low value (it doesn't change what gets worked on next) and risks
   erasing the record of what actually shipped. Only include `done` issues in
   scope if the user explicitly asks to review/clean up completed or
   historical items — in that case, and only that case, use `--done`.
2. **Before reviewing anything, ask the user how they want findings presented:**
   one at a time (review and decide each before seeing the next) or as one
   batched list (see everything, then decide in bulk). Don't default to either
   silently — this choice is the point of #118.
3. Apply the Checks above to every issue in scope. For consistency/duplicate
   detection, compare each issue against the rest of the set *and* against
   issues outside it — a migrated item can duplicate something that already
   existed before the migration, not just another migrated item. For this
   comparison only, fetch the broader set with `pauta show --json --done` so a
   migrated/active item that duplicates already-shipped work is still
   flagged — but a `done` issue is never itself a *target* of a finding or
   edit, only something to check new items against.
4. Present findings per the user's chosen mode from step 2:
   - **One at a time**: show one finding with its proposed action (tighter
     title, which spec section is empty, or — for a likely duplicate — merge
     into the other issue's spec vs. keep both as distinct vs. file as-is).
     Wait for a decision before moving to the next finding.
   - **Batched list**: show every finding at once, each with its proposed
     action, then collect the user's decisions (can be answered together in one
     reply).
5. Execute only the decisions the user actually approved, via `pauta` commands
   — never the ones left undecided or explicitly declined:
   - Title fix: `pauta edit-issue <id> --title "..."`.
   - Merge duplicate `<dup-id>` into survivor `<id>`: run `pauta spec <id>` to
     ensure the survivor has a spec file, write the duplicate's relevant content
     into it with normal file-editing tools, then `pauta remove-issue <dup-id>`
     (this also deletes the duplicate's own spec file).
   - Thin spec: write the missing section(s) into `specs/<id>.md` directly
     (spec content is the documented exception to the CLI-only-writer rule).
6. Report a short summary — issues reviewed, findings raised, how many were
   applied vs. left as-is — not a re-print of the whole set.
