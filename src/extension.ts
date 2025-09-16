import * as vscode from "vscode";
import { chmod, stat } from "node:fs/promises";

const CONFIG_SECTION = "markExecutableOnSave";
const CONFIG_ENABLE_KEY = "enableShebangMarking";
const CONFIG_PERMISSION_STRATEGY_KEY = "permissionStrategy";

export function activate(context: vscode.ExtensionContext) {
  const subscription = vscode.workspace.onDidSaveTextDocument(
    async (document) => {
      try {
        await handleDocumentSave(document);
      } catch (error: any) {
        const filePath = document?.uri?.fsPath || "unknown";

        if (error?.code === "EACCES") {
          console.warn(
            `[mark-executable-on-save] Permission denied for file: ${filePath}`
          );
        } else if (error?.code === "ENOENT") {
          console.warn(`[mark-executable-on-save] File not found: ${filePath}`);
        } else {
          console.error(
            `[mark-executable-on-save] Unexpected error for file ${filePath}:`,
            error
          );
        }
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

  const permissionStrategy = config.get<string>(
    CONFIG_PERMISSION_STRATEGY_KEY,
    "safe"
  );

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

  // Calculate new permissions based on strategy
  let newMode: number;
  if (permissionStrategy === "safe") {
    // Safe: add execute only where read permission exists
    const readBits = fileStat.mode & 0o444; // Extract read bits
    const executeBits = (readBits >> 2) | (readBits >> 1) | readBits; // Convert read to execute
    newMode = fileStat.mode | (executeBits & 0o111);
  } else {
    // Standard: add execute for user, group, and other
    newMode = fileStat.mode | 0o111;
  }

  await chmod(filePath, newMode);
}

export function deactivate() {}
