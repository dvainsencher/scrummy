# Command reference

`scrummy` (bare) or `scrummy --help` prints this command list with one-line
descriptions; an unknown command prints an error hinting at `--help`.

## Writers (mechanical · zero tokens · the only mutators)

```
scrummy init                                 # scaffold docs/roadmap/ in a project (empty issues, sprints, specs/)

scrummy add-issue "<title>" [--status idea|ready] [--sprint <name>]   # prints new id
scrummy edit-issue <id> [--title "..."] [--status ...]
scrummy remove-issue <id>
scrummy import <file>                        # batch-add issues from a JSON array of {title, status?, sprint?}; prints new ids, one per line
scrummy move <id> <sprint-name>              # assign to a sprint
scrummy move <id> --backlog                  # send back to the inbox
scrummy set-status <id> <status>

scrummy create-sprint <name> --goal "..." [--notes "..."] [--position <n>]
scrummy edit-sprint <name> [--goal "..."] [--notes "..."]
scrummy remove-sprint <name>                 # only if empty — move issues out first
scrummy set-position <name> <n>              # advisory sort only
# Sprint status is derived from its issues — there is no command to set it.
# A sprint becomes active when you start work on its issues (set-status <id> doing),
# and done when all of them are done. See "Sprint" in ../README.md and the
# derivation table in architecture.md.

scrummy spec <id>                            # create/return path to specs/<id>.md

scrummy log-issue <id> --type plan|verified|pending "<message>"   # append a progress-log entry for the issue

scrummy install-skills                       # copy the Claude Code skill files into .claude/skills/

scrummy roadmap                               # regenerate ROADMAP.md on demand (also runs automatically after every writer above)
```

## Reader (the linchpin — rich enough that the agent never opens raw files)

By default, done issues and done sprints are hidden — `--done` reveals them.
`--sprint <name>` shows only that sprint's issues and omits the backlog section.

```
scrummy show [--sprint <name>] [--done]      # the human-scannable whole plan
scrummy show --json                          # same content, structured, for the agent
scrummy show-log <id>                        # the progress-log entries for one issue, structured, for the agent
scrummy status                               # one-line summary of the active sprint, e.g. for a shell statusline
scrummy view                                 # interactive terminal kanban board (Ink TUI); press S for the
                                             #   sprint board — every sprint laid out in ACTIVE | PLANNED | DONE
                                             #   columns by derived status; Enter drills into a sprint's issues
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
  #3   doing  Rotate signing keys              [spec]  [log]
  #9   ready  Lock down password reset flow
  #12  ready  Rework auth token refresh        [spec]

  SPRINT onboarding-polish   (planned)
  goal: first-run experience feels finished
  #7   ready  Welcome tour
  #22  idea   Sample data seeding
```

The pretty view and the `--json` view render from the same data, so they can't disagree.

`hasSpec`/`hasLog` (the `[spec]`/`[log]` tags above) tell an agent whether an issue
has a spec file or progress-log entries worth reading before acting — `scrummy spec
<id>` / `scrummy show-log <id>` for the content itself.

## Diagnostics

```
scrummy validate                             # check docs/roadmap/* for invariant violations
                                             #   (duplicate issue ids, duplicate sprint names) —
                                             #   exits non-zero and lists what it found
```

Not a mutator and not part of the normal read/reason/write loop — a standalone
integrity check. The writers above can never produce a duplicate id or sprint name
on their own; `validate` exists to catch the cases that bypass them (a bad merge
conflict resolution, a manual edit to `docs/roadmap/*`) independently of how they
happened. Safe to run any time, including in CI.

## Smart ops (use an LLM · cost tokens · invoked deliberately)

These are Claude Code skills, not `scrummy` subcommands — `scrummy` itself never calls
an LLM. The skill reads via `scrummy show --json`, reasons, proposes the plan in
chat, and on confirmation writes only via the same writer commands a human would
type.

```
scrummy-po                     # skill: conversational front door — routes "PO, let's plan the backlog" etc. to the skills below
scrummy-suggest-batches        # skill: reads the backlog, proposes sprint groupings; you confirm
scrummy-bootstrap              # skill: reads repo code + docs, proposes an initial set of issues/sprints
scrummy-migrate                # skill: full-fidelity port of an existing hand-rolled backlog doc, via a reviewable file artifact
scrummy-audit                  # skill: read-only fidelity check of a completed migration against its approved artifact
scrummy-scratchpad-import      # skill: reads a messy notes file, files one issue per idea; you confirm
scrummy-refine                 # skill: checks a candidate or existing issue for clarity/consistency/spec quality
```

`scrummy-po` is a conversational front door over the other six — same propose-then-
execute discipline as every other skill here, it just routes by intent ("let's plan
the backlog," "where are we," "turn my notes into issues") instead of requiring you
to know which skill to invoke. It never bundles migrate/audit/refine's separate
approval gates into one step; it can chain them in one sitting (migrate → audit →
an offer to run refine), but each gate still fires on its own.

`scrummy-bootstrap` works on an existing codebase *or* a greenfield project with only
docs (or nothing) — and detects a third case, an existing hand-rolled backlog doc
(`ROADMAP.md`, `docs/sprints.md`, `TODO.md`, ...), handing off to `scrummy-migrate`
for that one. Unlike the other smart ops, `scrummy-migrate` doesn't propose in chat —
it writes a markdown mapping table to `docs/roadmap-legacy/_migration-plan.md` for
you to read and edit directly, and executes only the (possibly edited) file once
you approve it; ambiguities (possible duplicates, thin notes, which sprint should
be active) are flagged in the file, never silently resolved — that's
`scrummy-refine`'s job, run separately afterward. `scrummy-audit` is the third leg of
the same migration flow: run it after `scrummy-migrate` to mechanically reconcile
the resulting backlog against the approved artifact (every row produced an issue,
counts match, nothing silently dropped) — a different question from "is this
backlog any good," which is `scrummy-refine`'s. `migrate`/`audit`/`refine` are three
separate, explicitly-invoked actions on purpose, never bundled into one step.
`scrummy-scratchpad-import` is for unstructured prose with no fixed shape — notes
jotted for your own future reference, not an existing plan. `scrummy-refine` doesn't
file or move anything itself; `scrummy-add-issue` and `scrummy-scratchpad-import` both
call it as a quality check before filing. `scrummy-refine` also has an explicit
**batch mode** for running over a whole issue set at once (most commonly the
issues a migration just created) — it asks up front whether you want findings one
at a time or as a single batched list, and only acts on the decisions you actually
approve; nothing gets silently merged or edited.

See [architecture.md](architecture.md) for how these fit together and
[README.md](../README.md) for a quick overview.
