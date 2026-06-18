# pauta

A flat-file backlog and sprint manager, driven identically by a human at a terminal
and by Claude Code over the same files. See `README.md` for the full design and
`SPRINTS.md` for the build plan.

## The one architectural rule

**The CLI is the only writer. The LLM reads and decides; it never writes files
directly.** Mechanical operations (add-item, move, create-sprint, ...) are zero-token
file edits run via the CLI by either a human or an agent. Smart ops (`suggest-batches`,
`bootstrap`) read via the reader and write via the same writer commands — no special
file access. Never have an agent edit `docs/roadmap/*` files directly; always go
through the CLI.

## Decisions (resolved open questions)

- **Language/runtime**: Node/TypeScript.
- **CLI command name**: `pauta` (the README's "roadmap" is the working name from the
  original design doc — the project and command are both `pauta`).
- **On-disk format**: JSONL (`items.jsonl`) + JSON (`sprints.json`) only. The raw files
  are not meant to be human-readable on their own — `pauta show` is the only
  human-facing view. This resolves README's open decision and backlog item #104.
- **Distribution**: per-project install only (no global mode). `pauta init` scaffolds
  `docs/roadmap/` inside each project; CLI and skill files are installed per-project.

## Status

Greenfield — no code yet. Current build plan lives in `SPRINTS.md`; sprint
`foundation` (position 10) is first, starting with `#0 pauta init`.
