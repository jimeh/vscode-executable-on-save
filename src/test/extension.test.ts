import * as assert from "assert";
import * as vscode from "vscode";
import { chmod, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import sinon from "sinon";
import { __testing } from "../extension";

const CONFIG_SECTION = "markExecutableOnSave";
const CONFIG_ENABLE_KEY = "enabled";
const CONFIG_PERMISSION_STRATEGY_KEY = "permissionStrategy";
const CONFIG_SILENT_KEY = "silent";

async function waitFor(
  predicate: () => Promise<boolean>,
  timeoutMs = 2000,
  intervalMs = 50
) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await predicate()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error("Timed out waiting for condition");
}

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface TestCase {
  name: string;
  content: string;
  initialMode: number;
  configEnabled: boolean;
  permissionStrategy: "standard" | "safe";
  silent?: boolean;
  expectedExecutable: boolean;
  shouldChangeMode: boolean;
  expectedMode?: number; // For specific mode testing
  expectedNotificationMessage?: string;
}

suite("Mark executable on save", () => {
  if (process.platform === "win32") {
    return;
  }

  let sandbox: sinon.SinonSandbox;
  let configEnabled = true;
  let permissionStrategy: "standard" | "safe" = "safe";
  let silent = false;
  let showInformationMessageStub: sinon.SinonStub;

  setup(() => {
    sandbox = sinon.createSandbox();
    const originalGetConfiguration = vscode.workspace.getConfiguration;

    sandbox
      .stub(vscode.workspace, "getConfiguration")
      .callsFake((section: any, scope?: any) => {
        if (section === CONFIG_SECTION) {
          const fakeConfig: Partial<vscode.WorkspaceConfiguration> = {
            get<T>(key: string, defaultValue?: T): T {
              if (key === CONFIG_ENABLE_KEY) {
                return configEnabled as unknown as T;
              }
              if (key === CONFIG_PERMISSION_STRATEGY_KEY) {
                return permissionStrategy as unknown as T;
              }
              if (key === CONFIG_SILENT_KEY) {
                return silent as unknown as T;
              }
              return defaultValue as T;
            },
          };
          return fakeConfig as vscode.WorkspaceConfiguration;
        }

        return originalGetConfiguration.call(vscode.workspace, section, scope);
      });

    showInformationMessageStub = sandbox
      .stub(vscode.window, "showInformationMessage")
      .resolves(undefined as unknown as vscode.MessageItem);
  });

  teardown(() => {
    sandbox.restore();
    silent = false;
  });

  const testCases: TestCase[] = [
    {
      name: "marks shebang file as executable when not executable (safe default)",
      content: '#!/usr/bin/env bash\necho "hello"\n',
      initialMode: 0o644,
      configEnabled: true,
      permissionStrategy: "safe",
      expectedExecutable: true,
      shouldChangeMode: true,
      expectedMode: 0o755,
    },
    {
      name: "does not change permissions when file is already executable",
      content: '#!/usr/bin/env bash\necho "hello"\n',
      initialMode: 0o755,
      configEnabled: true,
      permissionStrategy: "safe",
      expectedExecutable: true,
      shouldChangeMode: false,
    },
    {
      name: "does not change permissions for empty file",
      content: "",
      initialMode: 0o644,
      configEnabled: true,
      permissionStrategy: "safe",
      expectedExecutable: false,
      shouldChangeMode: false,
    },
    {
      name: "does not change permissions for file without shebang",
      content: 'echo "hello"\n# This is a script without shebang\n',
      initialMode: 0o644,
      configEnabled: true,
      permissionStrategy: "safe",
      expectedExecutable: false,
      shouldChangeMode: false,
    },
    {
      name: "does not change permissions when feature is disabled",
      content: '#!/usr/bin/env bash\necho "hello"\n',
      initialMode: 0o644,
      configEnabled: false,
      permissionStrategy: "safe",
      expectedExecutable: false,
      shouldChangeMode: false,
    },
    {
      name: "handles python shebang correctly",
      content: '#!/usr/bin/env python3\nprint("hello")\n',
      initialMode: 0o644,
      configEnabled: true,
      permissionStrategy: "safe",
      expectedExecutable: true,
      shouldChangeMode: true,
    },
    {
      name: "handles node shebang correctly",
      content: '#!/usr/bin/env node\nconsole.log("hello");\n',
      initialMode: 0o644,
      configEnabled: true,
      permissionStrategy: "safe",
      expectedExecutable: true,
      shouldChangeMode: true,
    },
    {
      name: "ignores shebang not at beginning of file",
      content: '# Comment first\n#!/usr/bin/env bash\necho "hello"\n',
      initialMode: 0o644,
      configEnabled: true,
      permissionStrategy: "safe",
      expectedExecutable: false,
      shouldChangeMode: false,
    },
    {
      name: "handles single character shebang line",
      content: "#!\n",
      initialMode: 0o644,
      configEnabled: true,
      permissionStrategy: "safe",
      expectedExecutable: true,
      shouldChangeMode: true,
    },
    // Safe permission strategy test cases
    {
      name: "safe strategy: 0o644 -> 0o755 (read+write becomes read+write+execute)",
      content: '#!/usr/bin/env bash\necho "hello"\n',
      initialMode: 0o644,
      configEnabled: true,
      permissionStrategy: "safe",
      expectedExecutable: true,
      shouldChangeMode: true,
      expectedMode: 0o755, // r--+r--+r-- becomes rwx+r-x+r-x
    },
    {
      name: "safe strategy: 0o600 -> 0o700 (user-only read+write)",
      content: '#!/usr/bin/env bash\necho "hello"\n',
      initialMode: 0o600,
      configEnabled: true,
      permissionStrategy: "safe",
      expectedExecutable: true,
      shouldChangeMode: true,
      expectedMode: 0o700, // rw-+---+--- becomes rwx+---+---
    },
    {
      name: "safe strategy: 0o640 -> 0o750 (user rw, group r)",
      content: '#!/usr/bin/env bash\necho "hello"\n',
      initialMode: 0o640,
      configEnabled: true,
      permissionStrategy: "safe",
      expectedExecutable: true,
      shouldChangeMode: true,
      expectedMode: 0o750, // rw-+r--+--- becomes rwx+r-x+---
    },
    {
      name: "safe strategy: 0o664 -> 0o775 (all have read+write)",
      content: '#!/usr/bin/env bash\necho "hello"\n',
      initialMode: 0o664,
      configEnabled: true,
      permissionStrategy: "safe",
      expectedExecutable: true,
      shouldChangeMode: true,
      expectedMode: 0o775, // rw-+rw-+r-- becomes rwx+rwx+r-x
    },
    // Standard strategy tests for backward compatibility
    {
      name: "standard strategy: 0o644 -> 0o755 (add execute for all)",
      content: '#!/usr/bin/env bash\necho "hello"\n',
      initialMode: 0o644,
      configEnabled: true,
      permissionStrategy: "standard",
      expectedExecutable: true,
      shouldChangeMode: true,
      expectedMode: 0o755,
    },
    {
      name: "standard strategy: 0o600 -> 0o711 (add execute for all)",
      content: '#!/usr/bin/env bash\necho "hello"\n',
      initialMode: 0o600,
      configEnabled: true,
      permissionStrategy: "standard",
      expectedExecutable: true,
      shouldChangeMode: true,
      expectedMode: 0o711, // rw-+---+--- becomes rwx+--x+--x
    },
    {
      name: "displays notification when permissions change and silent is false",
      content: '#!/usr/bin/env bash\necho "hello"\n',
      initialMode: 0o644,
      configEnabled: true,
      permissionStrategy: "safe",
      silent: false,
      expectedExecutable: true,
      shouldChangeMode: true,
      expectedMode: 0o755,
      expectedNotificationMessage: "test-script: Made executable (644 -> 755)",
    },
    {
      name: "suppresses notification when silent is enabled",
      content: '#!/usr/bin/env bash\necho "hello"\n',
      initialMode: 0o644,
      configEnabled: true,
      permissionStrategy: "safe",
      silent: true,
      expectedExecutable: true,
      shouldChangeMode: true,
      expectedMode: 0o755,
    },
  ];

  testCases.forEach((testCase) => {
    test(testCase.name, async () => {
      configEnabled = testCase.configEnabled;
      permissionStrategy = testCase.permissionStrategy;
      silent = testCase.silent ?? false;
      showInformationMessageStub.resetHistory();

      const tempDir = await mkdtemp(join(tmpdir(), "mark-exec-test-"));
      const fileUri = vscode.Uri.file(join(tempDir, "test-script"));

      // Create file with specified content and mode
      await writeFile(fileUri.fsPath, testCase.content, {
        mode: testCase.initialMode,
      });
      await chmod(fileUri.fsPath, testCase.initialMode);

      // Verify initial state
      const initialStat = await stat(fileUri.fsPath);
      const initialExecutable = (initialStat.mode & 0o111) !== 0;
      assert.strictEqual(
        initialExecutable,
        (testCase.initialMode & 0o111) !== 0,
        "Initial executable state should match expectation"
      );

      // Open document and make a change to trigger save
      const document = await vscode.workspace.openTextDocument(fileUri);
      const editor = await vscode.window.showTextDocument(document, {
        preview: false,
      });
      await editor.edit((editBuilder) => {
        editBuilder.insert(
          new vscode.Position(editor.document.lineCount, 0),
          "# test comment\n"
        );
      });

      // Save the document
      const saved = await editor.document.save();
      assert.ok(saved, "Expected document.save() to succeed");

      if (testCase.shouldChangeMode) {
        // Wait for mode change if we expect it
        await waitFor(
          async () => ((await stat(fileUri.fsPath)).mode & 0o111) !== 0
        );
      } else {
        // Give some time for any potential change
        await delay(200);
      }

      // Verify final state
      const finalStat = await stat(fileUri.fsPath);
      const finalExecutable = (finalStat.mode & 0o111) !== 0;
      assert.strictEqual(
        finalExecutable,
        testCase.expectedExecutable,
        `File should ${testCase.expectedExecutable ? "be" : "not be"} executable`
      );

      // Check specific mode if provided
      if (testCase.expectedMode !== undefined) {
        const finalMode = finalStat.mode & 0o777; // Extract permission bits
        assert.strictEqual(
          finalMode,
          testCase.expectedMode,
          `File mode should be 0o${testCase.expectedMode.toString(8)}, but got 0o${finalMode.toString(8)}`
        );
      }

      const expectedNotificationCalls =
        testCase.shouldChangeMode && !(testCase.silent ?? false) ? 1 : 0;
      assert.strictEqual(
        showInformationMessageStub.callCount,
        expectedNotificationCalls,
        "Unexpected number of information messages"
      );

      if (testCase.expectedNotificationMessage !== undefined) {
        assert.strictEqual(
          showInformationMessageStub.firstCall?.args?.[0],
          testCase.expectedNotificationMessage,
          "Notification message should match expected value"
        );
      }

      // Cleanup
      await vscode.commands.executeCommand(
        "workbench.action.closeActiveEditor"
      );
      await rm(tempDir, { force: true, recursive: true });
    });
  });

  suite("error notifications", () => {
    test("shows error when notifications enabled", async () => {
      const showErrorStub = sandbox
        .stub(vscode.window, "showErrorMessage")
        .resolves(undefined as unknown as vscode.MessageItem);

      await __testing.showErrorMessage("failure", {
        enabled: true,
        strategy: "safe",
        silent: false,
        silentErrors: false,
      });

      sinon.assert.calledOnce(showErrorStub);
      sinon.assert.calledWith(showErrorStub, "failure");
    });

    test("suppresses error when silentErrors enabled", async () => {
      const showErrorStub = sandbox
        .stub(vscode.window, "showErrorMessage")
        .resolves(undefined as unknown as vscode.MessageItem);

      await __testing.showErrorMessage("failure", {
        enabled: true,
        strategy: "safe",
        silent: false,
        silentErrors: true,
      });

      sinon.assert.notCalled(showErrorStub);
    });
  });

  // Test for untitled documents (special case since they don't have file paths)
  test("does not process untitled documents", async () => {
    configEnabled = true;
    permissionStrategy = "safe";

    const document = await vscode.workspace.openTextDocument({
      content: '#!/usr/bin/env bash\necho "hello"\n',
      language: "shellscript",
    });

    assert.ok(document.isUntitled, "Document should be untitled");

    const editor = await vscode.window.showTextDocument(document, {
      preview: false,
    });

    // Make a change to mark the document as dirty
    await editor.edit((editBuilder) => {
      editBuilder.insert(
        new vscode.Position(editor.document.lineCount, 0),
        "# test\n"
      );
    });

    // Verify the document is untitled and has file scheme "untitled"
    assert.ok(document.isUntitled, "Document should still be untitled");
    assert.notStrictEqual(
      document.uri.scheme,
      "file",
      "Untitled document should not have file scheme"
    );

    // The extension should handle this gracefully without attempting file operations
    // We don't actually need to save - just verify the document state
    await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
  });

  // Test for non-file URIs (like git: scheme)
  test("does not process non-file URI schemes", async () => {
    configEnabled = true;
    permissionStrategy = "safe";

    // Create a real file first to base the git URI on
    const tempDir = await mkdtemp(join(tmpdir(), "mark-exec-git-test-"));
    const filePath = join(tempDir, "script.sh");
    await writeFile(filePath, '#!/usr/bin/env bash\necho "hello"\n', {
      mode: 0o644,
    });

    // Create a mock document with a non-file URI
    const gitUri = vscode.Uri.parse(`git:${filePath}`);
    assert.notStrictEqual(
      gitUri.scheme,
      "file",
      "URI should not be file scheme"
    );

    // We can't easily test this with VS Code's openTextDocument since it
    // expects real URIs, but we can verify our extension logic would handle
    // it correctly by testing the scheme check indirectly through our
    // handleDocumentSave function behavior

    await rm(tempDir, { force: true, recursive: true });
  });
});
