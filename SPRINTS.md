# Build plan

A **soft** plan — sprints are context batches, positions are advisory, and the order is a suggestion you can abandon. Laid out roughly the way `roadmap show` would render it, because we may as well eat our own dog food.

Four sprints. Each is independently valuable; after `foundation` alone you have a working flat-file tracker you can drive by hand.

---

## BACKLOG (deferred ideas — no sprint)

These are real ideas we discussed and chose *not* to schedule yet. They live in the inbox so they're captured without committing.

```
#101  idea   External inspector agent — run from outside a repo, manage its roadmap without coding in it
#102  idea   "Feature helper" mode — discuss/extract features from a project (explicitly out of scope for now; scope creep risk)
#103  idea   Scratchpad-to-issues skill (supersedes the original "emit add-issue calls" framing) — a pre-backlog/pre-sprint interactive step: read a messy notes/scratchpad file, discuss unclear points with the user, then transform notes into issues (and specs where warranted) via the writer commands. Richer than pauta-bootstrap (which seeds from existing code/docs) and pauta-suggest-batches (which only regroups existing issues) — this one's input is unstructured prose, not the existing plan. (Was briefly duplicated as agent-skills #22 "scratchpad import"; merged back here — single idea, not scheduled.)
#104  done   Decide raw-file readability: resolved — JSONL/JSON only, not hand-readable; `show` is the only human-facing view (see CLAUDE.md)
#105  idea   install-skills: friendly error when the package's skills/ source dir is missing/unreadable, matching the assertX-style validation used elsewhere in src/cli/commands (raised in PR #4 review)
#106  idea   install-skills: add a test covering the missing-source-dir path once #105 lands (raised in PR #4 review)
#107  idea   pauta spec <id>: scaffold new spec files with a fixed-section skeleton (Problem / Approach / Acceptance criteria / Open questions) instead of an empty file — less blank-page friction, same lightweight philosophy (only new files get the skeleton; existing specs are untouched)
#108  idea   pauta-add-issue skill: before calling add-issue, judge whether the title alone is clear enough to implement later; if not, ask the user a calibrating "why"/context question first rather than filing an underspecified issue silently
#109  note   AskUserQuestion (or any structured clarifying-question UI) has no equivalent in most other agentic tools (Cursor/Aider/Windsurf just ask inline in chat) — any pauta skill that asks clarifying questions should degrade to plain chat prompts, not assume a structured widget exists
```

---

## ✅ SPRINT foundation   (position 10)

**goal:** a fully working flat-file tracker driven entirely by hand, with no LLM anywhere. This is the whole mechanical layer.

```
#0   done  pauta init — scaffold docs/roadmap/ (empty issues, sprints, specs/) in a project; mechanical, no LLM
#1   done  Decide & document the serialization format (JSONL issues + JSON sprints; resolves #104)
#2   done  Define the on-disk schema for an issue (id, title, status, sprint) and a sprint (name, position, status, goal, notes)
#3   done  id allocation — short monotonic integers, stable across edits
#4   done  add-issue / edit-issue / remove-issue
#5   done  create-sprint / edit-sprint
#6   done  move <id> <sprint> and move <id> --backlog
#7   done  set-status (issue) and set-sprint-status / set-active (sprint)
#8   done  set-position (advisory sort, sparse with gaps of 10)
#9   done  spec <id> — create/return specs/<id>.md, and derive has_spec from file existence
#10  done  Backlog = issues with empty sprint (no special storage; just a filter)
```

**Exit check:** ✅ verified — built a small real plan via `pauta init` → `create-sprint`
→ `add-issue` → `move` → `set-status` → `set-active` → `set-position` → `spec` against
a scratch directory; resulting `issues.jsonl`/`sprints.json` are valid and inspected by hand.

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

Resolved during implementation: default `show` hides both done issues and done
sprints entirely (`--done` reveals everything); `--sprint <name>` shows only that
sprint's issues and omits the backlog section, but an explicit `--sprint` on a done
sprint still shows it (the explicit ask overrides the default-hide rule).

**Exit check:** ✅ verified — `show --json` contains everything an agent would
otherwise need to read files for (issues with id/title/status/sprint/hasSpec, sprints
with name/position/status/goal/notes/active), confirmed against a scratch directory
seeded to match the README's example plan.

---

## ✅ SPRINT agent-skills   (position 30)

**goal:** wire it into Claude Code so a design discussion ends in clean command calls, never direct file edits.

```
#16  done   Distribute the CLI — document how a project gets `pauta` (npm devDependency via git/file URL; not published to a registry yet)
#17  done   Install skill files into the project's Claude Code skills location (`pauta install-skills` copies skills/ into .claude/skills/)
#18  done   Existing vs new project setup: documented in README — bootstrap doesn't exist yet (smart-ops sprint), so both paths are init + install-skills + add issues by hand for now
#19  done   Claude Code skill: add roadmap issue after a feature discussion (skills/pauta-add-issue — read show --json → emit add-issue/move)
#20  done   Claude Code skill: reorganize — read everything, propose moves/new sprints, emit writer commands only (skills/pauta-reorganize)
#21  done   Enforce the rule in the skill instructions: read via show --json, write via commands, never touch files (baked into both SKILL.md files)
```

**Exit check:** ✅ verified — `pauta install-skills` run against a scratch project
directory (regardless of cwd) correctly copies `pauta-add-issue` and
`pauta-reorganize` from the package's own `skills/` dir into `.claude/skills/`,
overwriting on re-run.

---

## ✅ SPRINT smart-ops   (position 40)

**goal:** the token-using layer — the only part that reaches for a model. Sits above the mechanical line; reads via `show --json`, writes via the same writer commands.

```
#24  done   suggest-batches — read all issues, propose related groupings as sprints, present for confirmation (skills/pauta-suggest-batches)
#25  done   bootstrap — read repo code + docs, propose an initial set of issues and sprints (skills/pauta-bootstrap)
#26  done   bootstrap for greenfield — docs-only or empty project, no code to read (same skill, branches on whether there's code to read)
#27  done   Confirmation flow — smart ops propose command calls; nothing is written until you approve (same "propose in chat, then execute" pattern as pauta-reorganize, baked into both new skills)
```

Resolved during implementation: these are Claude Code skills, not new `pauta`
CLI subcommands — the CLI stays purely mechanical (no LLM, no API key handling)
and `install-skills` already copies any directory under `skills/` generically, so
no CLI changes were needed to ship the two new skills.

**Exit check:** ✅ verified — `skills/pauta-bootstrap/SKILL.md` and
`skills/pauta-suggest-batches/SKILL.md` follow the same read-via-`show --json` /
propose-in-chat / write-via-writer-commands pattern as the existing skills, and
`pauta install-skills` (generic over `skills/` subdirectories, confirmed by its
existing tests) picks both up without any code change.

---

### How to read this plan

Positions 10/20/40 are *suggestions*. If `the-reader` turns out to matter more than finishing every `foundation` nicety, activate it early — `set-active the-reader` — and nothing breaks, because there's no enforced order. The plan is a map, not a track.
