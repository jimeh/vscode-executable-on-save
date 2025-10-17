<div align="center">

<img width="196px" src="https://github.com/jimeh/vscode-executable-on-save/raw/refs/heads/main/img/logo.png" alt="Logo">

# Executable on Save

**VSCode extension that automatically makes script files executable on save.**

[![VSCode](https://img.shields.io/badge/Marketplace-blue.svg?logoColor=white&logo=data:image/svg%2bxml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTAwIDEwMyIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJtOTkuOTkgOS41NXY4My4zM3MtMjMuOCA5LjUxLTIzLjggOS41MWwtNDEuNjktNDAuNDYtMjUuMDIgMTkuMDUtOS40OC00Ljc1di01MHM5LjUzLTQuNzkgOS41My00Ljc5bDI1LjA0IDE5LjA2IDQxLjYtNDAuNSAyMy44MyA5LjU1em0tMjYuMjYgMjMuODgtMjMuOCAxNy43OSAyMy44MSAxNy45M3YtMzUuNzJ6bS02MS45NCA3LjA3djIxLjRzMTEuOS0xMC43NyAxMS45LTEwLjc3bC0xMS45MS0xMC42M3oiIGZpbGw9IiNmZmYiLz48L3N2Zz4=)][vscode-ext]
[![OpenVSX](https://img.shields.io/badge/OpenVSX-purple.svg?logoColor=white&logo=data:image/svg%2bxml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTMxIDEzMSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSIjZmZmIj48cGF0aCBkPSJtNDIuOCA0My4zNSAyMi42LTM5LjJoLTQ1LjN6bS0yNS40IDQ0LjNoNDUuM2wtMjIuNy0zOS4xem01MSAwIDIyLjYgMzkuMiAyMi42LTM5LjJ6Ii8+PHBhdGggZD0ibTY1LjQgNC4xNS0yMi42IDM5LjJoNDUuMnptLTI1LjQgNDQuNCAyMi43IDM5LjEgMjIuNi0zOS4xem01MSAwLTIyLjYgMzkuMWg0NS4yeiIvPjwvZz48L3N2Zz4=)][openvsx-ext]
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

It is similar in behavior to Emacs'
`executable-make-buffer-file-executable-if-script-p` when set up as an
after-save hook.

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
3. If not executable and has a shebang, applies the appropriate permissions

### Behavior Notes

- Only processes files with `file://` URIs (ignores untitled documents)
- Ignores non-file URI schemes (e.g., `git:`)
- Skips files that are already executable
- Requires the shebang at the very beginning of the file (no leading whitespace)
- Only reads the first two characters out of documents for shebang detection
- Shows a small notice when file permissions are modified, which can be silenced
- Runs after every save with very minimal performance impact

## Configuration

### Enable/Disable

Control whether the extension runs when saving a file:

```json
{
  "executableOnSave.enabled": true
}
```

Default: `true`

### Permission Strategy

Choose how the execute permissions are added:

```json
{
  "executableOnSave.permissionStrategy": "umask"
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

#### Read-based Strategy

Maintains permission symmetry by only adding execute where read exists:

| Before      | After       | Description                             |
| ----------- | ----------- | --------------------------------------- |
| `rw-r--r--` | `rwxr-xr-x` | Standard file permissions               |
| `rw-------` | `rwx------` | Private file stays private              |
| `rw-r-----` | `rwxr-x---` | Group-readable becomes group-executable |

Technical: shifts read bits right by 2 positions to derive execute bits.

#### All Strategy

Always adds execute for all three permission groups:

| Before      | After       | Description                             |
| ----------- | ----------- | --------------------------------------- |
| `rw-r--r--` | `rwxr-xr-x` | Standard file permissions               |
| `rw-------` | `rwx--x--x` | Adds execute for user, group, and other |
| `rw-r-----` | `rwxr-x--x` | Adds execute for user, group, and other |

Technical: performs bitwise OR with `0o111`.

### Silent Mode

Disable information popups when permissions change:

```json
{
  "executableOnSave.silent": false
}
```

Set to `true` to suppress notifications altogether.

## Manual Execution

Run "Make Executable If Script" from the command palette to manually run checks
and mark the current file as executable if needed.

## Platform Support

- **macOS**: Full support
- **Linux**: Full support
- **BSD**: Full support
- **Windows**: Disabled (Windows uses different permission model)

## License

[MIT](https://github.com/jimeh/vscode-executable-on-save/blob/main/LICENSE)
