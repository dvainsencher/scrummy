# scrummy

A flat-file backlog and sprint manager for solo developers and small teams — built to be driven both by a human at a terminal and by a coding agent (e.g. Claude Code) over the **same files**.

It is, in essence, a tiny issue tracker that lives in your repo, with one defining idea: **sprints are context batches, not time boxes.**

---

## Why

When you work alone or in a tiny group — often *with* an agent — you don't need Jira. You need:

- a place to **capture ideas the moment they appear**, whether you're at your desk mid-session or jotting a note away from it;
- a way to **batch related work into a chunk an agent can hold in context at once**;
- the whole plan **viewable at a glance**, in plain files committed next to your code.

That's what this is. For the design rationale (the CLI-is-the-only-writer rule,
file layout, why there's no time-boxing), see [docs/architecture.md](docs/architecture.md).

---

## Core concepts

### Issue
The atom of work.

| field | meaning |
|---|---|
| `id` | short integer, so you can say "move #42" in chat |
| `title` | one line |
| `status` | `idea → ready → doing → done` (lifecycle only) |
| `sprint` | a sprint name, or empty |
| spec | optional file at `specs/<id>.md` for detailed write-ups |
| progress log | optional append-only entries, for resuming a long-running issue across sessions (`scrummy log-issue`/`scrummy show-log`) |

**Empty `sprint` = the backlog** — every issue not assigned to a sprint. There's
deliberately no dependency field and no within-sprint ordering; note ordering as
prose in the spec instead.

### Sprint
A **context batch**: a set of related work sized to fit comfortably in an agent's context — not a time period.

| field | meaning |
|---|---|
| `name` | how you refer to it ("the export sprint") |
| `position` | advisory sort order |
| `goal` | what this batch is for |
| `notes` | optional |

A sprint's membership and status are both **derived**, never stored: membership
is every issue whose `sprint` matches; status is computed from those issues'
statuses (`planned → active → done`), so it can never drift out of sync. See
[docs/architecture.md](docs/architecture.md) for the full derivation rules.

---

## Install & setup

scrummy isn't published to a registry yet, so a project depends on it as a
`devDependency` pointed at this repo:

```jsonc
// package.json
{
  "devDependencies": {
    "scrummy": "git+https://github.com/dvainsencher/pauta.git"
    // or, for local development: "scrummy": "file:../pauta"
  }
}
```

```
npm install                # wires up node_modules/.bin/scrummy
npx scrummy init              # scaffold docs/roadmap/ (empty issues, sprints, specs/)
npx scrummy install-skills    # copy the Claude Code skill files into .claude/skills/
```

- **Existing or new project:** `init`, then `install-skills`, then either add
  issues by hand or ask the agent to run the `scrummy-bootstrap` skill to seed a
  starting plan from your code/docs.
- **Already have a hand-rolled backlog** (`ROADMAP.md`, `docs/sprints.md`,
  `TODO.md`, ...)? `scrummy-bootstrap` detects it and hands off to
  `scrummy-migrate`, which ports it with a reviewable mapping artifact — see
  [docs/adopting.md](docs/adopting.md).

`init`, the CLI, and `install-skills` are all mechanical (no LLM); `scrummy-po` and
the other Claude Code skills read content and cost tokens.

**Running from more than one worktree/session at once?** Mutating commands
sync through a small PR to `origin`'s default branch automatically (needs the
`gh` CLI, authenticated) — see "Parallel use" in
[docs/architecture.md](docs/architecture.md) for what that means and the
`SCRUMMY_NO_SYNC` escape hatch for solo/offline use.

---

## Usage

```
scrummy add-issue "Rework auth token refresh"      # prints new id, lands in the backlog
scrummy create-sprint auth-hardening --goal "close the session/token gaps"
scrummy move 12 auth-hardening
scrummy set-status 12 doing

scrummy show                 # the human-scannable whole plan
scrummy show --json          # same content, structured, for an agent
scrummy status                # one-line summary of the active sprint
scrummy view                  # interactive terminal kanban board
```

Or, in conversation with an agent that has the skills installed: "add this to the
backlog and slot it into the auth sprint" — the agent reads `show --json`,
reasons, and calls the same writer commands a human would type.

The full command reference (every writer/reader flag, the smart-op skills, and
example output) lives in [docs/commands.md](docs/commands.md).

---

## Documentation

- [docs/architecture.md](docs/architecture.md) — the one architectural rule, file layout, why sprints are derived not stored
- [docs/commands.md](docs/commands.md) — full command reference, including the Claude Code skills ("smart ops")
- [docs/adopting.md](docs/adopting.md) — moving a project from a hand-rolled backlog doc onto scrummy
- [docs/developing.md](docs/developing.md) — building and developing scrummy itself
- [SPRINTS.md](SPRINTS.md) — build plan and current status
