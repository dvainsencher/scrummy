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

### Item
The atom of work. An item has:

| field | meaning |
|---|---|
| `id` | short integer, so you can say "move #42" in chat |
| `title` | one line |
| `status` | `idea → ready → doing → done` (lifecycle only) |
| `sprint` | a sprint name, or empty |
| spec | optional file at `specs/<id>.md` for detailed write-ups |

**Empty `sprint` = the backlog.** The backlog is just every item not assigned to a sprint — a real inbox for raw ideas.

There is deliberately **no dependency field and no within-sprint ordering**. Logical order between items is the user's concern: write "do this after #42" as prose in the spec. The system doesn't parse, validate, or sort by it.

### Sprint
A **context batch**: a set of related work sized to fit comfortably in an agent's context — not a time period. A sprint has:

| field | meaning |
|---|---|
| `name` | how you refer to it ("the export sprint") |
| `position` | advisory sort order — see below |
| `status` | `planned → active → done` |
| `goal` | what this batch is for |
| `notes` | optional |

A sprint's **membership is not stored on the sprint** — it's derived by filtering items whose `sprint` matches. One source of truth, no drift.

**Order is advisory, not structural.** `position` is just a sort key for display. Plan several sprints ahead (positions 10, 20, 30) and they read as an intended sequence — but the sequence binds nothing. Reorder with a single edit (`set-position export 5`), and nothing renumbers. Activating a sprint out of "order" (work on #11 before #8) is not a transgression because there is no enforced order. Gaps of 10 let you slot a new sprint between two existing ones without touching either.

---

## The one architectural rule

**The CLI is the only writer. The LLM reads and decides; it never writes files directly.**

Everything follows from this:

- **Mechanical operations cost zero tokens.** Adding an item, moving it, creating a sprint — these are file edits. A human runs the command; an agent runs the *same* command. No model call either way.
- **The agent's job is read → reason → emit commands.** After a design discussion, the agent reads the whole plan, decides where a new item belongs or how to regroup, and expresses that as a sequence of writer-command calls. The files only ever change through the CLI, so the format stays valid by construction and you never get two-writers drift.
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
        │ show / show --json│   │ add-item, move, ...     │
        └──────────────────┘   └───────────┬────────────┘
                                            │ sole mutators
                                            ▼
                              docs/roadmap/  (files in the repo)
```

---

## File layout

```
docs/roadmap/
  items.jsonl      # one item per line — clean diffs, append-friendly, parse-safe
  sprints.json     # sprint metadata (name, position, status, goal, notes)
  specs/
    3.md           # optional, keyed by item id
    12.md
```

> **Resolved** (see `CLAUDE.md`): JSON Lines, not meant to be human-readable on its
> own — `pauta show` is the only human-facing view.

---

## Command surface

### Writers (mechanical · zero tokens · the only mutators)

```
pauta init                                 # scaffold docs/roadmap/ in a project (empty items, sprints, specs/)

pauta add-item "<title>" [--status idea|ready] [--sprint <name>]   # prints new id
pauta edit-item <id> [--title "..."] [--status ...]
pauta remove-item <id>
pauta move <id> <sprint-name>              # assign to a sprint
pauta move <id> --backlog                  # send back to the inbox
pauta set-status <id> <status>

pauta create-sprint <name> --goal "..." [--notes "..."] [--position <n>]
pauta edit-sprint <name> [--goal "..."] [--notes "..."]
pauta set-position <name> <n>              # advisory sort only
pauta set-active <name>                    # mark which sprint you're working on
pauta set-sprint-status <name> <planned|active|done>

pauta spec <id>                            # create/return path to specs/<id>.md
```

All of the above are implemented (`SPRINTS.md`'s `foundation` sprint).

### Reader (the linchpin — rich enough that the agent never opens raw files)

> **Not yet implemented** — next up in `SPRINTS.md`'s `the-reader` sprint.

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

> **Not yet implemented** — `SPRINTS.md`'s `smart-ops` sprint.

```
pauta suggest-batches        # reads everything, proposes sprint groupings; you confirm
pauta bootstrap               # reads repo code + docs, proposes an initial set of items/sprints
```

`bootstrap` works on an existing codebase *or* a greenfield project with only docs (or nothing).

---

## Two front-ends, one writer

The same CLI is invoked two ways:

- **By you, by hand** — `pauta add-item "..."` at the terminal, or migrating a scratchpad note.
- **By an agent, via a Claude Code skill** — after a feature discussion, the agent reads `show --json`, reasons, and calls the writer commands. It never edits the files directly.

The capture flows this supports:

- **At the desk:** discuss with the agent → "add this and slot it" → agent emits the right commands.
- **Away from the desk:** jot into a dumb scratchpad file → later run `add-item` per note (yourself, or hand the scratchpad to the agent and say "import these"). The CLI is the single funnel every note passes through to become a real item — so you never copy-paste into the roadmap files by hand.

An external inspector agent (looking at a project you're *not* actively coding in) is the same system pointed at the same files from outside — a deployment choice, not a separate architecture.

---

## Install & setup

Two things get installed into a project: the **CLI** (so `pauta` runs) and the **Claude Code skills** (so the agent can drive it). Then `init` scaffolds the data directory.

```
# 1. get the CLI (script on PATH, or repo-local) — see install docs
# 2. install the skill files into the project's Claude Code skills location
# 3. scaffold the data dir
pauta init
```

**Existing project:** `init`, then `pauta bootstrap` to read the code and propose a starting plan.
**New project:** `init`, then optionally `bootstrap` from docs alone (or start empty and add items by hand).

`init` and the CLI are mechanical (no LLM); only `bootstrap` reads content and costs tokens.

---

## Status

The `foundation` sprint (the whole mechanical layer — init, schema, CLI commands,
backlog filter) is done; see `SPRINTS.md` for the build plan and what's next.
