---
name: pauta-suggest-batches
description: This skill should be used when the user wants help turning a messy backlog into sprints — phrases like "suggest some sprints from the backlog", "batch these issues up", "what should we group together", or "the backlog is getting long, help me organize it into sprints".
---

# pauta: suggest batches

This project tracks work with `pauta`, a flat-file backlog/sprint manager. The one
rule that matters: **the `pauta` CLI is the only writer to `docs/roadmap/*`.** You
read the plan via `npx pauta show --json` and you write to it only by calling `pauta`
commands — never by editing `docs/roadmap/issues.jsonl`, `docs/roadmap/sprints.json`,
or `docs/roadmap/specs/*.md` directly.

Unlike `pauta-reorganize` (which acts on a regrouping the user already has in mind),
this skill's job is to generate the grouping proposal itself, from backlog issues
that aren't in any sprint yet.

Sprints here are **context batches, not time boxes** — group issues so each sprint
is something an agent (or a person) could hold in mind at once.

## Steps

1. Run `npx pauta show --json` to read the backlog (issues with no sprint) and the
   existing sprints (names, goals, positions, status).
2. Look for backlog issues that belong together — same feature area, same
   dependency chain, or things that would naturally get worked on in the same
   sitting. Leave issues that don't cluster with anything else in the backlog;
   don't force a grouping just to use every issue.
3. For each proposed group, draft: a sprint name, a one-line goal, and which
   backlog issue ids would move into it. Prefer adding to an existing sprint over
   creating a new one if the issues fit its stated goal.
4. **Propose the groupings in chat before acting** — list each proposed sprint
   (name, goal, issue ids/titles) and any issues you're leaving ungrouped. This is
   a structural change to the user's plan; don't execute silently.
5. Once the user confirms (or edits the proposal), execute via `pauta` commands
   only:
   - `npx pauta create-sprint <name> --goal "..."` for new sprints
   - `npx pauta move <id> <sprint-name>` to assign each issue
   - `npx pauta set-position <name> <n>` if the user specifies an order

After executing, summarize what moved in one short list — don't re-print the
whole plan unless asked.
