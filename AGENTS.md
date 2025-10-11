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

The extension follows a modular architecture with clear separation of
concerns:

### Extension Entry Point

[src/extension.ts](src/extension.ts) (~30 lines) - Minimal VS Code
lifecycle hooks:

- `activate()`: Registers save hook and manual command
- `deactivate()`: Extension cleanup (empty)
- Delegates all processing to `document-handler` module

### Document Processing

[src/document-handler.ts](src/document-handler.ts) (~100 lines) - Main
processing logic:

- `processDocument()`: Entry point called on save or via command
- `handleDocument()`: Core flow - checks platform, config, shebang, applies
  chmod
- `shouldSkipDocument()`: Platform/document validation (Windows, untitled,
  non-file URIs)
- `readShebang()`: Reads first 2 characters for shebang detection
- `startsWithShebang()`: Validates `#!` prefix

### Configuration

[src/config.ts](src/config.ts) (~35 lines) - Configuration management:

- `Config` interface: Type-safe configuration structure
- `readConfiguration()`: Reads workspace configuration with defaults

### Permissions

[src/permissions.ts](src/permissions.ts) (~45 lines) - Permission
calculations:

- `calculateNewMode()`: Core permission logic
  - **safe strategy**: Only adds execute where read bits exist (e.g.,
    `0o644` → `0o755`, `0o600` → `0o700`)
  - **standard strategy**: Always adds `0o111` (execute for all)
  - Preserves special bits (setuid, setgid, sticky)
- `isExecutable()`: Checks if mode has execute bits

### Notifications

[src/notifications.ts](src/notifications.ts) (~110 lines) - User feedback:

- `announceModeChange()`: Shows info notification with mode change
- `reportError()`: Handles errors with specific messages (EACCES, ENOENT,
  etc.)
- `showErrorMessage()`: Displays errors respecting silent config
- Path formatting helpers for user-friendly messages

### Build System

[esbuild.js](esbuild.js) bundles all `src/` modules → `dist/extension.js`:

- Entry point: `src/extension.ts`
- Bundles all modules together (extension, document-handler, config,
  permissions, notifications)
- Uses CommonJS format (`format: 'cjs'`)
- Externalizes `vscode` module
- Production mode: minified, no sourcemaps
- Watch mode: includes custom problem matcher for VS Code integration

### Development Cycle

After making changes, always format and auto-correct linting complaints followed
by running tests. Refer to the development commands section above for how to run
those operations.

### Extension Settings

Four settings in [package.json](package.json):

- `markExecutableOnSave.enabled` (boolean, default: true)
- `markExecutableOnSave.permissionStrategy` (enum: "safe"|"standard",
  default: "safe")
- `markExecutableOnSave.silent` (boolean, default: false) - suppresses
  information notifications when permissions change
- `markExecutableOnSave.silentErrors` (boolean, default: false) -
  suppresses error notifications when permission updates fail

### Test Suite

Tests are organized by module with clear separation between unit and
integration tests:

**[src/test/extension.test.ts](src/test/extension.test.ts)** (24
integration tests):

- End-to-end tests using real files and VS Code APIs
- Stubs `vscode.workspace.getConfiguration()` to control behavior
- Creates temp files with specific modes, saves documents, verifies results
- Covers: core flow, shebang edge cases, manual command, platform guards

**[src/test/permissions.test.ts](src/test/permissions.test.ts)** (32 unit
tests):

- Pure unit tests for `calculateNewMode()` function
- No VS Code dependencies
- Tests all strategies, special bits, edge cases (write-only, etc.)
- Fast, isolated tests

**[src/test/notifications.test.ts](src/test/notifications.test.ts)** (13
unit tests):

- Unit tests for notification functions
- Tests `showErrorMessage()`, `reportError()`, `announceModeChange()`
- Stubs VS Code window APIs
- Verifies error handling and message formatting

All tests run in VS Code's Electron environment via
`@vscode/test-electron`. Total: **67 tests**.

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
