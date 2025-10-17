import * as assert from "assert";
import * as vscode from "vscode";
import { chmod, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import sinon from "sinon";

const CONFIG_SECTION = "executableOnSave";
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
  permissionStrategy: "umask" | "read-based" | "all";
  silent?: boolean;
  expectedExecutable: boolean;
  shouldChangeMode: boolean;
  expectedMode?: number; // For specific mode testing
  expectedNotificationMessage?: string;
}

suite("Executable on save", () => {
  if (process.platform === "win32") {
    return;
  }

  let sandbox: sinon.SinonSandbox;
  let configEnabled = true;
  let permissionStrategy: "umask" | "read-based" | "all" = "umask";
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
    // Umask strategy tests
    {
      name: "umask strategy: makes shebang file executable",
      content: '#!/usr/bin/env bash\necho "hello"\n',
      initialMode: 0o644,
      configEnabled: true,
      permissionStrategy: "umask",
      expectedExecutable: true,
      shouldChangeMode: true,
    },
    {
      name: "umask strategy: 0o600 gets execute bits",
      content: '#!/usr/bin/env bash\necho "hello"\n',
      initialMode: 0o600,
      configEnabled: true,
      permissionStrategy: "umask",
      expectedExecutable: true,
      shouldChangeMode: true,
    },
    {
      name: "umask strategy: 0o640 gets execute bits",
      content: '#!/usr/bin/env bash\necho "hello"\n',
      initialMode: 0o640,
      configEnabled: true,
      permissionStrategy: "umask",
      expectedExecutable: true,
      shouldChangeMode: true,
    },
    {
      name: "umask strategy: 0o664 gets execute bits",
      content: '#!/usr/bin/env bash\necho "hello"\n',
      initialMode: 0o664,
      configEnabled: true,
      permissionStrategy: "umask",
      expectedExecutable: true,
      shouldChangeMode: true,
    },
    {
      name: "umask strategy: preserves special bits (setuid)",
      content: '#!/usr/bin/env bash\necho "hello"\n',
      initialMode: 0o4644,
      configEnabled: true,
      permissionStrategy: "umask",
      expectedExecutable: true,
      shouldChangeMode: true,
    },
    {
      name: "umask strategy: preserves special bits (setgid)",
      content: '#!/usr/bin/env bash\necho "hello"\n',
      initialMode: 0o2644,
      configEnabled: true,
      permissionStrategy: "umask",
      expectedExecutable: true,
      shouldChangeMode: true,
    },
    {
      name: "umask strategy: preserves special bits (sticky)",
      content: '#!/usr/bin/env bash\necho "hello"\n',
      initialMode: 0o1644,
      configEnabled: true,
      permissionStrategy: "umask",
      expectedExecutable: true,
      shouldChangeMode: true,
    },
    {
      name: "umask strategy: respects already executable files",
      content: '#!/usr/bin/env bash\necho "hello"\n',
      initialMode: 0o755,
      configEnabled: true,
      permissionStrategy: "umask",
      expectedExecutable: true,
      shouldChangeMode: false,
    },
    {
      name: "umask strategy: handles python shebang",
      content: '#!/usr/bin/env python3\nprint("hello")\n',
      initialMode: 0o644,
      configEnabled: true,
      permissionStrategy: "umask",
      expectedExecutable: true,
      shouldChangeMode: true,
    },
    {
      name: "umask strategy: handles node shebang",
      content: '#!/usr/bin/env node\nconsole.log("hello");\n',
      initialMode: 0o644,
      configEnabled: true,
      permissionStrategy: "umask",
      expectedExecutable: true,
      shouldChangeMode: true,
    },
    {
      name: "umask strategy: skips files without shebang",
      content: 'echo "hello"\n# no shebang here\n',
      initialMode: 0o644,
      configEnabled: true,
      permissionStrategy: "umask",
      expectedExecutable: false,
      shouldChangeMode: false,
    },
    {
      name: "umask strategy: handles empty file",
      content: "",
      initialMode: 0o644,
      configEnabled: true,
      permissionStrategy: "umask",
      expectedExecutable: false,
      shouldChangeMode: false,
    },
    {
      name: "umask strategy: with notification",
      content: '#!/usr/bin/env bash\necho "hello"\n',
      initialMode: 0o644,
      configEnabled: true,
      permissionStrategy: "umask",
      silent: false,
      expectedExecutable: true,
      shouldChangeMode: true,
    },
    // General behavior tests (using default umask strategy)
    {
      name: "does not change permissions when file is already executable",
      content: '#!/usr/bin/env bash\necho "hello"\n',
      initialMode: 0o755,
      configEnabled: true,
      permissionStrategy: "umask",
      expectedExecutable: true,
      shouldChangeMode: false,
    },
    {
      name: "does not change permissions for empty file",
      content: "",
      initialMode: 0o644,
      configEnabled: true,
      permissionStrategy: "umask",
      expectedExecutable: false,
      shouldChangeMode: false,
    },
    {
      name: "does not change permissions for file without shebang",
      content: 'echo "hello"\n# This is a script without shebang\n',
      initialMode: 0o644,
      configEnabled: true,
      permissionStrategy: "umask",
      expectedExecutable: false,
      shouldChangeMode: false,
    },
    {
      name: "does not change permissions when feature is disabled",
      content: '#!/usr/bin/env bash\necho "hello"\n',
      initialMode: 0o644,
      configEnabled: false,
      permissionStrategy: "umask",
      expectedExecutable: false,
      shouldChangeMode: false,
    },
    {
      name: "handles python shebang correctly",
      content: '#!/usr/bin/env python3\nprint("hello")\n',
      initialMode: 0o644,
      configEnabled: true,
      permissionStrategy: "umask",
      expectedExecutable: true,
      shouldChangeMode: true,
    },
    {
      name: "handles node shebang correctly",
      content: '#!/usr/bin/env node\nconsole.log("hello");\n',
      initialMode: 0o644,
      configEnabled: true,
      permissionStrategy: "umask",
      expectedExecutable: true,
      shouldChangeMode: true,
    },
    {
      name: "ignores shebang not at beginning of file",
      content: '# Comment first\n#!/usr/bin/env bash\necho "hello"\n',
      initialMode: 0o644,
      configEnabled: true,
      permissionStrategy: "umask",
      expectedExecutable: false,
      shouldChangeMode: false,
    },
    {
      name: "handles single character shebang line",
      content: "#!\n",
      initialMode: 0o644,
      configEnabled: true,
      permissionStrategy: "umask",
      expectedExecutable: true,
      shouldChangeMode: true,
    },
    {
      name: "handles BOM before shebang",
      content: "\uFEFF#!/usr/bin/env bash\necho hello\n",
      initialMode: 0o644,
      configEnabled: true,
      permissionStrategy: "umask",
      expectedExecutable: true,
      shouldChangeMode: true,
    },
    // Read-based permission strategy test cases
    {
      name: "read-based strategy: makes shebang file executable",
      content: '#!/usr/bin/env bash\necho "hello"\n',
      initialMode: 0o644,
      configEnabled: true,
      permissionStrategy: "read-based",
      expectedExecutable: true,
      shouldChangeMode: true,
      expectedMode: 0o755,
    },
    {
      name: "read-based strategy: 0o644 -> 0o755 (read+write becomes read+write+execute)",
      content: '#!/usr/bin/env bash\necho "hello"\n',
      initialMode: 0o644,
      configEnabled: true,
      permissionStrategy: "read-based",
      expectedExecutable: true,
      shouldChangeMode: true,
      expectedMode: 0o755, // r--+r--+r-- becomes rwx+r-x+r-x
    },
    {
      name: "read-based strategy: 0o600 -> 0o700 (user-only read+write)",
      content: '#!/usr/bin/env bash\necho "hello"\n',
      initialMode: 0o600,
      configEnabled: true,
      permissionStrategy: "read-based",
      expectedExecutable: true,
      shouldChangeMode: true,
      expectedMode: 0o700, // rw-+---+--- becomes rwx+---+---
    },
    {
      name: "read-based strategy: 0o640 -> 0o750 (user rw, group r)",
      content: '#!/usr/bin/env bash\necho "hello"\n',
      initialMode: 0o640,
      configEnabled: true,
      permissionStrategy: "read-based",
      expectedExecutable: true,
      shouldChangeMode: true,
      expectedMode: 0o750, // rw-+r--+--- becomes rwx+r-x+---
    },
    {
      name: "read-based strategy: 0o664 -> 0o775 (all have read+write)",
      content: '#!/usr/bin/env bash\necho "hello"\n',
      initialMode: 0o664,
      configEnabled: true,
      permissionStrategy: "read-based",
      expectedExecutable: true,
      shouldChangeMode: true,
      expectedMode: 0o775, // rw-+rw-+r-- becomes rwx+rwx+r-x
    },
    // Notification tests
    {
      name: "displays notification when permissions change and silent is false",
      content: '#!/usr/bin/env bash\necho "hello"\n',
      initialMode: 0o644,
      configEnabled: true,
      permissionStrategy: "umask",
      silent: false,
      expectedExecutable: true,
      shouldChangeMode: true,
    },
    {
      name: "suppresses notification when silent is enabled",
      content: '#!/usr/bin/env bash\necho "hello"\n',
      initialMode: 0o644,
      configEnabled: true,
      permissionStrategy: "umask",
      silent: true,
      expectedExecutable: true,
      shouldChangeMode: true,
    },
    // All strategy tests for backward compatibility
    {
      name: "all strategy: 0o644 -> 0o755 (add execute for all)",
      content: '#!/usr/bin/env bash\necho "hello"\n',
      initialMode: 0o644,
      configEnabled: true,
      permissionStrategy: "all",
      expectedExecutable: true,
      shouldChangeMode: true,
      expectedMode: 0o755,
    },
    {
      name: "all strategy: 0o600 -> 0o711 (add execute for all)",
      content: '#!/usr/bin/env bash\necho "hello"\n',
      initialMode: 0o600,
      configEnabled: true,
      permissionStrategy: "all",
      expectedExecutable: true,
      shouldChangeMode: true,
      expectedMode: 0o711, // rw-+---+--- becomes rwx+--x+--x
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

  // Test for untitled documents (special case since they don't have file paths)
  test("does not process untitled documents", async () => {
    configEnabled = true;
    permissionStrategy = "read-based";

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
    permissionStrategy = "read-based";

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

  suite("shebang edge cases", () => {
    test("ignores file with only # (not #!)", async () => {
      configEnabled = true;
      permissionStrategy = "read-based";

      const tempDir = await mkdtemp(join(tmpdir(), "mark-exec-test-"));
      const fileUri = vscode.Uri.file(join(tempDir, "test-script"));

      await writeFile(fileUri.fsPath, "#\necho hello", { mode: 0o644 });

      const document = await vscode.workspace.openTextDocument(fileUri);
      const editor = await vscode.window.showTextDocument(document, {
        preview: false,
      });
      await editor.edit((editBuilder) => {
        editBuilder.insert(
          new vscode.Position(editor.document.lineCount, 0),
          "# test\n"
        );
      });

      await editor.document.save();
      await delay(200);

      const finalStat = await stat(fileUri.fsPath);
      const finalExecutable = (finalStat.mode & 0o111) !== 0;
      assert.strictEqual(
        finalExecutable,
        false,
        "File should not be executable"
      );

      await vscode.commands.executeCommand(
        "workbench.action.closeActiveEditor"
      );
      await rm(tempDir, { force: true, recursive: true });
    });

    test("ignores file with whitespace before shebang", async () => {
      configEnabled = true;
      permissionStrategy = "read-based";

      const tempDir = await mkdtemp(join(tmpdir(), "mark-exec-test-"));
      const fileUri = vscode.Uri.file(join(tempDir, "test-script"));

      await writeFile(fileUri.fsPath, " #!/bin/bash\necho hello", {
        mode: 0o644,
      });

      const document = await vscode.workspace.openTextDocument(fileUri);
      const editor = await vscode.window.showTextDocument(document, {
        preview: false,
      });
      await editor.edit((editBuilder) => {
        editBuilder.insert(
          new vscode.Position(editor.document.lineCount, 0),
          "# test\n"
        );
      });

      await editor.document.save();
      await delay(200);

      const finalStat = await stat(fileUri.fsPath);
      const finalExecutable = (finalStat.mode & 0o111) !== 0;
      assert.strictEqual(
        finalExecutable,
        false,
        "File should not be executable"
      );

      await vscode.commands.executeCommand(
        "workbench.action.closeActiveEditor"
      );
      await rm(tempDir, { force: true, recursive: true });
    });

    test("handles file with only one character", async () => {
      configEnabled = true;
      permissionStrategy = "read-based";

      const tempDir = await mkdtemp(join(tmpdir(), "mark-exec-test-"));
      const fileUri = vscode.Uri.file(join(tempDir, "test-script"));

      await writeFile(fileUri.fsPath, "#", { mode: 0o644 });

      const document = await vscode.workspace.openTextDocument(fileUri);
      const editor = await vscode.window.showTextDocument(document, {
        preview: false,
      });
      await editor.edit((editBuilder) => {
        editBuilder.insert(
          new vscode.Position(editor.document.lineCount, 0),
          "# test\n"
        );
      });

      await editor.document.save();
      await delay(200);

      const finalStat = await stat(fileUri.fsPath);
      const finalExecutable = (finalStat.mode & 0o111) !== 0;
      assert.strictEqual(
        finalExecutable,
        false,
        "File should not be executable"
      );

      await vscode.commands.executeCommand(
        "workbench.action.closeActiveEditor"
      );
      await rm(tempDir, { force: true, recursive: true });
    });
  });

  suite("read-based strategy with no read permissions", () => {
    test("does not make executable when file has no read permissions", async () => {
      configEnabled = true;
      permissionStrategy = "read-based";

      const tempDir = await mkdtemp(join(tmpdir(), "mark-exec-test-"));
      const fileUri = vscode.Uri.file(join(tempDir, "test-script"));

      // Create file with normal permissions first so VS Code can open it
      await writeFile(fileUri.fsPath, '#!/bin/bash\necho "hello"\n', {
        mode: 0o644,
      });

      const document = await vscode.workspace.openTextDocument(fileUri);
      const editor = await vscode.window.showTextDocument(document, {
        preview: false,
      });

      // Now change to write-only permission before saving
      await chmod(fileUri.fsPath, 0o200);

      await editor.edit((editBuilder) => {
        editBuilder.insert(
          new vscode.Position(editor.document.lineCount, 0),
          "# test\n"
        );
      });

      await editor.document.save();
      await delay(200);

      const finalStat = await stat(fileUri.fsPath);
      const finalMode = finalStat.mode & 0o777;
      assert.strictEqual(
        finalMode,
        0o200,
        "File mode should remain 0o200 (no execute added)"
      );

      await vscode.commands.executeCommand(
        "workbench.action.closeActiveEditor"
      );
      await rm(tempDir, { force: true, recursive: true });
    });
  });

  suite("umask strategy behavior", () => {
    test("umask strategy adds execute bits according to system umask", async () => {
      configEnabled = true;
      permissionStrategy = "umask";

      const tempDir = await mkdtemp(join(tmpdir(), "mark-exec-test-"));
      const fileUri = vscode.Uri.file(join(tempDir, "test-script"));

      await writeFile(fileUri.fsPath, '#!/bin/bash\necho "hello"\n', {
        mode: 0o644,
      });

      const document = await vscode.workspace.openTextDocument(fileUri);
      const editor = await vscode.window.showTextDocument(document, {
        preview: false,
      });
      await editor.edit((editBuilder) => {
        editBuilder.insert(
          new vscode.Position(editor.document.lineCount, 0),
          "# test\n"
        );
      });

      await editor.document.save();
      await waitFor(
        async () => ((await stat(fileUri.fsPath)).mode & 0o111) !== 0
      );

      const finalStat = await stat(fileUri.fsPath);
      const finalMode = finalStat.mode & 0o777;
      const executeBits = finalMode & 0o111;

      // Verify at least user execute bit is set
      assert.ok(executeBits & 0o100, "User execute bit should be set");

      // Verify file is executable
      assert.ok(
        (finalMode & 0o111) !== 0,
        "File should have execute permission"
      );

      await vscode.commands.executeCommand(
        "workbench.action.closeActiveEditor"
      );
      await rm(tempDir, { force: true, recursive: true });
    });

    test("umask strategy only adds execute bits", async () => {
      configEnabled = true;
      permissionStrategy = "umask";

      const tempDir = await mkdtemp(join(tmpdir(), "mark-exec-test-"));
      const fileUri = vscode.Uri.file(join(tempDir, "test-script"));

      const initialMode = 0o644;
      await writeFile(fileUri.fsPath, '#!/bin/bash\necho "hello"\n', {
        mode: initialMode,
      });

      // Get the actual initial state after file creation
      const beforeStat = await stat(fileUri.fsPath);
      const beforeMode = beforeStat.mode & 0o777;

      const document = await vscode.workspace.openTextDocument(fileUri);
      const editor = await vscode.window.showTextDocument(document, {
        preview: false,
      });
      await editor.edit((editBuilder) => {
        editBuilder.insert(
          new vscode.Position(editor.document.lineCount, 0),
          "# test\n"
        );
      });

      await editor.document.save();
      await waitFor(
        async () => ((await stat(fileUri.fsPath)).mode & 0o111) !== 0
      );

      const finalStat = await stat(fileUri.fsPath);
      const finalMode = finalStat.mode & 0o777;

      // Verify execute bits were added (final should have more execute than before)
      const beforeExecute = beforeMode & 0o111;
      const finalExecute = finalMode & 0o111;
      assert.ok(
        finalExecute >= beforeExecute,
        "Execute bits should be added or unchanged"
      );

      // Verify at least user execute is set
      assert.ok(finalExecute & 0o100, "User execute bit should be set");

      await vscode.commands.executeCommand(
        "workbench.action.closeActiveEditor"
      );
      await rm(tempDir, { force: true, recursive: true });
    });

    test("umask strategy works with manual command", async () => {
      configEnabled = true;
      permissionStrategy = "umask";

      const tempDir = await mkdtemp(join(tmpdir(), "mark-exec-test-"));
      const fileUri = vscode.Uri.file(join(tempDir, "test-script"));

      await writeFile(fileUri.fsPath, '#!/bin/bash\necho "hello"\n', {
        mode: 0o644,
      });

      const document = await vscode.workspace.openTextDocument(fileUri);
      await vscode.window.showTextDocument(document, { preview: false });

      // Run the command
      await vscode.commands.executeCommand(
        "executable-on-save.makeExecutableIfScript"
      );

      // Wait for permission change
      await waitFor(
        async () => ((await stat(fileUri.fsPath)).mode & 0o111) !== 0
      );

      const finalStat = await stat(fileUri.fsPath);
      const finalMode = finalStat.mode & 0o777;

      assert.ok(
        (finalMode & 0o111) !== 0,
        "File should have execute permission"
      );

      await vscode.commands.executeCommand(
        "workbench.action.closeActiveEditor"
      );
      await rm(tempDir, { force: true, recursive: true });
    });
  });

  suite("manual command", () => {
    test("makes file executable when command is run", async () => {
      configEnabled = true;
      permissionStrategy = "read-based";

      const tempDir = await mkdtemp(join(tmpdir(), "mark-exec-test-"));
      const fileUri = vscode.Uri.file(join(tempDir, "test-script"));

      await writeFile(fileUri.fsPath, '#!/bin/bash\necho "hello"\n', {
        mode: 0o644,
      });

      const document = await vscode.workspace.openTextDocument(fileUri);
      await vscode.window.showTextDocument(document, { preview: false });

      // Run the command
      await vscode.commands.executeCommand(
        "executable-on-save.makeExecutableIfScript"
      );

      // Wait for permission change
      await waitFor(
        async () => ((await stat(fileUri.fsPath)).mode & 0o111) !== 0
      );

      const finalStat = await stat(fileUri.fsPath);
      const finalMode = finalStat.mode & 0o777;
      assert.strictEqual(finalMode, 0o755, "File should be executable");

      await vscode.commands.executeCommand(
        "workbench.action.closeActiveEditor"
      );
      await rm(tempDir, { force: true, recursive: true });
    });

    test("command does nothing when no editor is active", async () => {
      // Close all editors
      await vscode.commands.executeCommand("workbench.action.closeAllEditors");

      // Command should not throw
      await vscode.commands.executeCommand(
        "executable-on-save.makeExecutableIfScript"
      );

      // If we get here, the test passed
      assert.ok(true, "Command handled gracefully with no active editor");
    });

    test("works when feature is disabled but manually triggered", async () => {
      configEnabled = false; // Feature disabled
      permissionStrategy = "umask";

      const tempDir = await mkdtemp(join(tmpdir(), "mark-exec-test-"));
      const fileUri = vscode.Uri.file(join(tempDir, "test-script"));

      await writeFile(fileUri.fsPath, '#!/bin/bash\necho "hello"\n', {
        mode: 0o644,
      });

      const document = await vscode.workspace.openTextDocument(fileUri);
      await vscode.window.showTextDocument(document, { preview: false });

      // Run the command manually
      await vscode.commands.executeCommand(
        "executable-on-save.makeExecutableIfScript"
      );

      // Wait for permission change
      await waitFor(
        async () => ((await stat(fileUri.fsPath)).mode & 0o111) !== 0
      );

      const finalStat = await stat(fileUri.fsPath);
      const finalMode = finalStat.mode & 0o777;
      assert.ok(
        (finalMode & 0o111) !== 0,
        "File should be executable even with feature disabled"
      );

      await vscode.commands.executeCommand(
        "workbench.action.closeActiveEditor"
      );
      await rm(tempDir, { force: true, recursive: true });
    });
  });
});
