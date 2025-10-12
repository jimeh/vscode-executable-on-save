import * as assert from "assert";
import { calculateNewMode } from "../permissions";

interface ModeTestCase {
  name: string;
  inputMode: number;
  strategy: "safe" | "standard";
  expectedMode: number | null;
}

suite("permissions", () => {
  suite("calculateNewMode", () => {
    const modeTestCases: ModeTestCase[] = [
      // Safe strategy - standard cases
      {
        name: "safe: 0o644 -> 0o755",
        inputMode: 0o644,
        strategy: "safe",
        expectedMode: 0o755,
      },
      {
        name: "safe: 0o600 -> 0o700",
        inputMode: 0o600,
        strategy: "safe",
        expectedMode: 0o700,
      },
      {
        name: "safe: 0o640 -> 0o750",
        inputMode: 0o640,
        strategy: "safe",
        expectedMode: 0o750,
      },
      {
        name: "safe: 0o604 -> 0o705",
        inputMode: 0o604,
        strategy: "safe",
        expectedMode: 0o705,
      },
      {
        name: "safe: 0o664 -> 0o775",
        inputMode: 0o664,
        strategy: "safe",
        expectedMode: 0o775,
      },
      {
        name: "safe: 0o666 -> 0o777",
        inputMode: 0o666,
        strategy: "safe",
        expectedMode: 0o777,
      },
      {
        name: "safe: 0o444 -> 0o555",
        inputMode: 0o444,
        strategy: "safe",
        expectedMode: 0o555,
      },
      {
        name: "safe: 0o400 -> 0o500",
        inputMode: 0o400,
        strategy: "safe",
        expectedMode: 0o500,
      },
      {
        name: "safe: 0o040 -> 0o050",
        inputMode: 0o040,
        strategy: "safe",
        expectedMode: 0o050,
      },
      {
        name: "safe: 0o004 -> 0o005",
        inputMode: 0o004,
        strategy: "safe",
        expectedMode: 0o005,
      },
      {
        name: "safe: 0o044 -> 0o055 (group read only)",
        inputMode: 0o044,
        strategy: "safe",
        expectedMode: 0o055,
      },
      {
        name: "safe: 0o777 -> 0o777 (maximum permissions, already executable)",
        inputMode: 0o777,
        strategy: "safe",
        expectedMode: 0o777,
      },
      {
        name: "safe: 0o646 -> 0o757 (user+group rw, other r)",
        inputMode: 0o646,
        strategy: "safe",
        expectedMode: 0o757,
      },
      {
        name: "safe: 0o420 -> 0o520 (user read, group write-only)",
        inputMode: 0o420,
        strategy: "safe",
        expectedMode: 0o520,
      },
      {
        name: "safe: 0o204 -> 0o205 (user write-only, other read)",
        inputMode: 0o204,
        strategy: "safe",
        expectedMode: 0o205,
      },
      // Safe strategy - no read permissions (should return null)
      {
        name: "safe: 0o200 -> null (no read bits)",
        inputMode: 0o200,
        strategy: "safe",
        expectedMode: null,
      },
      {
        name: "safe: 0o222 -> null (no read bits)",
        inputMode: 0o222,
        strategy: "safe",
        expectedMode: null,
      },
      {
        name: "safe: 0o000 -> null (no permissions)",
        inputMode: 0o000,
        strategy: "safe",
        expectedMode: null,
      },
      {
        name: "safe: 0o111 -> null (only execute bits)",
        inputMode: 0o111,
        strategy: "safe",
        expectedMode: null,
      },
      {
        name: "safe: 0o333 -> null (write+execute, no read)",
        inputMode: 0o333,
        strategy: "safe",
        expectedMode: null,
      },
      // Safe strategy - already has some execute bits
      {
        name: "safe: 0o755 -> 0o755 (already executable)",
        inputMode: 0o755,
        strategy: "safe",
        expectedMode: 0o755,
      },
      {
        name: "safe: 0o744 -> 0o755 (user exec, add group+other)",
        inputMode: 0o744,
        strategy: "safe",
        expectedMode: 0o755,
      },
      {
        name: "safe: 0o100 -> 0o100 (user exec only, no read)",
        inputMode: 0o100,
        strategy: "safe",
        expectedMode: null,
      },
      {
        name: "safe: 0o500 -> 0o500 (user read+exec, no change)",
        inputMode: 0o500,
        strategy: "safe",
        expectedMode: 0o500,
      },
      {
        name: "safe: 0o654 -> 0o755 (has user exec, adds group+other)",
        inputMode: 0o654,
        strategy: "safe",
        expectedMode: 0o755,
      },
      {
        name: "safe: 0o641 -> 0o751 (has other exec, preserves it)",
        inputMode: 0o641,
        strategy: "safe",
        expectedMode: 0o751,
      },
      // Safe strategy - special bits (setuid/setgid/sticky)
      {
        name: "safe: 0o4644 -> 0o4755 (preserves setuid)",
        inputMode: 0o4644,
        strategy: "safe",
        expectedMode: 0o4755,
      },
      {
        name: "safe: 0o2644 -> 0o2755 (preserves setgid)",
        inputMode: 0o2644,
        strategy: "safe",
        expectedMode: 0o2755,
      },
      {
        name: "safe: 0o1644 -> 0o1755 (preserves sticky bit)",
        inputMode: 0o1644,
        strategy: "safe",
        expectedMode: 0o1755,
      },
      {
        name: "safe: 0o6644 -> 0o6755 (preserves setuid+setgid)",
        inputMode: 0o6644,
        strategy: "safe",
        expectedMode: 0o6755,
      },
      {
        name: "safe: 0o7644 -> 0o7755 (preserves all special bits)",
        inputMode: 0o7644,
        strategy: "safe",
        expectedMode: 0o7755,
      },
      // Standard strategy - always adds 0o111
      {
        name: "standard: 0o644 -> 0o755",
        inputMode: 0o644,
        strategy: "standard",
        expectedMode: 0o755,
      },
      {
        name: "standard: 0o600 -> 0o711",
        inputMode: 0o600,
        strategy: "standard",
        expectedMode: 0o711,
      },
      {
        name: "standard: 0o000 -> 0o111",
        inputMode: 0o000,
        strategy: "standard",
        expectedMode: 0o111,
      },
      {
        name: "standard: 0o200 -> 0o311 (adds exec to write-only)",
        inputMode: 0o200,
        strategy: "standard",
        expectedMode: 0o311,
      },
      {
        name: "standard: 0o755 -> 0o755 (already executable)",
        inputMode: 0o755,
        strategy: "standard",
        expectedMode: 0o755,
      },
      {
        name: "standard: 0o100 -> 0o111 (adds group+other exec)",
        inputMode: 0o100,
        strategy: "standard",
        expectedMode: 0o111,
      },
      // Standard strategy - special bits
      {
        name: "standard: 0o4644 -> 0o4755 (preserves setuid)",
        inputMode: 0o4644,
        strategy: "standard",
        expectedMode: 0o4755,
      },
      {
        name: "standard: 0o2644 -> 0o2755 (preserves setgid)",
        inputMode: 0o2644,
        strategy: "standard",
        expectedMode: 0o2755,
      },
      {
        name: "standard: 0o1644 -> 0o1755 (preserves sticky)",
        inputMode: 0o1644,
        strategy: "standard",
        expectedMode: 0o1755,
      },
      {
        name: "standard: 0o6644 -> 0o6755 (preserves setuid+setgid)",
        inputMode: 0o6644,
        strategy: "standard",
        expectedMode: 0o6755,
      },
      {
        name: "standard: 0o7644 -> 0o7755 (preserves all special bits)",
        inputMode: 0o7644,
        strategy: "standard",
        expectedMode: 0o7755,
      },
    ];

    modeTestCases.forEach((testCase) => {
      test(testCase.name, () => {
        const result = calculateNewMode(testCase.inputMode, testCase.strategy);
        assert.strictEqual(
          result,
          testCase.expectedMode,
          `Expected ${testCase.inputMode.toString(8)} -> ${testCase.expectedMode === null ? "null" : testCase.expectedMode.toString(8)}, got ${result === null ? "null" : result.toString(8)}`
        );
      });
    });
  });
});
