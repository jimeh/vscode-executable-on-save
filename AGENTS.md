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

Node.js 20.x required (matches `@types/node` dependency).

```sh
npm install
```

## Development Commands

```sh
npm run watch            # Continuous rebuild + type checking
npm run compile          # Full build with lint and type checks
npm run lint             # Run prettier + eslint checks
npm run lint:fix         # Format with prettier and auto-fix eslint
npm test                 # Run all tests (includes compile + lint)
npm run compile-tests    # Compile tests to out/ directory
npm run package          # Minified production build
```

## Architecture

### Core Flow

1. [src/extension.ts](src/extension.ts) - Entry point, registers save hook and
   manual command
2. [src/document-handler.ts](src/document-handler.ts) - Main processing logic:
   checks platform, config, shebang, applies chmod
3. [src/permissions.ts](src/permissions.ts) - Permission calculations with two
   strategies
4. [src/config.ts](src/config.ts) - Configuration management
5. [src/notifications.ts](src/notifications.ts) - User feedback

### Permission Strategies

**safe strategy** (default): Only adds execute where read exists by shifting
read bits right 2 positions (e.g., `0o644` → `0o755`, `0o600` → `0o700`).

**standard strategy**: Always adds `0o111` (execute for all) via bitwise OR.

Both preserve special bits (setuid, setgid, sticky).

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
npm run lint:fix
npm test
```

## Configuration Keys

Four settings in [package.json](package.json) under `executableOnSave.*`:

- `enabled` (boolean, default: true)
- `permissionStrategy` (enum: "safe"|"standard", default: "safe")
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
3. **Safe strategy logic**: Shifts read bits right to derive execute bits,
   ensuring symmetry with read permissions
4. **Skip conditions**: Windows platform, untitled documents, non-file URIs
5. **Error handling**: Logs all errors; shows notifications for
   EACCES/ENOENT/unexpected errors unless `silentErrors` enabled

## Troubleshooting

- **Stale builds**: Delete `dist/` and run `npm run compile`
- **Test failures**: Ensure `npm run compile-tests` succeeds first
- **Watch mode errors**: Check console for esbuild problem matcher output
