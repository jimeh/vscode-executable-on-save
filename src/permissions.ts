export type Strategy = "umask" | "read-based" | "all";

/**
 * System umask value, read once at module load.
 * Exported for testing purposes.
 *
 * Note: process.umask() always sets the umask, so we must set to 0 to read
 * the current value, then immediately restore it.
 */
export const SYSTEM_UMASK = (() => {
  const current = process.umask(0);
  process.umask(current);
  return current;
})();

/**
 * Calculates allowed execute bits based on a given umask value.
 * Similar to Emacs executable-make-buffer-file-executable-if-script-p.
 *
 * @param umask - The umask value to use (defaults to system umask)
 * @returns Execute bits allowed by umask (0o000 to 0o111)
 */
export function calculateUmaskExecuteBits(
  umask: number = SYSTEM_UMASK
): number {
  const defaultFileMode = 0o777 & ~umask;
  return defaultFileMode & 0o111;
}

/**
 * Calculates the new file mode by adding execute permissions based on the
 * selected strategy.
 *
 * @param mode - The current file mode (including special bits)
 * @param strategy - The permission strategy to use
 * @param umask - Optional umask value (for testing umask strategy)
 * @returns The new mode with execute bits added, or null if no change needed
 *
 * Umask strategy: Respects system umask when adding execute permissions.
 * Only adds execute bits that would be allowed on new files. For example,
 * with umask 0o022, adds user/group/other execute. With umask 0o077, only
 * adds user execute. Most Unix-correct approach.
 *
 * Read-based strategy: Only adds execute bits where corresponding read bits
 * exist. For example, 0o644 (rw-r--r--) becomes 0o755 (rwxr-xr-x), but 0o200
 * (write-only) returns null since there are no read bits.
 *
 * All strategy: Always adds execute bits (0o111) for user, group, and other.
 * For example, 0o644 becomes 0o755, and 0o600 becomes 0o711.
 *
 * All strategies preserve special permission bits (setuid, setgid, sticky).
 */
export function calculateNewMode(
  mode: number,
  strategy: Strategy = "umask",
  umask?: number
): number | null {
  if (strategy === "umask") {
    const executeBits = calculateUmaskExecuteBits(umask);
    if (executeBits === 0) {
      return null;
    }
    return mode | executeBits;
  }

  if (strategy === "read-based") {
    const readBits = mode & 0o444;
    const executeBits = (readBits >> 2) & 0o111;
    if (executeBits === 0) {
      return null;
    }
    return mode | executeBits;
  }

  return mode | 0o111;
}

/**
 * Checks if a file mode has any execute bits set.
 *
 * @param mode - The file mode to check
 * @returns true if any execute bit is set (user, group, or other)
 */
export function isExecutable(mode: number): boolean {
  return (mode & 0o111) !== 0;
}
