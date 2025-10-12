<div align="center">

<img width="196px" src="https://github.com/jimeh/vscode-executable-on-save/raw/refs/heads/main/img/logo.png" alt="Logo">

# Executable on Save

**VSCode extension to automatically mark script files as executable on save.**

[![Latest Release](https://img.shields.io/github/release/jimeh/vscode-executable-on-save.svg)](https://github.com/jimeh/vscode-executable-on-save/releases)
[![GitHub Issues](https://img.shields.io/github/issues/jimeh/vscode-executable-on-save.svg)](https://github.com/jimeh/vscode-executable-on-save/issues)
[![GitHub Pull Requests](https://img.shields.io/github/issues-pr/jimeh/vscode-executable-on-save.svg)](https://github.com/jimeh/vscode-executable-on-save/pulls)
[![License](https://img.shields.io/github/license/jimeh/vscode-executable-on-save.svg)](https://github.com/jimeh/vscode-executable-on-save/blob/main/LICENSE)

</div>

## What It Does

When you save a file that starts with `#!` (a shebang), this extension
automatically makes it executable (similar to `chmod +x`). No more manually
making your shell scripts, Python scripts, or other executable files runnable.

## Installation

Install from the VS Code marketplace or via the command line:

```bash
code --install-extension jimeh.executable-on-save
```

## How It Works

The extension watches for file saves. When a file is saved:

1. Checks if the first two characters are `#!`
2. Checks if the file is already executable
3. If not executable, applies the appropriate permissions

## Configuration

### Enable/Disable

Control whether the extension runs when saving a file:

```json
{
  "markExecutableOnSave.enabled": true
}
```

Default: `true`

### Permission Strategy

Choose how the execute permissions are added:

```json
{
  "markExecutableOnSave.permissionStrategy": "safe"
}
```

Options:

- `"safe"` (default): Adds execute only where read permission exists
- `"standard"`: Adds execute for user, group, and other unconditionally

#### Safe Strategy

Maintains permission symmetry by only adding execute where read exists:

| Before      | After       | Description                             |
| ----------- | ----------- | --------------------------------------- |
| `rw-r--r--` | `rwxr-xr-x` | Standard file permissions               |
| `rw-------` | `rwx------` | Private file stays private              |
| `rw-r-----` | `rwxr-x---` | Group-readable becomes group-executable |

Technical: shifts read bits right by 2 positions to derive execute bits.

#### Standard Strategy

Always adds execute for all three permission groups:

| Before      | After       | Description                |
| ----------- | ----------- | -------------------------- |
| `rw-r--r--` | `rwxr-xr-x` | Standard file permissions  |
| `rw-------` | `rwx--x--x` | Others gain execute access |
| `rw-r-----` | `rwxr-x--x` | Others gain execute access |

Technical: performs bitwise OR with `0o111`.

### Silent Mode

Disable information popups when permissions change:

```json
{
  "markExecutableOnSave.silent": false
}
```

Set to `true` to suppress notifications altogether.

## Manual Command

Mark the current file as executable via Command Palette:

### Make Executable If Script

Checks for shebang and applies permissions manually, respecting the configured
strategy.

## Platform Support

- **macOS**: Full support
- **Linux**: Full support
- **BSD**: Full support
- **Windows**: Disabled (Windows uses different permission model)

## Behavior Notes

- Only processes files with `file://` URIs (ignores untitled documents)
- Shows a small notice when file permissions are modified
- Skips files that are already executable
- Runs after every save, minimal performance impact

## License

[MIT](https://github.com/jimeh/vscode-executable-on-save/blob/main/LICENSE)
