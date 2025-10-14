<div align="center">

<img width="196px" src="https://github.com/jimeh/vscode-executable-on-save/raw/refs/heads/main/img/logo.png" alt="Logo">

# Executable on Save

**VSCode extension that automatically makes script files executable on save.**

[![VSCode](https://img.shields.io/badge/Marketplace-blue.svg?logoColor=white&logo=data:image/svg%2bxml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz48c3ZnIGlkPSJhIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAzIj48ZGVmcz48c3R5bGU+LmJ7ZmlsbDojZmZmO308L3N0eWxlPjwvZGVmcz48cGF0aCBjbGFzcz0iYiIgZD0iTTk5Ljk5LDkuNTV2ODMuMzNzLTIzLjgsOS41MS0yMy44LDkuNTFsLTQxLjY5LTQwLjQ2LTI1LjAyLDE5LjA1LTkuNDgtNC43NVYyNi4yM3M5LjUzLTQuNzksOS41My00Ljc5bDI1LjA0LDE5LjA2TDc2LjE3LDBsMjMuODMsOS41NWgwWk03My43MywzMy40M2wtMjMuOCwxNy43OSwyMy44MSwxNy45M3YtMzUuNzJaTTExLjc5LDQwLjV2MjEuNHMxMS45LTEwLjc3LDExLjktMTAuNzdsLTExLjkxLTEwLjYzaDBaIi8+PC9zdmc+)][vscode-ext]
[![OpenVSX](https://img.shields.io/badge/OpenVSX-purple.svg?logoColor=white&logo=data:image/svg%2bxml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz48c3ZnIGlkPSJhIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMzEgMTMxIj48ZGVmcz48c3R5bGU+LmJ7ZmlsbDojZmZmO308L3N0eWxlPjwvZGVmcz48cGF0aCBjbGFzcz0iYiIgZD0iTTQyLjgsNDMuMzVMNjUuNCw0LjE1SDIwLjFsMjIuNywzOS4yWk0xNy40LDg3LjY1aDQ1LjNsLTIyLjctMzkuMS0yMi42LDM5LjFaTTY4LjQsODcuNjVsMjIuNiwzOS4yLDIyLjYtMzkuMmgtNDUuMloiLz48cGF0aCBjbGFzcz0iYiIgZD0iTTY1LjQsNC4xNWwtMjIuNiwzOS4yaDQ1LjJMNjUuNCw0LjE1Wk00MCw0OC41NWwyMi43LDM5LjEsMjIuNi0zOS4xaC00NS4zWk05MSw0OC41NWwtMjIuNiwzOS4xaDQ1LjJsLTIyLjYtMzkuMVoiLz48L3N2Zz4=)][openvsx-ext]
[![Latest Release](https://img.shields.io/github/release/jimeh/vscode-executable-on-save.svg)](https://github.com/jimeh/vscode-executable-on-save/releases)
[![GitHub Issues](https://img.shields.io/github/issues/jimeh/vscode-executable-on-save.svg)](https://github.com/jimeh/vscode-executable-on-save/issues)
[![GitHub Pull Requests](https://img.shields.io/github/issues-pr/jimeh/vscode-executable-on-save.svg)](https://github.com/jimeh/vscode-executable-on-save/pulls)
[![License](https://img.shields.io/github/license/jimeh/vscode-executable-on-save.svg)](https://github.com/jimeh/vscode-executable-on-save/blob/main/LICENSE)

</div>

[vscode-ext]: https://marketplace.visualstudio.com/items?itemName=jimeh.executable-on-save
[openvsx-ext]: https://open-vsx.org/extension/jimeh/executable-on-save

## What It Does

When you save a file that starts with `#!` (a shebang), this extension
automatically makes it executable (similar to `chmod +x`). No more manually
making your shell scripts, Python scripts, or other executable files runnable.

## Installation

Install from the [VSCode Marketplace][vscode-ext], [OpenVSX][openvsx-ext], or
via the command line:

```bash
code --install-extension jimeh.executable-on-save
```

## How It Works

The extension watches for file saves. When a file is saved:

1. Checks if the first two characters are `#!`
2. Checks if the file is already executable
3. If not executable, applies the appropriate permissions

### Behavior Notes

- Only processes files with `file://` URIs (ignores untitled documents)
- Shows a small notice when file permissions are modified
- Skips files that are already executable
- Runs after every save, minimal performance impact

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
  "markExecutableOnSave.permissionStrategy": "umask"
}
```

Options:

- `"umask"` (default): Respects system umask when adding execute
- `"read-based"`: Adds execute only where read permission exists
- `"all"`: Adds execute for user, group, and other unconditionally

#### Umask Strategy (Recommended)

Respects your system's umask setting, following Unix conventions. Only adds
execute permissions that would be allowed on newly created files.

**With umask 0o022 (typical):**

| Before      | After       | Description     |
| ----------- | ----------- | --------------- |
| `rw-r--r--` | `rwxr-xr-x` | All get execute |
| `rw-------` | `rwx--x--x` | All get execute |
| `rw-rw-r--` | `rwxrwxr-x` | All get execute |

**With umask 0o077 (restrictive):**

| Before      | After       | Description            |
| ----------- | ----------- | ---------------------- |
| `rw-r--r--` | `rwxr--r--` | Only user gets execute |
| `rw-------` | `rwx------` | Only user gets execute |
| `rw-rw-r--` | `rwxrw-r--` | Only user gets execute |

Technical: Calculates default file permissions (`0o777 & ~umask`), extracts
execute bits, and applies them via bitwise OR.

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

### "Make Executable If Script"

Checks for shebang and applies permissions manually, respecting the configured
strategy.

## Platform Support

- **macOS**: Full support
- **Linux**: Full support
- **BSD**: Full support
- **Windows**: Disabled (Windows uses different permission model)

## License

[MIT](https://github.com/jimeh/vscode-executable-on-save/blob/main/LICENSE)
