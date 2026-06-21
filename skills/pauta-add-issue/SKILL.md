---
name: pauta-add-issue
description: This skill should be used when, during or after a feature/design discussion in a project that uses pauta, the user wants to capture the idea as a backlog issue — phrases like "add this to the backlog", "track this", "let's add an issue for X", "slot this into a sprint", or "add this and slot it".
---

# pauta: add issue

This project tracks work with `pauta`, a flat-file backlog/sprint manager. The one
rule that matters: **the `pauta` CLI is the only writer to `docs/roadmap/*`.** You
read the plan via `pauta show --json` and you write to it only by calling `pauta`
commands — never by editing `docs/roadmap/issues.jsonl`, `docs/roadmap/sprints.json`,
or `docs/roadmap/specs/*.md` directly, even though they're plain files you technically
could open.

## Steps

1. Run `pauta show --json` to see the current backlog and sprints (names, goals,
   positions, which sprint is active, existing issues).
2. From the discussion, decide:
   - **title** — one line summarizing the work.
   - **status** — `idea` (default) if it's a raw thought, `ready` if it's well-defined
     enough to start.
   - **sprint** — leave unset (backlog) unless the discussion clearly ties it to an
     existing sprint by name; don't invent a new sprint just to file one issue (that's
     a job for the reorganize skill, not this one).
3. Before filing, run `pauta-refine`'s definition-clarity check on the candidate
   title (there's no spec yet at this point, so only the clarity check applies —
   consistency/spec-quality are for `pauta-refine` to apply once the issue exists).
   If it trips, ask the user one calibrating "why"/context question before filing
   — don't assume a structured question UI is available, a plain chat question
   works too (see BACKLOG #109). Otherwise file as-is.
4. Call `pauta add-issue "<title>" [--status idea|ready] [--sprint <name>]`. It prints
   the new issue's id.
5. If the discussion produced more than a one-line idea — open questions, design
   notes, acceptance criteria — run `pauta spec <id>` to create `specs/<id>.md`, then
   write the detail into that file with your normal file-editing tools (the spec
   *content* isn't roadmap metadata, so editing it directly is fine — only
   `issues.jsonl`/`sprints.json` and spec *creation* go through the CLI).
6. If the user is describing an issue that already exists but should move sprints,
   use `pauta move <id> <sprint-name>` or `pauta move <id> --backlog` instead of
   adding a duplicate.

Tell the user the new issue's id and where it landed (backlog or which sprint) in one
line — don't narrate the steps above.
