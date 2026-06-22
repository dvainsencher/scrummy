# pauta

A flat-file backlog and sprint manager for solo developers and small teams — built to be driven both by a human at a terminal and by a coding agent (e.g. Claude Code) over the **same files**.

It is, in essence, a tiny issue tracker that lives in your repo, with one defining idea: **sprints are context batches, not time boxes.**

---

## Why

When you work alone or in a tiny group — often *with* an agent — you don't need Jira. You need:

- a place to **capture ideas the moment they appear**, whether you're at your desk mid-session or jotting a note away from it;
- a way to **batch related work into a chunk an agent can hold in context at once**;
- the whole plan **viewable at a glance**, in plain files committed next to your code.

That's what this is.

---

## Core concepts

### Issue
The atom of work. An issue has:

| field | meaning |
|---|---|
| `id` | short integer, so you can say "move #42" in chat |
| `title` | one line |
| `status` | `idea → ready → doing → done` (lifecycle only) |
| `sprint` | a sprint name, or empty |
| spec | optional file at `specs/<id>.md` for detailed write-ups |

**Empty `sprint` = the backlog.** The backlog is just every issue not assigned to a sprint — a real inbox for raw ideas.

There is deliberately **no dependency field and no within-sprint ordering**. Logical order between issues is the user's concern: write "do this after #42" as prose in the spec. The system doesn't parse, validate, or sort by it.

### Sprint
A **context batch**: a set of related work sized to fit comfortably in an agent's context — not a time period. A sprint has:

| field | meaning |
|---|---|
| `name` | how you refer to it ("the export sprint") |
| `position` | advisory sort order — see below |
| `status` | `planned → active → done` |
| `goal` | what this batch is for |
| `notes` | optional |

A sprint's **membership is not stored on the sprint** — it's derived by filtering issues whose `sprint` matches. One source of truth, no drift.

