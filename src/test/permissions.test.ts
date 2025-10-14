import * as assert from "assert";
import {
  calculateNewMode,
  calculateUmaskExecuteBits,
  SYSTEM_UMASK,
} from "../permissions";

interface ModeTestCase {
  name: string;
  inputMode: number;
  strategy: "umask" | "read-based" | "all";
  expectedMode: number | null;
  umask?: number;
}

suite("permissions", () => {
  suite("calculateUmaskExecuteBits", () => {
    test("umask 0o022 (typical) -> 0o111", () => {
      assert.strictEqual(calculateUmaskExecuteBits(0o022), 0o111);
    });

    test("umask 0o077 (restrictive) -> 0o100", () => {
      assert.strictEqual(calculateUmaskExecuteBits(0o077), 0o100);
    });

    test("umask 0o002 (permissive) -> 0o111", () => {
      assert.strictEqual(calculateUmaskExecuteBits(0o002), 0o111);
    });

    test("umask 0o177 (extreme restrictive) -> 0o000", () => {
      assert.strictEqual(calculateUmaskExecuteBits(0o177), 0o000);
    });

    test("umask 0o027 (other restricted) -> 0o110", () => {
      assert.strictEqual(calculateUmaskExecuteBits(0o027), 0o110);
    });

    test("umask 0o000 (no restrictions) -> 0o111", () => {
      assert.strictEqual(calculateUmaskExecuteBits(0o000), 0o111);
    });

    test("system umask is valid", () => {
      assert.ok(SYSTEM_UMASK >= 0 && SYSTEM_UMASK <= 0o777);
    });
  });

  suite("calculateNewMode", () => {
    const modeTestCases: ModeTestCase[] = [
      // Umask strategy - typical umask 0o022
      {
        name: "umask: 0o644 -> 0o755 (umask 0o022)",
        inputMode: 0o644,
        strategy: "umask",
        umask: 0o022,
        expectedMode: 0o755,
      },
      {
        name: "umask: 0o600 -> 0o711 (umask 0o022)",
        inputMode: 0o600,
        strategy: "umask",
        umask: 0o022,
        expectedMode: 0o711,
      },
      {
        name: "umask: 0o664 -> 0o775 (umask 0o022)",
        inputMode: 0o664,
        strategy: "umask",
        umask: 0o022,
        expectedMode: 0o775,
      },
      // Umask strategy - restrictive umask 0o077
      {
        name: "umask: 0o644 -> 0o744 (umask 0o077)",
        inputMode: 0o644,
        strategy: "umask",
        umask: 0o077,
        expectedMode: 0o744,
      },
      {
        name: "umask: 0o600 -> 0o700 (umask 0o077)",
        inputMode: 0o600,
        strategy: "umask",
        umask: 0o077,
        expectedMode: 0o700,
      },
      {
        name: "umask: 0o640 -> 0o740 (umask 0o077)",
        inputMode: 0o640,
        strategy: "umask",
        umask: 0o077,
        expectedMode: 0o740,
      },
      {
        name: "umask: 0o664 -> 0o764 (umask 0o077)",
        inputMode: 0o664,
        strategy: "umask",
        umask: 0o077,
        expectedMode: 0o764,
      },
      // Umask strategy - permissive umask 0o002
      {
        name: "umask: 0o644 -> 0o755 (umask 0o002)",
        inputMode: 0o644,
        strategy: "umask",
        umask: 0o002,
        expectedMode: 0o755,
      },
      {
        name: "umask: 0o664 -> 0o775 (umask 0o002)",
        inputMode: 0o664,
        strategy: "umask",
        umask: 0o002,
        expectedMode: 0o775,
      },
      // Umask strategy - extreme restrictive umask 0o177
      {
        name: "umask: 0o644 -> null (umask 0o177)",
        inputMode: 0o644,
        strategy: "umask",
        umask: 0o177,
        expectedMode: null,
      },
      {
        name: "umask: 0o600 -> null (umask 0o177)",
        inputMode: 0o600,
        strategy: "umask",
        umask: 0o177,
        expectedMode: null,
      },
      // Umask strategy - other restricted umask 0o027
      {
        name: "umask: 0o644 -> 0o754 (umask 0o027)",
        inputMode: 0o644,
        strategy: "umask",
        umask: 0o027,
        expectedMode: 0o754,
      },
      {
        name: "umask: 0o640 -> 0o750 (umask 0o027)",
        inputMode: 0o640,
        strategy: "umask",
        umask: 0o027,
        expectedMode: 0o750,
      },
      // Umask strategy - special bits preservation
      {
        name: "umask: 0o4644 -> 0o4755 (umask 0o022, setuid)",
        inputMode: 0o4644,
        strategy: "umask",
        umask: 0o022,
        expectedMode: 0o4755,
      },
      {
        name: "umask: 0o2644 -> 0o2755 (umask 0o022, setgid)",
        inputMode: 0o2644,
        strategy: "umask",
        umask: 0o022,
        expectedMode: 0o2755,
      },
      {
        name: "umask: 0o1644 -> 0o1755 (umask 0o022, sticky)",
        inputMode: 0o1644,
        strategy: "umask",
        umask: 0o022,
        expectedMode: 0o1755,
      },
      {
        name: "umask: 0o7644 -> 0o7755 (umask 0o022, all special)",
        inputMode: 0o7644,
        strategy: "umask",
        umask: 0o022,
        expectedMode: 0o7755,
      },
      {
        name: "umask: 0o4644 -> 0o4744 (umask 0o077, setuid)",
        inputMode: 0o4644,
        strategy: "umask",
        umask: 0o077,
        expectedMode: 0o4744,
      },
      // Umask strategy - already executable
      {
        name: "umask: 0o755 -> 0o755 (umask 0o022, already exec)",
        inputMode: 0o755,
        strategy: "umask",
        umask: 0o022,
        expectedMode: 0o755,
      },
      {
        name: "umask: 0o744 -> 0o755 (umask 0o022, partial exec)",
        inputMode: 0o744,
        strategy: "umask",
        umask: 0o022,
        expectedMode: 0o755,
      },
      {
        name: "umask: 0o700 -> 0o700 (umask 0o077, already exec)",
        inputMode: 0o700,
        strategy: "umask",
        umask: 0o077,
        expectedMode: 0o700,
      },
      // Read-based strategy - standard cases
      {
        name: "read-based: 0o644 -> 0o755",
        inputMode: 0o644,
        strategy: "read-based",
        expectedMode: 0o755,
      },
      {
        name: "read-based: 0o600 -> 0o700",
        inputMode: 0o600,
        strategy: "read-based",
        expectedMode: 0o700,
      },
      {
        name: "read-based: 0o640 -> 0o750",
        inputMode: 0o640,
        strategy: "read-based",
        expectedMode: 0o750,
      },
      {
        name: "read-based: 0o604 -> 0o705",
        inputMode: 0o604,
        strategy: "read-based",
        expectedMode: 0o705,
      },
      {
        name: "read-based: 0o664 -> 0o775",
        inputMode: 0o664,
        strategy: "read-based",
        expectedMode: 0o775,
      },
      {
        name: "read-based: 0o666 -> 0o777",
        inputMode: 0o666,
        strategy: "read-based",
        expectedMode: 0o777,
      },
      {
        name: "read-based: 0o444 -> 0o555",
        inputMode: 0o444,
        strategy: "read-based",
        expectedMode: 0o555,
      },
      {
        name: "read-based: 0o400 -> 0o500",
        inputMode: 0o400,
        strategy: "read-based",
        expectedMode: 0o500,
      },
      {
        name: "read-based: 0o040 -> 0o050",
        inputMode: 0o040,
        strategy: "read-based",
        expectedMode: 0o050,
      },
      {
        name: "read-based: 0o004 -> 0o005",
        inputMode: 0o004,
        strategy: "read-based",
        expectedMode: 0o005,
      },
      {
        name: "read-based: 0o044 -> 0o055 (group read only)",
        inputMode: 0o044,
        strategy: "read-based",
        expectedMode: 0o055,
      },
      {
        name: "read-based: 0o777 -> 0o777 (maximum permissions, already executable)",
        inputMode: 0o777,
        strategy: "read-based",
        expectedMode: 0o777,
      },
      {
        name: "read-based: 0o646 -> 0o757 (user+group rw, other r)",
        inputMode: 0o646,
        strategy: "read-based",
        expectedMode: 0o757,
      },
      {
        name: "read-based: 0o420 -> 0o520 (user read, group write-only)",
        inputMode: 0o420,
        strategy: "read-based",
        expectedMode: 0o520,
      },
      {
        name: "read-based: 0o204 -> 0o205 (user write-only, other read)",
        inputMode: 0o204,
        strategy: "read-based",
        expectedMode: 0o205,
      },
      // Read-based strategy - no read permissions (should return null)
      {
        name: "read-based: 0o200 -> null (no read bits)",
        inputMode: 0o200,
        strategy: "read-based",
        expectedMode: null,
      },
      {
        name: "read-based: 0o222 -> null (no read bits)",
        inputMode: 0o222,
        strategy: "read-based",
        expectedMode: null,
      },
      {
        name: "read-based: 0o000 -> null (no permissions)",
        inputMode: 0o000,
        strategy: "read-based",
        expectedMode: null,
      },
      {
        name: "read-based: 0o111 -> null (only execute bits)",
        inputMode: 0o111,
        strategy: "read-based",
        expectedMode: null,
      },
      {
        name: "read-based: 0o333 -> null (write+execute, no read)",
        inputMode: 0o333,
        strategy: "read-based",
        expectedMode: null,
      },
      // Read-based strategy - already has some execute bits
      {
        name: "read-based: 0o755 -> 0o755 (already executable)",
        inputMode: 0o755,
        strategy: "read-based",
        expectedMode: 0o755,
      },
      {
        name: "read-based: 0o744 -> 0o755 (user exec, add group+other)",
        inputMode: 0o744,
        strategy: "read-based",
        expectedMode: 0o755,
      },
      {
        name: "read-based: 0o100 -> 0o100 (user exec only, no read)",
        inputMode: 0o100,
        strategy: "read-based",
        expectedMode: null,
      },
      {
        name: "read-based: 0o500 -> 0o500 (user read+exec, no change)",
        inputMode: 0o500,
        strategy: "read-based",
        expectedMode: 0o500,
      },
      {
        name: "read-based: 0o654 -> 0o755 (has user exec, adds group+other)",
        inputMode: 0o654,
        strategy: "read-based",
        expectedMode: 0o755,
      },
      {
        name: "read-based: 0o641 -> 0o751 (has other exec, preserves it)",
        inputMode: 0o641,
        strategy: "read-based",
        expectedMode: 0o751,
      },
      // Read-based strategy - special bits (setuid/setgid/sticky)
      {
        name: "read-based: 0o4644 -> 0o4755 (preserves setuid)",
        inputMode: 0o4644,
        strategy: "read-based",
        expectedMode: 0o4755,
      },
      {
        name: "read-based: 0o2644 -> 0o2755 (preserves setgid)",
        inputMode: 0o2644,
        strategy: "read-based",
        expectedMode: 0o2755,
      },
      {
        name: "read-based: 0o1644 -> 0o1755 (preserves sticky bit)",
        inputMode: 0o1644,
        strategy: "read-based",
        expectedMode: 0o1755,
      },
      {
        name: "read-based: 0o6644 -> 0o6755 (preserves setuid+setgid)",
        inputMode: 0o6644,
        strategy: "read-based",
        expectedMode: 0o6755,
      },
      {
        name: "read-based: 0o7644 -> 0o7755 (preserves all special bits)",
        inputMode: 0o7644,
        strategy: "read-based",
        expectedMode: 0o7755,
      },
      // All strategy - always adds 0o111
      {
        name: "all: 0o644 -> 0o755",
        inputMode: 0o644,
        strategy: "all",
        expectedMode: 0o755,
      },
      {
        name: "all: 0o600 -> 0o711",
        inputMode: 0o600,
        strategy: "all",
        expectedMode: 0o711,
      },
      {
        name: "all: 0o000 -> 0o111",
        inputMode: 0o000,
        strategy: "all",
        expectedMode: 0o111,
      },
      {
        name: "all: 0o200 -> 0o311 (adds exec to write-only)",
        inputMode: 0o200,
        strategy: "all",
        expectedMode: 0o311,
      },
      {
        name: "all: 0o755 -> 0o755 (already executable)",
        inputMode: 0o755,
        strategy: "all",
        expectedMode: 0o755,
      },
      {
        name: "all: 0o100 -> 0o111 (adds group+other exec)",
        inputMode: 0o100,
        strategy: "all",
        expectedMode: 0o111,
      },
      // All strategy - special bits
      {
        name: "all: 0o4644 -> 0o4755 (preserves setuid)",
        inputMode: 0o4644,
        strategy: "all",
        expectedMode: 0o4755,
      },
      {
        name: "all: 0o2644 -> 0o2755 (preserves setgid)",
        inputMode: 0o2644,
        strategy: "all",
        expectedMode: 0o2755,
      },
      {
        name: "all: 0o1644 -> 0o1755 (preserves sticky)",
        inputMode: 0o1644,
        strategy: "all",
        expectedMode: 0o1755,
      },
      {
        name: "all: 0o6644 -> 0o6755 (preserves setuid+setgid)",
        inputMode: 0o6644,
        strategy: "all",
        expectedMode: 0o6755,
      },
      {
        name: "all: 0o7644 -> 0o7755 (preserves all special bits)",
        inputMode: 0o7644,
        strategy: "all",
        expectedMode: 0o7755,
      },
    ];

    modeTestCases.forEach((testCase) => {
      test(testCase.name, () => {
        const result = calculateNewMode(
          testCase.inputMode,
          testCase.strategy,
          testCase.umask
        );
        assert.strictEqual(
          result,
          testCase.expectedMode,
          `Expected ${testCase.inputMode.toString(8)} -> ${testCase.expectedMode === null ? "null" : testCase.expectedMode.toString(8)}, got ${result === null ? "null" : result.toString(8)}`
        );
      });
    });
  });
});
