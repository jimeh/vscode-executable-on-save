---
alwaysApply: true
---

# AGENTS.md

VS Code extension: auto-marks files with shebangs (`#!`) as executable on save.

## Setup

Node.js 20.x, pnpm.

```sh
pnpm install
```

## Commands

```sh
pnpm run lint:fix         # Format + auto-fix
pnpm test                 # Full check (compile + lint + tests)
pnpm run package          # Build VSIX
pnpm run verify:vsix-files # Verify VSIX contents
```

After changes: `pnpm run lint:fix && pnpm test`

## Key Conventions

- Three permission strategies: "umask" (default), "read-based", "all"
  — grep for `calculateNewMode`
- Config keys under `executableOnSave.*` — defined in package.json
  `contributes.configuration`
- Tests run in VS Code Electron via `@vscode/test-cli` + Mocha + Sinon
- Tests colocated in `src/test/`, compiled to `out/` (separate from
  esbuild bundle in `dist/`)

## Gotchas

- `process.umask(0)` is destructive — must immediately restore
- VSIX uses `"files"` allowlist in package.json (not `.vscodeignore`).
  Update both `"files"` in package.json and `EXPECTED_FILES` in the
  verify script when adding packaged files
- Never manually bump versions or edit CHANGELOG.md —
  release-please automates this via conventional commits
