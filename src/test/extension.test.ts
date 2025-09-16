import * as assert from "assert";
import * as vscode from "vscode";
import { chmod, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import sinon from "sinon";

const CONFIG_SECTION = "markExecutableOnSave";
const CONFIG_ENABLE_KEY = "enableShebangMarking";

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

suite("Mark executable on save", () => {
  if (process.platform === "win32") {
    return;
  }

  let sandbox: sinon.SinonSandbox;
  let configEnabled = true;

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
              return defaultValue as T;
            },
          };
          return fakeConfig as vscode.WorkspaceConfiguration;
        }

        return originalGetConfiguration.call(vscode.workspace, section, scope);
      });
  });

  teardown(() => {
    sandbox.restore();
  });

  test("marks shebang file as executable on save", async () => {
    configEnabled = true;

    const tempDir = await mkdtemp(join(tmpdir(), "mark-exec-shebang-"));
    const fileUri = vscode.Uri.file(join(tempDir, "shebang-script.sh"));
    await writeFile(fileUri.fsPath, '#!/usr/bin/env bash\necho "hello"\n', {
      mode: 0o644,
    });
    await chmod(fileUri.fsPath, 0o644);

    const initialMode = (await stat(fileUri.fsPath)).mode & 0o111;
    assert.strictEqual(initialMode, 0);

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

    const saved = await editor.document.save();
    assert.ok(saved, "Expected document.save() to succeed");

    await waitFor(
      async () => ((await stat(fileUri.fsPath)).mode & 0o111) !== 0
    );

    const finalMode = (await stat(fileUri.fsPath)).mode & 0o111;
    assert.notStrictEqual(finalMode, 0);

    await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
    await rm(tempDir, { force: true, recursive: true });
  });

  test("does not change permissions when disabled", async () => {
    configEnabled = false;

    const tempDir = await mkdtemp(join(tmpdir(), "mark-exec-disabled-"));
    const fileUri = vscode.Uri.file(join(tempDir, "disabled-script.sh"));
    await writeFile(fileUri.fsPath, '#!/usr/bin/env bash\necho "hello"\n', {
      mode: 0o644,
    });
    await chmod(fileUri.fsPath, 0o644);

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

    const saved = await editor.document.save();
    assert.ok(saved, "Expected document.save() to succeed");

    await delay(200);

    const finalMode = (await stat(fileUri.fsPath)).mode & 0o111;
    assert.strictEqual(finalMode, 0);

    await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
    await rm(tempDir, { force: true, recursive: true });
  });
});
