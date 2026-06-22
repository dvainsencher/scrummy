---
name: pauta-audit
description: This skill should be used right after pauta-migrate has executed, to mechanically verify the migration matches the approved artifact — phrases like "audit the migration", "did the migration work", "check nothing got dropped", or "verify the migration against the plan".
---

# pauta: audit

This project tracks work with `pauta`, a flat-file backlog/sprint manager. The one
rule that matters: **the `pauta` CLI is the only writer to `docs/roadmap/*`.** This
skill only reads — via `pauta show --json` and the migration-plan file — and never
writes anything.

This is a **mechanical fidelity check, not a quality check**: "did the migration
do what the approved artifact said" is a different question from "is this backlog
any good," and this skill only answers the first. Duplicate cleanup, vague titles,
thin specs — that's `pauta-refine`'s job, run separately. If this skill finds a
discrepancy, it reports it; it never fixes it.

## Steps

1. Find the migration-plan artifact — default `docs/roadmap-legacy/_migration-plan.md`
   (the file `pauta-migrate` wrote). Ask for the path if it's not there. Read it in
   full: the table (`source ref | proposed title | status | sprint | spec-action |
   flags`) and the open-questions section, exactly as it stood when approved —
   this is the source of truth for what *should* exist, not what you remember
   proposing.
2. Run `pauta show --json --done` (include done issues/sprints — migrated items
   may already be marked done) to read the actual current state.
3. Reconcile sprints: for every sprint name in the table, confirm it exists in
   `show --json`. Flag any that are missing.
4. Reconcile issues, row by row: for each table row, find an issue whose title
   exactly matches the row's *proposed title* (use the table as currently
   written — if the user edited a title before approving, match the edited
   version). For each match, confirm status and sprint agree with the row.
   - **Matched, fields agree** — counts as clean, no need to report individually.
   - **No matching issue found** — flag as dropped.
   - **Matched but status/sprint differs from the row** — flag as a mismatch,
     stating both the row's value and the actual value.
   - **Two or more table rows share the same proposed title** — flag as
     unmatchable; don't guess which issue corresponds to which row.
5. Reconcile the other direction: any issue that doesn't correspond to any table
   row — flag as an unexpected addition (could be a real issue added by hand
   after migrating, not necessarily a bug; just surface it).
6. For each row with `spec-action: create`, confirm `specs/<id>.md` exists for the
   matched issue. Existence only — whether the content is good is out of scope
   here.
7. If the open-questions section recorded an answer to "mark `<sprint>` active",
   confirm `show --json`'s active sprint matches. If the question was left
   unanswered, skip this check — `pauta-migrate` doesn't guess, so there's nothing
   to verify.
8. Report the result as counts plus a list of flags, one line each (row/issue
   reference, what's wrong) — don't re-print the whole table for rows that
   matched cleanly. If everything reconciles, say so in one line: e.g. "Migration
   audit: all 41 rows accounted for, 6 sprints confirmed, no discrepancies."
9. **Don't fix anything yourself.** If discrepancies are found, name them and stop
   — point the user at the relevant `pauta` command (e.g. `set-status`, `move`)
   to close a specific gap themselves, or at `pauta-refine` for quality issues,
   rather than executing a fix unprompted.
10. **Only if step 8 found no discrepancies**, propose one more edit: check the
    project's `CLAUDE.md` for a "Roadmap" section, a directive to sync
    `ROADMAP.md`/similar before publishing, or a reference to a `/roadmap`-style
    skill. If one exists, propose replacing it (in chat first, then write on
    confirmation — `CLAUDE.md` isn't `docs/roadmap/*`, so normal file-editing
    applies once approved) with:

    ```markdown
    ## Roadmap

    This project tracks work with `pauta`, not ROADMAP.md/docs/sprints.md
    (superseded — original history is in git, or `docs/roadmap-legacy/` if still
    retained). Run
    `pauta show` for the current plan, `pauta show --json` for the agent-readable
    form. Do not use any `/roadmap`-style skill or apply a global roadmap-sync
    directive for this project — this section supersedes them.
    ```

    Project-level `CLAUDE.md` overrides global instructions, so this is the edit
    that actually stops a global "sync the roadmap" habit from fighting `pauta`'s
    own writer commands. Skip this step entirely if discrepancies were found —
    don't propose closing the loop on a migration that isn't clean yet.
11. **Only if step 8 found no discrepancies**, also offer to delete
    `docs/roadmap-legacy/` now that the migration is verified — `pauta-migrate`
    deliberately leaves it in place ("it stays until the user removes it
    themselves") precisely so this audit can run against it first. Before
    offering, check whether `pauta-refine`'s batch pass has already run over the
    migrated set: its scope-detection reads `_migration-plan.md`'s presence to
    know which issues were just migrated, so deleting the directory first would
    remove that signal. If refine hasn't run yet, say so and suggest it as the
    next step instead of offering deletion. Deletion itself is a plain
    `rm -rf docs/roadmap-legacy` (it's not under `docs/roadmap/*`, so the
    CLI-only-writer rule doesn't apply) — propose it in chat and only run it on
    the user's explicit confirmation, never unprompted.
