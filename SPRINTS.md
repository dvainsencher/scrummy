# Build plan

A **soft** plan — sprints are context batches, positions are advisory, and the order is a suggestion you can abandon. Laid out roughly the way `roadmap show` would render it, because we may as well eat our own dog food.

Four sprints. Each is independently valuable; after `foundation` alone you have a working flat-file tracker you can drive by hand.

---

## BACKLOG (deferred ideas — no sprint)

These are real ideas we discussed and chose *not* to schedule yet. They live in the inbox so they're captured without committing.

```
#101  idea   External inspector agent — run from outside a repo, manage its roadmap without coding in it
#102  idea   "Feature helper" mode — discuss/extract features from a project (explicitly out of scope for now; scope creep risk)
#103  idea   Scratchpad import helper — hand a notes file to the agent, it emits add-item calls
#104  done   Decide raw-file readability: resolved — JSONL/JSON only, not hand-readable; `show` is the only human-facing view (see CLAUDE.md)
```

---

## ✅ SPRINT foundation   (position 10)

**goal:** a fully working flat-file tracker driven entirely by hand, with no LLM anywhere. This is the whole mechanical layer.

```
#0   done  pauta init — scaffold docs/roadmap/ (empty items, sprints, specs/) in a project; mechanical, no LLM
#1   done  Decide & document the serialization format (JSONL items + JSON sprints; resolves #104)
#2   done  Define the on-disk schema for an item (id, title, status, sprint) and a sprint (name, position, status, goal, notes)
#3   done  id allocation — short monotonic integers, stable across edits
#4   done  add-item / edit-item / remove-item
#5   done  create-sprint / edit-sprint
#6   done  move <id> <sprint> and move <id> --backlog
#7   done  set-status (item) and set-sprint-status / set-active (sprint)
#8   done  set-position (advisory sort, sparse with gaps of 10)
#9   done  spec <id> — create/return specs/<id>.md, and derive has_spec from file existence
#10  done  Backlog = items with empty sprint (no special storage; just a filter)
```

**Exit check:** ✅ verified — built a small real plan via `pauta init` → `create-sprint`
→ `add-item` → `move` → `set-status` → `set-active` → `set-position` → `spec` against
a scratch directory; resulting `items.jsonl`/`sprints.json` are valid and inspected by hand.

---

## ✅ SPRINT the-reader   (position 20)

**goal:** make reading so good the agent never wants to open a raw file. This is the linchpin that keeps the "LLM only reads via commands" boundary intact.

```
#11  done  show (pretty) — the whole-plan scan: backlog first, then sprints by position, active marked
#12  done  show --json — identical content, structured, as the agent feed
#13  done  Guarantee pretty and --json render from the same data path (can't disagree)
#14  done  Filters: --sprint <name>, --done
#15  done  Mark the active sprint and show it first
```

Resolved during implementation: default `show` hides both done items and done
sprints entirely (`--done` reveals everything); `--sprint <name>` shows only that
sprint's items and omits the backlog section, but an explicit `--sprint` on a done
sprint still shows it (the explicit ask overrides the default-hide rule).

**Exit check:** ✅ verified — `show --json` contains everything an agent would
otherwise need to read files for (items with id/title/status/sprint/hasSpec, sprints
with name/position/status/goal/notes/active), confirmed against a scratch directory
seeded to match the README's example plan.

---

## SPRINT agent-skills   (position 30)

**goal:** wire it into Claude Code so a design discussion ends in clean command calls, never direct file edits.

```
#16  ready  Distribute the CLI — script on PATH or repo-local; document how a project gets `roadmap`
#17  ready  Install skill files into the project's Claude Code skills location (the agent picks them up)
#18  ready  Existing vs new project setup: existing → init + bootstrap (read code); new → init + optional bootstrap (docs/empty)
#19  ready  Claude Code skill: add roadmap item after a feature discussion (read show --json → emit add-item/move)
#20  ready  Claude Code skill: reorganize — read everything, propose moves/new sprints, emit writer commands only
#21  ready  Enforce the rule in the skill instructions: read via show --json, write via commands, never touch files
#22  idea   Scratchpad import: hand a notes file to the skill, it emits one add-item per note (resolves #103)
```

**Exit check:** in a fresh clone of a real project, you can install the CLI + skills, run `init`, and a Claude Code session's "add this and slot it" results in the agent calling commands — files only ever written by the CLI.

---

## SPRINT smart-ops   (position 40)

**goal:** the token-using layer — the only part that reaches for a model. Sits above the mechanical line; reads via `show --json`, writes via the same writer commands.

```
#20  idea   suggest-batches — read all items, propose related groupings as sprints, present for confirmation
#21  idea   bootstrap — read repo code + docs, propose an initial set of items and sprints
#22  idea   bootstrap for greenfield — docs-only or empty project, no code to read
#23  idea   Confirmation flow — smart ops propose command calls; nothing is written until you approve
```

**Exit check:** point `bootstrap` at an existing repo and get a sensible starting plan you can accept or edit; `suggest-batches` turns a messy backlog into proposed context batches.

---

### How to read this plan

Positions 10/20/40 are *suggestions*. If `the-reader` turns out to matter more than finishing every `foundation` nicety, activate it early — `set-active the-reader` — and nothing breaks, because there's no enforced order. The plan is a map, not a track.
