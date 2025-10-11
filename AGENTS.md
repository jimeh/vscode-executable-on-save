---
alwaysApply: true
---

# AGENTS.md

This file provides guidance to AI agents when working with code in this
repository.

## Overview

VS Code extension that automatically marks files with shebangs (`#!`) as
executable on save. Supports two permission strategies: "safe" (adds execute
only where read permission exists) and "standard" (adds execute for
user/group/other unconditionally).

## Prerequisites

- Node.js 22.x (matches `@types/node` dependency)
- npm (bundled with Node)

```sh
npm install
```

## Commands

### Development

```sh
npm run watch            # Continuous rebuild + type checking
npm run compile          # Full build with lint and type checks
npm run lint             # Run prettier + eslint checks
npm run lint:fix         # Format with prettier and auto-fix eslint errors
node esbuild.js          # Quick rebuild only
node esbuild.js --watch  # Incremental rebuilds
```

### Testing

```sh
npm test                 # Run all tests (includes compile + lint)
npm run compile-tests    # Compile tests to out/ directory
npm run watch-tests      # Watch mode for test compilation
```

### Production

```sh
npm run package          # Minified production build
```

## Architecture

### Extension Entry Point

[src/extension.ts](src/extension.ts) contains all extension logic in a
single file:

- `activate()`: Registers `onDidSaveTextDocument` listener and the
  `mark-executable-on-save.markExecutableIfScript` command
- `makeExecutableIfScript()`: Entry point called on save or via command
- `handleDocument()`: Main flow - checks platform, config, shebang, then
  applies chmod
- `calculateNewMode()`: Core permission logic
  - **safe strategy**: Only adds execute bits where corresponding read
    bits exist (e.g., `0o644` → `0o755`, `0o600` → `0o700`)
  - **standard strategy**: Always adds `0o111` (execute for all)
- `reportError()`: Handles error messages with detailed logging for
  EACCES/ENOENT/unexpected errors
- `announceModeChange()`: Shows information notification with old/new
  permission modes (unless silent mode is enabled)
- Platform guard: Skips all processing on Windows

### Build System

[esbuild.js](esbuild.js) bundles `src/extension.ts` → `dist/extension.js`:

- Uses CommonJS format (`format: 'cjs'`)
- Externalizes `vscode` module
- Production mode: minified, no sourcemaps
- Watch mode: includes custom problem matcher for VS Code integration

### Development Cycle

After making changes, always format and auto-correct linting complaints followed
by running tests. Refer to the development commands section above for how to run
those operations.

### Configuration

Four settings in [package.json](package.json):

- `markExecutableOnSave.enabled` (boolean, default: true)
- `markExecutableOnSave.permissionStrategy` (enum: "safe"|"standard",
  default: "safe")
- `markExecutableOnSave.silent` (boolean, default: false) - suppresses
  information notifications when permissions change
- `markExecutableOnSave.silentErrors` (boolean, default: false) -
  suppresses error notifications when permission updates fail

### Test Suite

[src/test/extension.test.ts](src/test/extension.test.ts) uses Mocha +
Sinon:

- Tests run in VS Code's Electron environment via `@vscode/test-electron`
- Stubs `vscode.workspace.getConfiguration()` to control test behavior
- Creates temp files with specific modes, saves documents, verifies chmod
  results
- Covers: shebang detection, permission strategies, platform guards, URI
  schemes

## Key Implementation Details

1. **Shebang detection**: Reads first 2 characters of document using
   `vscode.Range` validation
2. **Executable check**: Uses Node.js `fs.stat()` and bitwise
   `mode & 0o111`
3. **Safe strategy logic**: Shifts read bits right to derive execute bits,
   ensuring symmetry with read permissions
4. **Error handling**: Logs all errors to console; shows error
   notifications for EACCES/ENOENT/unexpected errors unless
   `silentErrors` is enabled
5. **Skip conditions**: Windows platform, untitled documents, non-file
   URIs
6. **Manual command**: Extension provides a command to manually mark the
   active document executable if it has a shebang

## Release Checklist

1. Ensure `npm run package` succeeds; verify `dist/extension.js` is current
2. Update `CHANGELOG.md` and version in `package.json` as needed
3. Use `vsce package` to create `.vsix` file for publishing
4. Tag the release and push changes

## Troubleshooting

- **Stale builds**: Delete `dist/` and run `npm run compile`
- **Test failures**: Ensure `npm run compile-tests` succeeds before
  `npm test`
- **Watch mode errors**: Check console output - custom problem matcher
  shows file:line:column for esbuild errors
