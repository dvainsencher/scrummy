---
name: pauta-bootstrap
description: This skill should be used right after `pauta init` on a project that has no backlog issues yet, to seed an initial plan — phrases like "bootstrap the roadmap", "set up an initial backlog from this codebase", "start the plan from what we have", "this project is brand new, help me seed the backlog", "migrate my old backlog into pauta", or "port this ROADMAP.md/TODO.md".
---

# pauta: bootstrap

This project tracks work with `pauta`, a flat-file backlog/sprint manager. The one
rule that matters: **the `pauta` CLI is the only writer to `docs/roadmap/*`.** You
read the plan via `pauta show --json` and you write to it only by calling `pauta`
commands — never by editing `docs/roadmap/issues.jsonl`, `docs/roadmap/sprints.json`,
or `docs/roadmap/specs/*.md` directly.

This skill seeds the *first* plan for a project. It covers three cases — tell which
one you're in before reading further:

- **Migrating an existing backlog**: the project already tracks work in a
  hand-rolled doc — `ROADMAP.md`, `docs/sprints.md`, a non-numeric
  `docs/roadmap/*.md`, `TODO.md`, or similar. This isn't "inspiration for a
  curated subset" — it's a full-fidelity port. See step 0 below; this case hands
  off to `pauta-migrate` instead of following the rest of this skill.
- **Existing codebase**: there's code to read, not just intent, and no
  pre-existing backlog doc.
- **Greenfield**: no code yet, or docs-only — there's nothing to scan beyond
  whatever design docs/READMEs already exist.

## Steps

0. **Check for a legacy backlog doc before anything else** — `ROADMAP.md`,
   `docs/sprints.md`, a `docs/roadmap/*.md` that isn't pauta's own
   `issues.jsonl`/`sprints.json`/`specs/`, `TODO.md`, or similar. If you find one,
   stop following these steps and follow `pauta-migrate`'s `SKILL.md` instead —
   it handles the `docs/roadmap/` rename-first step (required before `pauta init`
   if the legacy doc lives there) and the rest of the migration. Don't run
   `pauta init` yourself first in this case; `pauta-migrate` does it after the
   rename.

   While you're here, also check the project's `CLAUDE.md` (and watch for
   conflicting *global* instructions, e.g. a `~/.claude/CLAUDE.md` directive to
   sync `ROADMAP.md` before every PR) for a "Roadmap" section, a directive to
   mark `ROADMAP.md`/similar items done before publishing, or a custom
   `/roadmap`-style skill — any of these will keep firing after migration and
   fight pauta's CLI-only-writer rule. If you find one, flag it to the user now,
   even though the actual fix (replacing it with the pauta-pointer block) only
   gets *proposed* once `pauta-audit` confirms the migration is clean — don't
   wait for the user to stumble onto the conflict on their own.
1. Run `pauta show --json` first regardless of case — if it already has issues or
   sprints, this isn't a bootstrap anymore; stop and suggest `pauta-suggest-batches`
   or `pauta-add-issue` instead.
2. Gather source material for the proposal:
   - **Existing codebase**: read the README, any design docs, and skim the source
     tree structure (directories, major modules, existing TODO/FIXME markers) to
     infer what's built, what's partially built, and what's obviously missing.
   - **Greenfield**: read whatever design docs or README exist; if there's truly
     nothing written down, ask the user for a short description of what they're
     building before proposing anything — don't invent a plan from no information.
3. Draft a small set of sprints (context batches, not time boxes) and the backlog
   issues under each, plus any issues that don't fit a sprint yet (leave those in
   the backlog). Keep it small — a handful of sprints with a handful of issues
   each, not an exhaustive decomposition. Mark issues `ready` only if they're
   well-defined enough to start immediately; everything else is `idea`.
4. **Propose the plan in chat before acting** — list each sprint (name, goal) with
   its issues (title, status), and the ungrouped backlog issues. This is the
   project's first plan; don't execute silently.
5. Once the user confirms (or edits the proposal), execute via `pauta` commands
   only, in this order:
   - `pauta create-sprint <name> --goal "..." [--position <n>]` for each sprint
   - `pauta add-issue "<title>" [--status idea|ready] [--sprint <name>]` for each
     issue — pass `--sprint` directly for issues going into a sprint you just
     created, or omit it for backlog issues
   - `pauta set-active <name>` if the user wants to mark one sprint as current

After executing, point the user at `pauta show` to see the result — don't
re-print the whole plan yourself.
