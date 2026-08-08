# Developing scrummy itself

scrummy is written in TypeScript and runs from compiled `dist/` (the published
`bin`). `dist/` is gitignored and never committed. Freshness is guaranteed without an
install-time lifecycle script — deliberately, so dependent projects never see an
`@lavamoat/allow-scripts` warning on `npm install`:

- **`.githooks/pre-commit`** rebuilds `dist/` on every commit. This is what keeps the
  local-symlink case fresh: a project depending on scrummy via `file:../scrummy`
  resolves through a symlink to this repo and runs **this** `dist/`, so one rebuild
  updates every local dependent at once. Editing source does *not* rebuild on its own —
  for live iteration without committing, run from source with `npm run dev -- <command>`
  (tsx). The hook is **not** auto-installed; after cloning this repo to work on it, run
  once: `git config core.hooksPath .githooks`.
- **`prepublishOnly`** runs build + typecheck + tests before `npm publish`, so a stale
  or broken `dist/` can never reach the registry, and `files: ["dist/"]` ships the built
  output in the tarball.

Note: because there is no `prepare` script, installing scrummy directly from a **git
URL** does not build `dist/` automatically — depend on the published package (or a
local `file:` checkout you build), not a raw git URL.

See `SPRINTS.md` for the build plan and what's next.
