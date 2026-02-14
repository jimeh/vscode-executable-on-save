import * as vscode from 'vscode';
import { chmod, stat } from 'node:fs/promises';
import { calculateNewMode, isExecutable } from './permissions';
import { announceModeChange, reportError } from './notifications';
import { type Config, readConfiguration } from './config';

/**
 * Processes a document on save or manual command invocation.
 * Checks if the document has a shebang and makes it executable if needed.
 *
 * @param doc - The document to process
 */
export async function processDocument(doc: vscode.TextDocument): Promise<void> {
  const config = readConfiguration(doc);
  try {
    await handleDocument(doc, config);
  } catch (error: any) {
    void reportError(doc, error, config);
  }
}

/**
 * Main document processing flow.
 * Checks platform, config, shebang, and applies chmod if needed.
 */
async function handleDocument(
  document: vscode.TextDocument,
  config: Config
): Promise<void> {
  if (shouldSkipDocument(document)) {
    return;
  }

  const shebang = readShebang(document);
  if (!startsWithShebang(shebang)) {
    return;
  }

  const filePath = document.uri.fsPath;
  const fileStat = await stat(filePath);

  if (isExecutable(fileStat.mode)) {
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

/**
 * Determines if a document should be skipped from processing.
 *
 * @returns true if the document should be skipped
 */
function shouldSkipDocument(document: vscode.TextDocument): boolean {
  if (process.platform === 'win32') {
    return true;
  }

  if (!vscode.workspace.isTrusted) {
    return true;
  }

  if (document.isUntitled) {
    return true;
  }

  return document.uri.scheme !== 'file';
}

/**
 * Reads the first two characters of a document to check for shebang.
 */
function readShebang(document: vscode.TextDocument): string {
  const start = new vscode.Position(0, 0);
  const end = new vscode.Position(0, 2);
  const range = new vscode.Range(start, end);
  const validatedRange = document.validateRange(range);
  return document.getText(validatedRange);
}

/**
 * Checks if a string starts with "#!".
 */
function startsWithShebang(str: string): boolean {
  return str.startsWith('#!');
}
