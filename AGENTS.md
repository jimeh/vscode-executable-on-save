# Agent Guide: mark-executable-on-save Extension

This repository contains a VS Code extension implemented in TypeScript and bundled with esbuild. The notes below explain the build, watch, and test flows so another agent can ship updates confidently.

## Prerequisites
- Node.js 22.x (matches the `@types/node` dependency)
- npm (bundled with Node)
- VS Code Extension Test CLI (`@vscode/test-cli`) installs automatically via `npm install`

Install dependencies once after cloning:

```sh
npm install
```

## Source Layout
- `src/extension.ts`: Extension entry point; compiled to `dist/extension.js`.
- `esbuild.js`: Custom bundler script that wraps esbuild and handles watch mode, sourcemaps, and minification.
- `dist/`: Output bundle consumed by VS Code (`main` in `package.json`).
- `out/`: TypeScript compiler output for tests (ignored in runtime bundle).

## Building
- One-off build with lint and type checks:
  ```sh
  npm run compile
  ```
  This executes `tsc --noEmit`, `eslint`, then runs `node esbuild.js` to emit `dist/extension.js`.
- Production build (minified, used for packaging):
  ```sh
  npm run package
  ```
  Passes the same checks and calls `node esbuild.js --production` to rebuild with minification and without sourcemaps.

## Development Workflow
- Continuous type checking and linting:
  ```sh
  npm run watch
  ```
  Runs both `node esbuild.js --watch` (rebundles to `dist/extension.js`) and `tsc --noEmit --watch`.
- Quick rebuild only:
  ```sh
  node esbuild.js
  ```
  Append `--watch` for incremental rebuilds or `--production` for release-ready output.

## Testing
- Compile test sources:
  ```sh
  npm run compile-tests
  ```
  Emits compiled test files into `out/` via `tsc`.
- Run the VS Code integration tests (build + lint happen automatically via `pretest`):
  ```sh
  npm test
  ```
  Uses `@vscode/test-electron` through `vscode-test`.

## Release Checklist
1. Ensure `npm run package` succeeds; verify `dist/extension.js` is current.
2. Update `CHANGELOG.md` and version in `package.json` as needed.
3. Use `vsce package` (not included here) if publishing to the Marketplace.
4. Tag the release and push changes.

## Troubleshooting
- Delete `dist/` and rerun `npm run compile` if stale bundles cause issues.
- Make sure `node_modules/.bin` is on `PATH` when invoking scripts manually.
- When esbuild fails in watch mode, check console output; the custom problem matcher prints file, line, and column for each error.