**Order is advisory, not structural.** `position` is just a sort key for display. Plan several sprints ahead (positions 10, 20, 30) and they read as an intended sequence — but the sequence binds nothing. Reorder with a single edit (`set-position export 5`), and nothing renumbers. Activating a sprint out of "order" (work on #11 before #8) is not a transgression because there is no enforced order. Gaps of 10 let you slot a new sprint between two existing ones without touching either.

---

## The one architectural rule

**The CLI is the only writer. The LLM reads and decides; it never writes files directly.**

Everything follows from this:

- **Mechanical operations cost zero tokens.** Adding an issue, moving it, creating a sprint — these are file edits. A human runs the command; an agent runs the *same* command. No model call either way.
- **The agent's job is read → reason → emit commands.** After a design discussion, the agent reads the whole plan, decides where a new issue belongs or how to regroup, and expresses that as a sequence of writer-command calls. The files only ever change through the CLI, so the format stays valid by construction and you never get two-writers drift.
- **Smart operations sit *above* this line.** They read via the reader, reason, and emit the same writer commands. They get no special file access.

```
        ┌─────────────────────────────────────────┐
        │  smart ops (use an LLM, cost tokens)      │
        │  suggest-batches · bootstrap              │
        └───────────────┬───────────────┬──────────┘
                 reads   │               │  writes
                  via    ▼               ▼  via
        ┌──────────────────┐   ┌────────────────────────┐
        │ reader (no LLM)  │   │ writers (no LLM)        │
        │ show / show --json│   │ add-issue, move, ...     │
        └──────────────────┘   └───────────┬────────────┘
                                            │ sole mutators
                                            ▼
                              docs/roadmap/  (files in the repo)
```

---

## File layout

```
docs/roadmap/
  issues.jsonl     # one issue per line — clean diffs, append-friendly, parse-safe
  sprints.json     # sprint metadata (name, position, status, goal, notes)
  specs/
    3.md           # optional, keyed by issue id
    12.md
```

> **Resolved** (see `CLAUDE.md`): JSON Lines, not meant to be human-readable on its
> own — `pauta show` is the only human-facing view.

---

## Command surface

### Writers (mechanical · zero tokens · the only mutators)

```
pauta init                                 # scaffold docs/roadmap/ in a project (empty issues, sprints, specs/)

pauta add-issue "<title>" [--status idea|ready] [--sprint <name>]   # prints new id
pauta edit-issue <id> [--title "..."] [--status ...]
pauta remove-issue <id>
pauta import <file>                        # batch-add issues from a JSON array of {title, status?, sprint?}; prints new ids, one per line
pauta move <id> <sprint-name>              # assign to a sprint
pauta move <id> --backlog                  # send back to the inbox
pauta set-status <id> <status>

pauta create-sprint <name> --goal "..." [--notes "..."] [--position <n>]
pauta edit-sprint <name> [--goal "..."] [--notes "..."]
pauta set-position <name> <n>              # advisory sort only
pauta set-active <name>                    # mark which sprint you're working on
pauta set-sprint-status <name> <planned|active|done>

pauta spec <id>                            # create/return path to specs/<id>.md

pauta install-skills                       # copy the Claude Code skill files into .claude/skills/
```

All of the above are implemented (`SPRINTS.md`'s `foundation` and `agent-skills` sprints).

### Reader (the linchpin — rich enough that the agent never opens raw files)

Implemented (`SPRINTS.md`'s `the-reader` sprint). By default, done issues and done
sprints are hidden — `--done` reveals them. `--sprint <name>` shows only that
sprint's issues and omits the backlog section.

```
pauta show [--sprint <name>] [--done]      # the human-scannable whole plan
pauta show --json                          # same content, structured, for the agent
```

Default `show` output:

```
BACKLOG (4)
  #12  ready  Rework auth token refresh        [spec]
  #15  idea   Dark mode
  #18  idea   Export to CSV
  #21  ready  Rate-limit the public API

▶ SPRINT auth-hardening   (active)
  goal: close the session/token gaps before launch
  #3   doing  Rotate signing keys              [spec]
  #9   ready  Lock down password reset flow
  #12  ready  Rework auth token refresh        [spec]

  SPRINT onboarding-polish   (planned)
  goal: first-run experience feels finished
  #7   ready  Welcome tour
  #22  idea   Sample data seeding
```

The pretty view and the `--json` view render from the same data, so they can't disagree.

### Smart ops (use an LLM · cost tokens · invoked deliberately)

These are Claude Code skills, not `pauta` subcommands — `pauta` itself never calls
an LLM. The skill reads via `pauta show --json`, reasons, proposes the plan in
chat, and on confirmation writes only via the same writer commands a human would
type.

```
pauta-suggest-batches        # skill: reads the backlog, proposes sprint groupings; you confirm
pauta-bootstrap              # skill: reads repo code + docs, proposes an initial set of issues/sprints
pauta-migrate                # skill: full-fidelity port of an existing hand-rolled backlog doc, via a reviewable file artifact
pauta-audit                  # skill: read-only fidelity check of a completed migration against its approved artifact
pauta-scratchpad-import      # skill: reads a messy notes file, files one issue per idea; you confirm
pauta-refine                 # skill: checks a candidate or existing issue for clarity/consistency/spec quality
```

`pauta-bootstrap` works on an existing codebase *or* a greenfield project with only
docs (or nothing) — and detects a third case, an existing hand-rolled backlog doc
(`ROADMAP.md`, `docs/sprints.md`, `TODO.md`, ...), handing off to `pauta-migrate`
for that one. Unlike the other smart ops, `pauta-migrate` doesn't propose in chat —
it writes a markdown mapping table to `docs/roadmap-legacy/_migration-plan.md` for
you to read and edit directly, and executes only the (possibly edited) file once
you approve it; ambiguities (possible duplicates, thin notes, which sprint should
be active) are flagged in the file, never silently resolved — that's
`pauta-refine`'s job, run separately afterward. `pauta-audit` is the third leg of
the same migration flow: run it after `pauta-migrate` to mechanically reconcile
the resulting backlog against the approved artifact (every row produced an issue,
counts match, nothing silently dropped) — a different question from "is this
backlog any good," which is `pauta-refine`'s. `migrate`/`audit`/`refine` are three
separate, explicitly-invoked actions on purpose, never bundled into one step.
`pauta-scratchpad-import` is for unstructured prose with no fixed shape — notes
jotted for your own future reference, not an existing plan. `pauta-refine` doesn't
file or move anything itself; `pauta-add-issue` and `pauta-scratchpad-import` both
call it as a quality check before filing. `pauta-refine` also has an explicit
**batch mode** for running over a whole issue set at once (most commonly the
issues a migration just created) — it asks up front whether you want findings one
at a time or as a single batched list, and only acts on the decisions you actually
approve; nothing gets silently merged or edited.

---

## Two front-ends, one writer

The same CLI is invoked two ways:

- **By you, by hand** — `pauta add-issue "..."` at the terminal, or migrating a scratchpad note.
- **By an agent, via a Claude Code skill** — after a feature discussion, the agent reads `show --json`, reasons, and calls the writer commands. It never edits the files directly.

The capture flows this supports:

- **At the desk:** discuss with the agent → "add this and slot it" → agent emits the right commands.
- **Away from the desk:** jot into a dumb scratchpad file → later run `add-issue` per note yourself, or hand the scratchpad to the agent and say "import these" (the `pauta-scratchpad-import` skill). The CLI is the single funnel every note passes through to become a real issue — so you never copy-paste into the roadmap files by hand.

An external inspector agent (looking at a project you're *not* actively coding in) is the same system pointed at the same files from outside — a deployment choice, not a separate architecture.

---

## Install & setup

pauta isn't published to a registry yet, so a project depends on it as a
`devDependency` pointed at this repo (git URL or a local path), the same way you'd
depend on any unpublished package:

```jsonc
// package.json
{
  "devDependencies": {
    "pauta": "git+https://github.com/dvainsencher/pauta.git"
    // or, for local development: "pauta": "file:../pauta"
  }
}
```

```
npm install                # wires up node_modules/.bin/pauta
npx pauta init              # scaffold docs/roadmap/ (empty issues, sprints, specs/)
npx pauta install-skills    # copy the Claude Code skill files into .claude/skills/
```

`install-skills` is mechanical (no LLM) — it copies every skill directory
(`pauta-add-issue`, `pauta-reorganize`, `pauta-suggest-batches`, `pauta-bootstrap`,
`pauta-migrate`, `pauta-audit`, `pauta-scratchpad-import`, `pauta-refine`) from the installed
package's own `skills/` directory into the project's `.claude/skills/`,
overwriting on re-run. Once installed, the skills themselves enforce the one
rule: read via `pauta show --json`, write only via `pauta` commands, never touch
`docs/roadmap/*` directly.

**Existing project:** `init`, then `install-skills`, then either add issues by hand
(or via the `pauta-add-issue` skill during a feature discussion), or ask the agent
to run the `pauta-bootstrap` skill to seed a starting plan from your existing code.
**New project:** same — `init`, `install-skills`, then `pauta-bootstrap` from
whatever docs exist (or start empty and add issues as ideas come up).

**Already have a hand-rolled backlog?** (a legacy `ROADMAP.md`/`docs/sprints.md`/
`TODO.md` setup, possibly living at `docs/roadmap/` itself) Run `install-skills`
and ask the agent to bootstrap — `pauta-bootstrap` detects the legacy doc and hands
off to `pauta-migrate`, which handles the `docs/roadmap/` rename
(`git mv docs/roadmap docs/roadmap-legacy` — required before `init`, since `init`
refuses to run if that directory contains anything other than pauta's own files)
and writes a reviewable mapping artifact before filing anything. See "Smart ops"
above for what `pauta-migrate` does and doesn't decide on its own.

`init`, the CLI, and `install-skills` are all mechanical (no LLM); only the
`pauta-suggest-batches` and `pauta-bootstrap` skills read content and cost tokens.

---

## Status

`foundation`, `the-reader`, `agent-skills`, `smart-ops`, `install-skills-polish`,
and `issue-quality` sprints are done — the whole mechanical layer, `show`/
`show --json`, and the Claude Code skills (including `pauta-suggest-batches`,
`pauta-bootstrap`, `pauta-scratchpad-import`, and `pauta-refine`) that drive it.
See `SPRINTS.md` for the build plan and what's next.
