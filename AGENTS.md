---
alwaysApply: true
---

# AGENTS.md

This file provides guidance to AI agents when working with code in this
repository.

## Overview

VS Code extension that automatically marks files with shebangs (`#!`) as
executable on save. Supports three permission strategies: "umask" (default,
respects system umask), "read-based" (adds execute only where read permission
exists), and "all" (adds execute for user/group/other unconditionally).

## Prerequisites

Node.js 20.x required (matches `@types/node` dependency).

```sh
pnpm install
```

## Development Commands

```sh
pnpm run watch            # Continuous rebuild + type checking
pnpm run compile          # Full build with lint and type checks
pnpm run lint             # Run prettier + eslint checks
pnpm run lint:fix         # Format with prettier and auto-fix eslint
pnpm test                 # Run all tests (includes compile + lint)
pnpm run compile-tests    # Compile tests to out/ directory
pnpm run package          # Minified production build
```

## Packaging Commands

```sh
pnpm run vscode:package   # Build VSIX with descriptive filename
pnpm run vsce:ls          # List files that will be in the VSIX
pnpm run verify:vsix-files # Verify VSIX contains exactly expected files
```

VSIX packaging uses an explicit `"files"` allow-list in `package.json` (not
`.vscodeignore`). When adding new files that should be in the package, update
both the `"files"` array in `package.json` and the `EXPECTED_FILES` list in
`scripts/verify-vsix-files.ts`.

## Architecture

### Core Flow

1. [src/extension.ts](src/extension.ts) - Entry point, registers save hook and
   manual command
2. [src/document-handler.ts](src/document-handler.ts) - Main processing logic:
   checks platform, config, shebang, applies chmod
3. [src/permissions.ts](src/permissions.ts) - Permission calculations with
   three strategies
4. [src/config.ts](src/config.ts) - Configuration management
5. [src/notifications.ts](src/notifications.ts) - User feedback

### Permission Strategies

**umask strategy** (default): Respects system umask when adding execute bits.
Calculates allowed execute bits as `(0o777 & ~umask) & 0o111`. Most
Unix-correct approach. With umask `0o022`, adds `0o111` (all execute). With
umask `0o077`, adds only `0o100` (user execute).

**read-based strategy**: Only adds execute where read exists by shifting read bits
right 2 positions (e.g., `0o644` → `0o755`, `0o600` → `0o700`).

**all strategy**: Always adds `0o111` (execute for all) via bitwise OR.

All strategies preserve special bits (setuid, setgid, sticky).

### Build System

[esbuild.js](esbuild.js) bundles `src/` → `dist/extension.js`:

- Entry: `src/extension.ts`
- Format: CommonJS
- Externalizes `vscode` module
- Production: minified, no sourcemaps
- Watch mode: custom problem matcher for VS Code integration

## Development Workflow

After making changes:

```sh
pnpm run lint:fix
pnpm test
```

## Releases

Releases are fully automated via
[release-please](https://github.com/googleapis/release-please):

- **Version bumping**: Automatic based on
  [Conventional Commits](https://www.conventionalcommits.org/) (feat: →
  minor, fix: → patch, BREAKING CHANGE: → major)
- **Changelog generation**: Auto-generated from commit messages and
  linked to PRs/commits
- **Publishing**: Automatic on tag creation to VSCode Marketplace,
  OpenVSX, and GitHub Releases

### How It Works

1. Push commits with conventional commit messages (e.g.,
   `feat: add new feature`, `fix: resolve bug`)
2. release-please creates/updates a release PR with version bump and
   changelog
3. Merge the release PR → creates a tag → triggers automatic
   publishing

**Never manually**:

- Bump version in `package.json`
- Edit `CHANGELOG.md`
- Create version tags

## Configuration Keys

Four settings in [package.json](package.json) under `executableOnSave.*`:

- `enabled` (boolean, default: true)
- `permissionStrategy` (enum: "umask"|"read-based"|"all", default: "umask")
- `silent` (boolean, default: false) - suppresses info notifications
- `silentErrors` (boolean, default: false) - suppresses error notifications

## Test Suite

- [src/test/extension.test.ts](src/test/extension.test.ts) - End-to-end tests
  with real files and VS Code APIs
- [src/test/permissions.test.ts](src/test/permissions.test.ts) - Pure unit tests
  for permission calculations
- [src/test/notifications.test.ts](src/test/notifications.test.ts) - Unit tests
  for notification functions

## Key Implementation Details

1. **Shebang detection**: Reads first 2 characters using `vscode.Range`
   validation
2. **Executable check**: Uses `fs.stat()` and bitwise `mode & 0o111`
3. **Read-based strategy logic**: Shifts read bits right to derive execute bits,
   ensuring symmetry with read permissions
4. **Skip conditions**: Windows platform, untitled documents, non-file URIs
5. **Error handling**: Logs all errors; shows notifications for
   EACCES/ENOENT/unexpected errors unless `silentErrors` enabled

## Troubleshooting

- **Stale builds**: Delete `dist/` and run `pnpm run compile`
- **Test failures**: Ensure `pnpm run compile-tests` succeeds first
- **Watch mode errors**: Check console for esbuild problem matcher output
