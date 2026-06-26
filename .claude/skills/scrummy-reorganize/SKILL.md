---
name: scrummy-reorganize
description: This skill should be used when the user wants to restructure a scrummy-managed backlog — phrases like "reorganize the backlog", "regroup these into sprints", "clean up the roadmap", "rebatch these issues", or "this sprint is getting too big, split it".
---

# scrummy: reorganize

This project tracks work with `scrummy`, a flat-file backlog/sprint manager. The one
rule that matters: **the `scrummy` CLI is the only writer to `docs/roadmap/*`.** You
read the plan via `npx scrummy show --json` and you write to it only by calling `scrummy`
commands — never by editing `docs/roadmap/issues.jsonl`, `docs/roadmap/sprints.json`,
or `docs/roadmap/specs/*.md` directly.

Sprints here are **context batches, not time boxes** — group issues so each sprint
is something an agent (or a person) could hold in mind at once, not so it fits a
calendar period. `position` is advisory only; reordering or activating sprints out
of position order is normal, not a problem to fix.

## Steps

1. Run `npx scrummy show --json` to read the whole plan: every backlog issue, every sprint
   with its goal/position/status, and which sprint is active.
2. Reason about a regrouping that serves the user's stated goal (e.g. "these five
   backlog issues are really one feature," "this sprint has twelve issues, split it
   into two," "these two sprints overlap, merge their goals").
3. **Propose the plan in chat before acting** — list the moves and any new sprints
   in plain language, briefly enough to scan. This is a structural change to the
   user's plan; don't execute silently.
4. Once the user confirms (or if they already gave you clear enough instructions
   that confirmation would be redundant), execute via `scrummy` commands only:
   - `npx scrummy create-sprint <name> --goal "..." [--position <n>]` for new sprints
   - `npx scrummy move <id> <sprint-name>` / `npx scrummy move <id> --backlog` to reassign issues
   - `npx scrummy set-position <name> <n>` to reorder sprints
   - `npx scrummy edit-sprint <name> [--goal "..."] [--notes "..."]` to refine a goal
5. There's no `rename-sprint` command — if a sprint needs a new name, recreate it
   under the new name, move its issues over, then remove the old one via
   `npx scrummy remove-sprint <name>` (see below).
6. If a reorg leaves a sprint with no issues, don't suggest leaving it around
   `done`/empty as a placeholder — propose deleting it and ask the user to
   confirm before running `npx scrummy remove-sprint <name>` (it only succeeds once the
   sprint is actually empty, so move its issues out first if any remain).

After executing, summarize what moved in one short list — don't re-print the whole
plan unless asked.
