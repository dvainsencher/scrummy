---
name: pauta-migrate
description: This skill executes a mechanical migration of an existing hand-rolled backlog (ROADMAP.md, docs/sprints.md, TODO.md, or similar) into pauta. It is normally reached through pauta-bootstrap's migration-detection case, not invoked directly — phrases like "migrate my old backlog into pauta" or "port this ROADMAP.md" should be redirected to pauta-bootstrap first so detection runs.
---

# pauta: migrate

This project tracks work with `pauta`, a flat-file backlog/sprint manager. The one
rule that matters: **the `pauta` CLI is the only writer to `docs/roadmap/*`.** You
read the plan via `npx pauta show --json` and you write to it only by calling `pauta`
commands — never by editing `docs/roadmap/issues.jsonl`, `docs/roadmap/sprints.json`,
or `docs/roadmap/specs/*.md` directly (spec *content* is the documented exception —
see step 6).

This skill is **mechanical migration only** — full fidelity from the source
backlog, not a curated subset, and it never resolves ambiguity itself. Anything it
can't map confidently gets flagged in the artifact below, not silently merged,
skipped, or guessed. Cleaning up duplicates or thin notes afterward is
`pauta-refine`'s job, run separately and explicitly — never bundled into this skill.

Reached through `pauta-bootstrap`'s migration case, which has already identified the
source file(s) (e.g. `ROADMAP.md`, `docs/sprints.md`, `TODO.md`, legacy
`docs/roadmap/*.md`) before handing off here.

## Steps

1. **Rename the legacy directory out of the way first**, if any source content
   lives at `docs/roadmap/`: `git mv docs/roadmap docs/roadmap-legacy`. This is
   required before `npx pauta init` — `npx pauta init` refuses to run if `docs/roadmap/`
   contains anything other than pauta's own files (see #113), and you need pauta's
   `docs/roadmap/` clean from minute one rather than mixing ownership.
2. Run `npx pauta init` (if not already done) so pauta's own `docs/roadmap/` exists,
   then `npx pauta show --json` to confirm it's empty — this skill is for a first
   migration, not for merging into an already-populated backlog.
3. Read every source file in full (after the rename, legacy `docs/roadmap/*`
   content is at `docs/roadmap-legacy/*`). For unstructured notes mixed in
   alongside the structured backlog, identify distinct ideas the same way
   `pauta-scratchpad-import` does — one idea per row, don't split one thought
   across rows or merge unrelated ones.
4. Draft the mapping artifact: a markdown table with columns
   `source ref | proposed title | status | sprint | spec-action | flags`.
   - **status**: map the source's own status vocabulary onto
     `idea`/`ready`/`doing`/`done` as closely as possible.
   - **sprint**: map the source's grouping (sections, milestones, headings) onto
     sprint names; synthesize a one-line goal for each new sprint in a short
     preamble above the table.
   - **spec-action**: `create` if the source item has enough detail to warrant a
     spec file, otherwise blank.
   - **flags**: anything you didn't resolve — "possible duplicate of #N",
     "thin note, needs clarification", or any other ambiguity. Never resolve a
     flag by picking one option yourself; the flag *is* the deliverable here.
   - Above the table, add an **Open questions** section for anything that isn't
     about a single row — most commonly, which sprint (if any) should be marked
     active. Infer a candidate from context (e.g. recent activity in the source)
     but state it as a question with your reasoning, never as a silent decision:
     `"Mark <sprint> active? (most recently touched per <source>) — confirm or
     name a different one."`
5. **Write the artifact to `docs/roadmap-legacy/_migration-plan.md`** — this file
   *is* the proposal, not a chat narration that scrolls away. Tell the user the
   counts (issues, sprints, flagged rows, open questions) and that the file is
   theirs to read and edit directly — rows, statuses, sprints, flags, answers to
   the open questions, anything — before approving.
6. Wait for explicit approval. **Re-read `docs/roadmap-legacy/_migration-plan.md`
   from disk before executing** — never execute from your in-memory draft, since
   the user may have edited the file directly.
7. Execute exactly what the (possibly edited) file says, in this order:
   - `npx pauta create-sprint <name> --goal "<synthesized goal>"` for each sprint
     named in the table that doesn't already exist.
   - Build a JSON array of `{title, status, sprint}` from every issue row and run
     `npx pauta import <file>` once — don't call `add-issue` per row.
   - For each row with `spec-action: create`, run `npx pauta spec <id>` (using the id
     `import` returned for that row) then write the source's detail into the
     resulting spec file with normal file-editing tools.
   - If the open-questions section has an answered "mark active" question, run
     `npx pauta set-active <name>` for that one sprint. Leave it unset if unanswered
     — don't guess.
8. Report what was created (issue/sprint counts) and remind the user that flagged
   rows were filed as proposed, not resolved — running `pauta-refine` over the
   result is a separate, explicit next step. Don't delete
   `docs/roadmap-legacy/`; it stays until the user removes it themselves.
