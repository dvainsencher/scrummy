# scrummy

A flat-file backlog and sprint manager, driven identically by a human at a terminal
and by Claude Code over the same files. See `README.md` for the full design and
`SPRINTS.md` for the build plan.

## The one architectural rule

**The CLI is the only writer. The LLM reads and decides; it never writes files
directly.** Mechanical operations (add-issue, move, create-sprint, ...) are zero-token
file edits run via the CLI by either a human or an agent. Smart ops (`suggest-batches`,
`bootstrap`) read via the reader and write via the same writer commands — no special
file access. Never have an agent edit `docs/roadmap/*` files directly; always go
through the CLI.

## Decisions (resolved open questions)

- **Language/runtime**: Node/TypeScript.
- **CLI command name**: `scrummy` (the README's "roadmap" is the working name from the
  original design doc — the project and command are both `scrummy`).
- **On-disk format**: JSONL (`issues.jsonl`) + JSON (`sprints.json`) only. The raw files
  are not meant to be human-readable on their own — `scrummy show` is the only
  human-facing view. This resolves README's open decision and backlog issue #104.
- **Distribution**: per-project install only (no global mode). `scrummy init` scaffolds
  `docs/roadmap/` inside each project; CLI and skill files are installed per-project.

## Backlog

This project tracks its own work with scrummy. Use `npm exec scrummy -- show` to see
the current backlog and sprint state (in npm 11+, `npx scrummy` no longer resolves
local binaries — use `npm exec scrummy -- <cmd>` or `./node_modules/.bin/scrummy <cmd>`
instead). Do not read or write `SPRINTS.md` (legacy, superseded by `docs/roadmap/`) or
`docs/roadmap/*` files directly — go through the CLI.
