# Developing scrummy itself

scrummy is written in TypeScript and runs from compiled `dist/` (the published
`bin`). `dist/` is gitignored and never committed. Freshness is guaranteed without an
install-time lifecycle script — deliberately, so dependent projects never see an
`@lavamoat/allow-scripts` warning on `npm install`:

- **`.githooks/pre-commit`** rebuilds `dist/` on every commit. Editing source does *not*
  rebuild on its own — for live iteration without committing, run from source with
  `npm run dev -- <command>` (tsx). The hook is **not** auto-installed; after cloning
  this repo to work on it, run once: `git config core.hooksPath .githooks`.
- **`prepublishOnly`** runs build + typecheck + tests before `npm publish`, so a stale
  or broken `dist/` can never reach the registry. `files: ["dist/", "skills/"]` ships
  both the built output and the skill definitions — `install-skills` resolves them from
  `packageRoot()/skills`, so omitting them yields a CLI whose `install-skills` finds
  nothing in any install that copies the package rather than symlinking it.

### How dependent projects should consume this repo

`npm install file:../scrummy` **symlinks** by default, so the dependent project runs
whatever is in this working tree right now. Combined with the pre-commit rebuild above,
that means a commit on any branch here — unreleased, unreviewed — changes every local
dependent's behaviour immediately. There is no "unreleased" state.

That is a hazard, not a feature, and it has cost twice: a mandatory git-sync build
auto-merged 5 unreviewed PRs onto a consuming project's production `main`, and later an
unfinished storage-layout migration converted a consuming project's backlog mid-session.

Dependents should therefore install a **snapshot copy**, not a symlink:

```
# in the dependent project
echo "install-links=true" >> .npmrc
rm -rf node_modules/scrummy && npm install
```

Refreshing it is then deliberate: `npm run build` here, then `rm -rf
node_modules/scrummy && npm install` there. A plain `npm install` will **not** pick up
changes — npm serves the cached copy. Use `npm run dev -- <command>` for iteration
inside this repo instead of relying on a dependent to see edits.

Note: because there is no `prepare` script, installing scrummy directly from a **git
URL** does not build `dist/` automatically — depend on the published package (or a
local `file:` checkout you build), not a raw git URL.

See `SPRINTS.md` for the build plan and what's next.
