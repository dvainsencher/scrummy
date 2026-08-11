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
- **On-disk format**: one JSON file per record — `issues/<id>.json`,
  `sprints/<slug>.json`, `progress/<id>/<stamp>.json`, alongside `specs/<id>.md`. The raw
  files are not meant to be human-readable on their own — `scrummy show` is the only
  human-facing view. This resolves README's open decision and backlog issue #104.
  (Superseded the original `issues.jsonl` + `sprints.json`, which made git treat unrelated
  edits as conflicting — see `docs/architecture.md` § Parallel use. Legacy files are read
  and converted automatically.)
- **scrummy never runs git, `gh`, or any subprocess.** Enforced by
  `src/noGitSurface.test.ts`. A tool consumed as a dependency must not reach into the
  consuming project's repository; a previous version did and auto-merged unreviewed PRs
  onto another project's `main`. Concurrency safety is a lockfile (`storage/lock.ts`) and
  merge safety is the on-disk layout — neither needs a subprocess.
- **Distribution**: per-project install only (no global mode). `scrummy init` scaffolds
  `docs/roadmap/` inside each project; CLI and skill files are installed per-project.

## Backlog

This project tracks its own work with scrummy. Use `npm exec scrummy -- show` to see
the current backlog and sprint state (in npm 11+, `npx scrummy` no longer resolves
local binaries — use `npm exec scrummy -- <cmd>` or `./node_modules/.bin/scrummy <cmd>`
instead). Do not read or write `SPRINTS.md` (legacy, superseded by `docs/roadmap/`) or
`docs/roadmap/*` files directly — go through the CLI.
