import * as vscode from "vscode";
import { chmod, stat } from "node:fs/promises";
import { calculateNewMode, isExecutable } from "./permissions";
import { announceModeChange, reportError } from "./notifications";
import { type Config, readConfiguration } from "./config";

//
// Activation and deactivation
//

export function activate(context: vscode.ExtensionContext): void {
  const onSaveHook = vscode.workspace.onDidSaveTextDocument(
    makeExecutableIfScript
  );

  const command = vscode.commands.registerCommand(
    "mark-executable-on-save.markExecutableIfScript",
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }

      await makeExecutableIfScript(editor.document);
    }
  );

  context.subscriptions.push(onSaveHook, command);
}

export function deactivate(): void {}

//
// Main flow
//

async function makeExecutableIfScript(doc: vscode.TextDocument) {
  const config = readConfiguration(doc);
  try {
    await handleDocument(doc, config);
  } catch (error: any) {
    void reportError(doc, error, config);
  }
}

async function handleDocument(document: vscode.TextDocument, config: Config) {
  if (shouldSkipDocument(document)) {
    return;
  }

  const filePath = document.uri.fsPath;
  const fileStat = await stat(filePath);

  if (isExecutable(fileStat.mode)) {
    return;
  }

  const shebang = readShebang(document);
  if (!startsWithShebang(shebang)) {
    return;
  }

  if (!config.enabled) {
    return;
  }

  const oldMode = fileStat.mode & 0o777;
  const newMode = calculateNewMode(fileStat.mode, config.strategy);
  if (newMode === null) {
    return;
  }

  await chmod(filePath, newMode);

  if (!config.silent) {
    const permissionMode = newMode & 0o777;
    void announceModeChange(document, oldMode, permissionMode);
  }
}

function shouldSkipDocument(document: vscode.TextDocument): boolean {
  if (process.platform === "win32") {
    return true;
  }

  if (document.isUntitled) {
    return true;
  }

  return document.uri.scheme !== "file";
}

function readShebang(document: vscode.TextDocument): string {
  const start = new vscode.Position(0, 0);
  const end = new vscode.Position(0, 2);
  const range = new vscode.Range(start, end);
  const validatedRange = document.validateRange(range);
  return document.getText(validatedRange);
}

function startsWithShebang(prefix: string): boolean {
  return prefix.length === 2 && prefix === "#!";
}
