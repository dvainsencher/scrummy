---
name: scrummy-scratchpad-import
description: This skill should be used when the user has a messy notes/scratchpad file full of draft ideas and wants them turned into backlog issues — phrases like "import my scratchpad", "turn these notes into issues", "read tmp/scratchpad.md and file what's in there", or "I've been jotting ideas in a file, bring them into the backlog".
---

# scrummy: scratchpad import

This project tracks work with `scrummy`, a flat-file backlog/sprint manager. The one
rule that matters: **the `scrummy` CLI is the only writer to `docs/roadmap/*`.** You
read the plan via `npx scrummy show --json` and you write to it only by calling `scrummy`
commands — never by editing `docs/roadmap/issues.jsonl`, `docs/roadmap/sprints.json`,
or `docs/roadmap/specs/*.md` directly, even though they're plain files you technically
could open. (Spec *content* is the documented exception — see step 4.)

Unlike `scrummy-bootstrap` (seeds a plan from existing code/docs) and
`scrummy-suggest-batches` (only regroups issues that already exist), this skill's
input is unstructured prose — a notes file with no fixed shape, written for the
author's own future reference, not as a backlog.

## Steps

1. Ask for (or confirm) the path to the notes file if not given — common examples:
   `tmp/scratchpad.md`, `notes.md`, a `TODO.md`. Read it in full.
2. Identify distinct ideas in the file. A single idea may span several lines or
   paragraphs; don't split one thought into multiple issues, and don't merge two
   unrelated thoughts into one. If a section is genuinely ambiguous (could be one
   idea or several), ask the user rather than guessing.
3. For each candidate idea, run `scrummy-refine`'s checks (definition clarity,
   consistency against `npx scrummy show --json`, spec quality if you're about to create
   one) before filing. If a note is too thin to file confidently — a fragment, a
   half-sentence, no clear scope — don't file it as a vague idea by default.
   Offer the user a choice: **refine now** (ask one calibrating question — what
   problem it's solving, or what done looks like — and use the answer to sharpen
   the idea before filing), **file as-is** (accept the vagueness and file it
   anyway, e.g. for a placeholder), or **skip it**. Default to refining now unless
   the user says otherwise; a plain chat question is fine if no structured
   question UI is available. If `scrummy-refine` flags the note as a likely
   duplicate of an existing issue, don't file it — tell the user which issue it
   overlaps with and ask whether to skip it, merge the note into that issue's spec
   instead, or file it anyway as a separate issue.
4. Once a candidate is clear enough (directly, or after the user's answer):
   - `npx scrummy add-issue "<title>" [--status idea|ready]` — leave unset (backlog)
     unless the note clearly ties to an existing sprint by name.
   - If the note has enough detail to be more than a one-liner, run
     `npx scrummy spec <id>` to create `specs/<id>.md`, then write the note's detail into
     that file with normal file-editing tools (spec content isn't roadmap
     metadata — only its creation goes through the CLI).
5. **Don't execute silently** — for anything beyond a single obvious idea, list
   what you're about to file (title, status, and whether it gets a spec) before
   calling `add-issue`, the same propose-then-act pattern every other scrummy skill
   follows.
6. After filing, tell the user what was created (ids + titles). Then propose
   cleaning up the scratchpad: remove **only** the sections that actually
   resulted in a filed issue (one you ran `add-issue` for in step 4) — never the
   whole file, and never anything else. Anything not filed stays untouched, even
   if you reviewed it: notes left as a bare fragment/TODO (e.g. a heading
   followed by just "TODO"), anything the user chose to skip, and anything still
   pending a decision. Show the exact section(s) you're about to remove before
   editing, and only remove them after the user confirms — don't delete or
   modify the file yourself otherwise.

Tell the user the result in a short list — don't re-read the whole scratchpad back
to them.
