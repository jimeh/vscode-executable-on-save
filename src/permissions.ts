export type Strategy = "safe" | "standard";

/**
 * Calculates the new file mode by adding execute permissions based on the
 * selected strategy.
 *
 * @param mode - The current file mode (including special bits)
 * @param strategy - The permission strategy to use
 * @returns The new mode with execute bits added, or null if no change needed
 *
 * Safe strategy: Only adds execute bits where corresponding read bits exist.
 * For example, 0o644 (rw-r--r--) becomes 0o755 (rwxr-xr-x), but 0o200
 * (write-only) returns null since there are no read bits.
 *
 * Standard strategy: Always adds execute bits (0o111) for user, group, and
 * other. For example, 0o644 becomes 0o755, and 0o600 becomes 0o711.
 *
 * Both strategies preserve special permission bits (setuid, setgid, sticky).
 */
export function calculateNewMode(
  mode: number,
  strategy: Strategy
): number | null {
  if (strategy === "safe") {
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
