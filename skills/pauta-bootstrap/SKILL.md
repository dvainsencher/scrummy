---
name: pauta-bootstrap
description: This skill should be used right after `pauta init` on a project that has no backlog items yet, to seed an initial plan — phrases like "bootstrap the roadmap", "set up an initial backlog from this codebase", "start the plan from what we have", or "this project is brand new, help me seed the backlog".
---

# pauta: bootstrap

This project tracks work with `pauta`, a flat-file backlog/sprint manager. The one
rule that matters: **the `pauta` CLI is the only writer to `docs/roadmap/*`.** You
read the plan via `pauta show --json` and you write to it only by calling `pauta`
commands — never by editing `docs/roadmap/items.jsonl`, `docs/roadmap/sprints.json`,
or `docs/roadmap/specs/*.md` directly.

This skill seeds the *first* plan for a project. It covers two cases — tell which
one you're in before reading further:

- **Existing codebase**: there's code to read, not just intent.
- **Greenfield**: no code yet, or docs-only — there's nothing to scan beyond
  whatever design docs/READMEs already exist.

## Steps

1. Run `pauta show --json` first regardless of case — if it already has items or
   sprints, this isn't a bootstrap anymore; stop and suggest `pauta-suggest-batches`
   or `pauta-add-item` instead.
2. Gather source material for the proposal:
   - **Existing codebase**: read the README, any design docs, and skim the source
     tree structure (directories, major modules, existing TODO/FIXME markers) to
     infer what's built, what's partially built, and what's obviously missing.
   - **Greenfield**: read whatever design docs or README exist; if there's truly
     nothing written down, ask the user for a short description of what they're
     building before proposing anything — don't invent a plan from no information.
3. Draft a small set of sprints (context batches, not time boxes) and the backlog
   items under each, plus any items that don't fit a sprint yet (leave those in
   the backlog). Keep it small — a handful of sprints with a handful of items
   each, not an exhaustive decomposition. Mark items `ready` only if they're
   well-defined enough to start immediately; everything else is `idea`.
4. **Propose the plan in chat before acting** — list each sprint (name, goal) with
   its items (title, status), and the ungrouped backlog items. This is the
   project's first plan; don't execute silently.
5. Once the user confirms (or edits the proposal), execute via `pauta` commands
   only, in this order:
   - `pauta create-sprint <name> --goal "..." [--position <n>]` for each sprint
   - `pauta add-item "<title>" [--status idea|ready] [--sprint <name>]` for each
     item — pass `--sprint` directly for items going into a sprint you just
     created, or omit it for backlog items
   - `pauta set-active <name>` if the user wants to mark one sprint as current

After executing, point the user at `pauta show` to see the result — don't
re-print the whole plan yourself.
