import * as vscode from "vscode";
import { chmod, stat } from "node:fs/promises";

const CONFIG_SECTION = "markExecutableOnSave";
const CONFIG_ENABLE_KEY = "enableShebangMarking";

export function activate(context: vscode.ExtensionContext) {
  const subscription = vscode.workspace.onDidSaveTextDocument(
    async (document) => {
      try {
        await handleDocumentSave(document);
      } catch (error) {
        console.error("[mark-executable-on-save]", error);
      }
    }
  );

  context.subscriptions.push(subscription);
}

async function handleDocumentSave(document: vscode.TextDocument) {
  if (process.platform === "win32") {
    return;
  }

  if (document.isUntitled || document.uri.scheme !== "file") {
    return;
  }

  const config = vscode.workspace.getConfiguration(
    CONFIG_SECTION,
    document.uri
  );
  const enabled = config.get<boolean>(CONFIG_ENABLE_KEY, true);
  if (!enabled) {
    return;
  }

  const filePath = document.uri.fsPath;
  const fileStat = await stat(filePath);
  if ((fileStat.mode & 0o111) !== 0) {
    return;
  }

  const prefixRange = document.validateRange(
    new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 2))
  );
  const prefix = document.getText(prefixRange);
  if (prefix !== "#!") {
    return;
  }

  await chmod(filePath, fileStat.mode | 0o111);
}

export function deactivate() {}
