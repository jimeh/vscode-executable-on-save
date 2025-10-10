<div align="center>

# Mark Executable on Save

_Marking scripts executable should not require a terminal._

</div>

Automatically marks files with shebangs as executable when saved in VS Code.

## What It Does

When you save a file that starts with `#!` (a shebang), this extension
automatically runs `chmod +x` on it. No more manually making your shell
scripts, Python scripts, or other executable files runnable.

## Installation

Install from the VS Code marketplace or via the command line:

```bash
code --install-extension mark-executable-on-save
```

## How It Works

The extension watches for file saves. When a file is saved:

1. Checks if the first two characters are `#!`
2. Checks if the file is already executable
3. If not executable, applies the appropriate permissions

Works with any scripting language:

```bash
#!/bin/bash
echo "Automatically executable!"
```

```python
#!/usr/bin/env python3
print("Automatically executable!")
```

```ruby
#!/usr/bin/env ruby
puts "Automatically executable!"
```

## Configuration

### Enable/Disable

Control whether the extension operates:

```json
{
  "markExecutableOnSave.enableShebangMarking": true
}
```

Default: `true`

### Permission Strategy

Choose how execute permissions are added:

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

**Mark Executable If Script**

Checks for shebang and applies permissions manually, respecting the
configured strategy.

## Platform Support

- **macOS**: Full support
- **Linux**: Full support
- **BSD**: Full support
- **Windows**: Disabled (Windows uses different permission model)

## Behavior Notes

- Only processes files with `file://` URIs (ignores untitled documents)
- Logs permission errors to Developer Console but doesn't show popups
- Skips files that are already executable
- Runs after every save, minimal performance impact

## Troubleshooting

### File not becoming executable

1. Check Developer Console (`Help > Toggle Developer Tools`)
2. Look for permission errors or configuration issues
3. Verify the file starts with exactly `#!`
4. Ensure the file is saved to disk (not an untitled document)

### Permission denied errors

The extension needs write access to modify file permissions. Errors are
logged but won't interrupt your workflow.

## Privacy

This extension:

- Only reads the first two characters of saved files
- Only modifies file permissions, never file content
- Does not send any data anywhere
- Operates entirely locally

## Development

See [AGENTS.md](AGENTS.md) for development documentation.

## License

[Insert license here]

## Changelog

### 0.0.1 (Initial Release)

- Automatic chmod +x on save for files with shebangs
- Safe and standard permission strategies
- Manual command support
- Platform detection
