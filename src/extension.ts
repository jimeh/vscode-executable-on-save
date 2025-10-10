import * as vscode from "vscode";
import { chmod, stat } from "node:fs/promises";
import { basename, relative } from "node:path";

//
// Activation and deactivation
//

export function activate(context: vscode.ExtensionContext) {
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

export function deactivate() {}

//
// Configuration
//

type PermissionStrategy = "safe" | "standard";

interface ExtensionConfig {
  enabled: boolean;
  strategy: PermissionStrategy;
  silent: boolean;
}

function readConfiguration(document: vscode.TextDocument): ExtensionConfig {
  const config = vscode.workspace.getConfiguration(
    "markExecutableOnSave",
    document.uri
  );

  return {
    enabled: config.get<boolean>("enableOnSave", true),
    strategy: config.get<PermissionStrategy>("permissionStrategy", "safe"),
    silent: config.get<boolean>("silent", false),
  };
}

//
// Main flow
//

async function makeExecutableIfScript(doc: vscode.TextDocument) {
  try {
    await handleDocument(doc);
  } catch (error: any) {
    reportError(doc, error);
  }
}

async function handleDocument(document: vscode.TextDocument) {
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

  const config = readConfiguration(document);
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
    await announceModeChange(document, oldMode, permissionMode);
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

function isExecutable(mode: number): boolean {
  return (mode & 0o111) !== 0;
}

function calculateNewMode(
  mode: number,
  strategy: PermissionStrategy
): number | null {
  if (strategy === "safe") {
    const readBits = mode & 0o444;
    const executeBits = ((readBits >> 2) | (readBits >> 1) | readBits) & 0o111;
    if (executeBits === 0) {
      return null;
    }
    return mode | executeBits;
  }

  return mode | 0o111;
}

//
// Error reporting
//

function reportError(document: vscode.TextDocument, error: any) {
  const filePath = document?.uri?.fsPath ?? "unknown";

  if (error?.code === "EACCES") {
    console.warn(
      `[mark-executable-on-save] Permission denied for file: ${filePath}`
    );
    return;
  }

  if (error?.code === "ENOENT") {
    console.warn(`[mark-executable-on-save] File not found: ${filePath}`);
    return;
  }

  console.error(
    `[mark-executable-on-save] Unexpected error for file ${filePath}:`,
    error
  );
}

//
// Announcement
//

async function announceModeChange(
  document: vscode.TextDocument,
  oldMode: number,
  newMode: number
): Promise<void> {
  const relativePath = formatRelativePath(document.uri);
  const message =
    `${relativePath}: Made executable (` +
    `${formatMode(oldMode)} -> ${formatMode(newMode)})`;

  await vscode.window.showInformationMessage(message);
}

function formatRelativePath(uri: vscode.Uri): string {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
  if (!workspaceFolder) {
    return basename(uri.fsPath);
  }

  const relativePath = relative(workspaceFolder.uri.fsPath, uri.fsPath);
  return relativePath || basename(uri.fsPath);
}

function formatMode(mode: number): string {
  return mode.toString(8).padStart(3, "0");
}
