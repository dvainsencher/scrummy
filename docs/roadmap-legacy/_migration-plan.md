# scrummy Migration Plan

Source: `SPRINTS.md` (root)
Generated: 2026-06-26

## Counts

- Issues: 55 (42 in sprints + 13 in backlog)
- Sprints: 9
- Flagged rows: 4
- Open questions: 2

Edit this file directly (rows, statuses, sprint names, flags, open-question answers) before approving.

---

## Open Questions

1. **Mark active sprint?**
   All 9 sprints have every item marked `done`. Recent git commits touch issue #129 (ROADMAP.md
   generation), which is a backlog item with no sprint. Recommendation: **leave no sprint active**
   — confirm or name a sprint to set active.

2. **IDs #22 and #23 are absent from source.**
   `smart-ops` jumps from #21 to #24. These IDs may have been removed issues that were never
   tracked here. Recommendation: **skip them** — they have no content to migrate. Confirm or
   provide titles if they should be added.

---

## Sprints

| Sprint | Goal |
|--------|------|
| foundation | a fully working flat-file tracker driven entirely by hand, with no LLM anywhere. |
| the-reader | make reading so good the agent never wants to open a raw file. |
| agent-skills | wire it into Claude Code so a design discussion ends in clean command calls. |
| smart-ops | the token-using layer — the only part that reaches for a model. |
| install-skills-polish | close out two small PR #4 review items and one blank-page-friction fix. |
| issue-quality | stop underspecified issues from being filed silently. |
| migration-tooling | turn the manual migration playbook into something a human can review before and after it runs. |
| po-persona | a single conversational entry point ("PO, let's plan the backlog") that routes natural requests to the right existing skill. |
| progress-log | give a long-running `doing` issue a resumable history. |

---

## Issue Mapping Table

Columns: `source ref | proposed title | status | sprint | spec-action | flags`

| source ref | proposed title | status | sprint | spec-action | flags |
|------------|----------------|--------|--------|-------------|-------|
| #0 | scrummy init — scaffold docs/roadmap/ | done | foundation | | |
| #1 | Decide & document the serialization format (JSONL issues + JSON sprints) | done | foundation | | |
| #2 | Define on-disk schema for issue and sprint | done | foundation | | |
| #3 | ID allocation — short monotonic integers, stable across edits | done | foundation | | |
| #4 | add-issue / edit-issue / remove-issue | done | foundation | | |
| #5 | create-sprint / edit-sprint | done | foundation | | |
| #6 | move <id> <sprint> and move <id> --backlog | done | foundation | | |
| #7 | set-status (issue) and set-sprint-status / set-active (sprint) | done | foundation | | |
| #8 | set-position (advisory sort, sparse with gaps of 10) | done | foundation | | |
| #9 | spec <id> — create/return specs/<id>.md | done | foundation | | |
| #10 | Backlog = issues with empty sprint (filter, not special storage) | done | foundation | | |
| #11 | show (pretty) — whole-plan scan: backlog first, then sprints by position | done | the-reader | | |
| #12 | show --json — identical content, structured, as agent feed | done | the-reader | | |
| #13 | Guarantee pretty and --json render from the same data path | done | the-reader | | |
| #14 | Filters: --sprint <name>, --done | done | the-reader | | |
| #15 | Mark the active sprint and show it first | done | the-reader | | |
| #16 | Distribute the CLI (npm devDependency via git/file URL) | done | agent-skills | | |
| #17 | install-skills — copy skills/ into .claude/skills/ | done | agent-skills | | |
| #18 | Existing vs new project setup documentation | done | agent-skills | | |
| #19 | Claude Code skill: scrummy-add-issue | done | agent-skills | | |
| #20 | Claude Code skill: scrummy-reorganize | done | agent-skills | | |
| #21 | Enforce reader/writer rule in skill instructions | done | agent-skills | | |
| #24 | suggest-batches skill | done | smart-ops | | |
| #25 | bootstrap skill — read repo code + docs, propose initial issues and sprints | done | smart-ops | | |
| #26 | bootstrap for greenfield — docs-only or empty project | done | smart-ops | | |
| #27 | Confirmation flow — smart ops propose commands; nothing written until approved | done | smart-ops | | |
| #103 | scrummy-scratchpad-import skill | done | issue-quality | | |
| #105 | install-skills: friendly error when skills/ source dir is missing | done | install-skills-polish | | |
| #106 | install-skills: test for missing-source-dir path | done | install-skills-polish | | |
| #107 | spec <id>: scaffold new spec files with fixed-section skeleton | done | install-skills-polish | | |
| #108 | scrummy-add-issue: title-length/vagueness heuristic with calibrating question | done | issue-quality | | |
| #110 | scrummy-refine skill — shared quality check helper | done | issue-quality | | |
| #111 | scrummy-bootstrap: third case for migrating an existing hand-rolled backlog | done | migration-tooling | | |
| #112 | CLI batch-import — scrummy import <file> validates + writes all issues at once | done | migration-tooling | | |
| #113 | scrummy init: refuse when docs/roadmap/ exists with non-scrummy content | done | migration-tooling | | |
| #114 | README/CLAUDE.md template: "Adopting scrummy" section | done | migration-tooling | | |
| #115 | Sprint-structure ambiguity surfaced explicitly in scrummy-migrate | done | migration-tooling | | |
| #116 | scrummy-migrate skill — mechanical migration only, fidelity-first | done | migration-tooling | | |
| #117 | scrummy-audit skill — migration fidelity audit | done | migration-tooling | | |
| #118 | Explicit migrate/refine separation documented | done | migration-tooling | | |
| #122 | scrummy-po skill — conversational front door routing to other 8 skills | done | po-persona | | |
| #123 | Per-issue progress log — progress.jsonl + log-issue + show-log commands | done | progress-log | | |
| #101 | External inspector agent — run from outside a repo, manage its roadmap without coding in it | idea | | | |
| #102 | "Feature helper" mode — discuss/extract features from a project | idea | | | explicitly marked out of scope in source; migrate as idea or skip? |
| #104 | Decide raw-file readability (resolved: JSONL/JSON only, show is the only human view) | done | | | this is a design decision, not a feature — migrate as done backlog item or skip? |
| #109 | AskUserQuestion degradation — scrummy skills should degrade to plain chat prompts where structured widgets unavailable | idea | | | source status is "note" — no scrummy equivalent; mapped to `idea`; confirm or change |
| #119 | Issue split/merge/parent-child relationships | idea | | | |
| #120 | Staleness queries | idea | | | |
| #121 | Issue-level prioritization | idea | | | |
| #124 | Mutating commands exit silently on success — add one-line confirmation string | done | | | |
| #125 | No --help or bare-invocation usage text | done | | | |
| #126 | Installed skill files invoke bare scrummy — switch to npx scrummy | done | | | |
| #127 | No single-issue reader — add optional <id> positional to show | done | | | |
| #128 | Sprint name mismatches throw hard error — add "Did you mean ...?" suggestion | done | | | |
| #129 | Generated ROADMAP.md — every mutating command regenerates ROADMAP.md at root | done | | | |

---

## Approval

To approve, reply "approve" (or edit rows above first, then approve).
