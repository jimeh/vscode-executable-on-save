import * as assert from "assert";
import * as vscode from "vscode";
import { onSaveEnabled, readConfiguration } from "../config";

suite("config", () => {
  suite("readConfiguration", () => {
    let originalGetConfiguration: typeof vscode.workspace.getConfiguration;

    setup(() => {
      originalGetConfiguration = vscode.workspace.getConfiguration;
    });

    teardown(() => {
      vscode.workspace.getConfiguration = originalGetConfiguration;
    });

    test("returns default values when no config is set", () => {
      vscode.workspace.getConfiguration = (() => {
        return {
          get: <T>(_key: string, defaultValue?: T): T => {
            return defaultValue as T;
          },
        } as vscode.WorkspaceConfiguration;
      }) as typeof vscode.workspace.getConfiguration;

      const mockDocument = {
        uri: vscode.Uri.file("/test/file.sh"),
      } as vscode.TextDocument;

      const config = readConfiguration(mockDocument);

      assert.strictEqual(config.enabled, true);
      assert.strictEqual(config.strategy, "umask");
      assert.strictEqual(config.silent, false);
      assert.strictEqual(config.silentErrors, false);
    });

    test("reads new strategy names correctly", () => {
      const testCases = [
        { input: "umask", expected: "umask" },
        { input: "read-based", expected: "read-based" },
        { input: "all", expected: "all" },
      ];

      testCases.forEach(({ input, expected }) => {
        vscode.workspace.getConfiguration = (() => {
          return {
            get: <T>(key: string, defaultValue?: T): T => {
              if (key === "permissionStrategy") {
                return input as T;
              }
              return defaultValue as T;
            },
          } as vscode.WorkspaceConfiguration;
        }) as typeof vscode.workspace.getConfiguration;

        const mockDocument = {
          uri: vscode.Uri.file("/test/file.sh"),
        } as vscode.TextDocument;

        const config = readConfiguration(mockDocument);

        assert.strictEqual(
          config.strategy,
          expected,
          `Strategy ${input} should map to ${expected}`
        );
      });
    });

    test("reads all config values correctly", () => {
      vscode.workspace.getConfiguration = (() => {
        return {
          get: <T>(key: string, _defaultValue?: T): T => {
            const values: Record<string, unknown> = {
              enabled: false,
              permissionStrategy: "read-based",
              silent: true,
              silentErrors: true,
            };
            return values[key] as T;
          },
        } as vscode.WorkspaceConfiguration;
      }) as typeof vscode.workspace.getConfiguration;

      const mockDocument = {
        uri: vscode.Uri.file("/test/file.sh"),
      } as vscode.TextDocument;

      const config = readConfiguration(mockDocument);

      assert.strictEqual(config.enabled, false);
      assert.strictEqual(config.strategy, "read-based");
      assert.strictEqual(config.silent, true);
      assert.strictEqual(config.silentErrors, true);
    });

    test("uses workspace-specific configuration", () => {
      let calledWithSection: string | undefined;
      let calledWithScope: vscode.Uri | undefined;

      vscode.workspace.getConfiguration = ((
        section?: string,
        scope?: vscode.Uri
      ) => {
        calledWithSection = section;
        calledWithScope = scope;
        return {
          get: <T>(_key: string, defaultValue?: T): T => {
            return defaultValue as T;
          },
        } as vscode.WorkspaceConfiguration;
      }) as typeof vscode.workspace.getConfiguration;

      const testUri = vscode.Uri.file("/test/file.sh");
      const mockDocument = {
        uri: testUri,
      } as vscode.TextDocument;

      readConfiguration(mockDocument);

      assert.strictEqual(
        calledWithSection,
        "executableOnSave",
        "Should request executableOnSave section"
      );
      assert.strictEqual(
        calledWithScope?.toString(),
        testUri.toString(),
        "Should use document URI as scope"
      );
    });
  });

  suite("onSaveEnabled", () => {
    let originalGetConfiguration: typeof vscode.workspace.getConfiguration;

    setup(() => {
      originalGetConfiguration = vscode.workspace.getConfiguration;
    });

    teardown(() => {
      vscode.workspace.getConfiguration = originalGetConfiguration;
    });

    test("returns true when enabled is true", () => {
      vscode.workspace.getConfiguration = (() => {
        return {
          get: <T>(key: string, defaultValue?: T): T => {
            if (key === "enabled") {
              return true as T;
            }
            return defaultValue as T;
          },
        } as vscode.WorkspaceConfiguration;
      }) as typeof vscode.workspace.getConfiguration;

      const mockDocument = {
        uri: vscode.Uri.file("/test/file.sh"),
      } as vscode.TextDocument;

      const result = onSaveEnabled(mockDocument);

      assert.strictEqual(result, true);
    });

    test("returns false when enabled is false", () => {
      vscode.workspace.getConfiguration = (() => {
        return {
          get: <T>(key: string, defaultValue?: T): T => {
            if (key === "enabled") {
              return false as T;
            }
            return defaultValue as T;
          },
        } as vscode.WorkspaceConfiguration;
      }) as typeof vscode.workspace.getConfiguration;

      const mockDocument = {
        uri: vscode.Uri.file("/test/file.sh"),
      } as vscode.TextDocument;

      const result = onSaveEnabled(mockDocument);

      assert.strictEqual(result, false);
    });

    test("returns true by default when config not set", () => {
      vscode.workspace.getConfiguration = (() => {
        return {
          get: <T>(_key: string, defaultValue?: T): T => {
            return defaultValue as T;
          },
        } as vscode.WorkspaceConfiguration;
      }) as typeof vscode.workspace.getConfiguration;

      const mockDocument = {
        uri: vscode.Uri.file("/test/file.sh"),
      } as vscode.TextDocument;

      const result = onSaveEnabled(mockDocument);

      assert.strictEqual(result, true);
    });

    test("uses workspace-specific configuration", () => {
      let calledWithSection: string | undefined;
      let calledWithScope: vscode.Uri | undefined;

      vscode.workspace.getConfiguration = ((
        section?: string,
        scope?: vscode.Uri
      ) => {
        calledWithSection = section;
        calledWithScope = scope;
        return {
          get: <T>(_key: string, defaultValue?: T): T => {
            return defaultValue as T;
          },
        } as vscode.WorkspaceConfiguration;
      }) as typeof vscode.workspace.getConfiguration;

      const testUri = vscode.Uri.file("/test/file.sh");
      const mockDocument = {
        uri: testUri,
      } as vscode.TextDocument;

      onSaveEnabled(mockDocument);

      assert.strictEqual(
        calledWithSection,
        "executableOnSave",
        "Should request executableOnSave section"
      );
      assert.strictEqual(
        calledWithScope?.toString(),
        testUri.toString(),
        "Should use document URI as scope"
      );
    });
  });
});
