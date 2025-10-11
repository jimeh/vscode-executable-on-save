import * as vscode from "vscode";
import { basename, relative } from "node:path";
import { type Config } from "./config";

/**
 * Configuration subset used for notifications.
 */
type NotificationConfig = Pick<Config, "silent" | "silentErrors">;

/**
 * Formats a file mode as an octal string (e.g., 755).
 */
function formatMode(mode: number): string {
  return mode.toString(8).padStart(3, "0");
}

/**
 * Formats a URI as a relative path from the workspace root, or basename
 * if outside the workspace.
 */
function formatRelativePath(uri: vscode.Uri): string {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
  if (!workspaceFolder) {
    return basename(uri.fsPath);
  }

  const relativePath = relative(workspaceFolder.uri.fsPath, uri.fsPath);
  return relativePath || basename(uri.fsPath);
}

/**
 * Shows an information message announcing that file permissions were changed.
 *
 * @param document - The document whose permissions changed
 * @param oldMode - The previous permission mode (e.g., 0o644)
 * @param newMode - The new permission mode (e.g., 0o755)
 */
export async function announceModeChange(
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

/**
 * Reports an error that occurred while processing a document.
 * Logs to console and shows an error notification based on config.
 *
 * @param document - The document being processed
 * @param error - The error that occurred
 * @param config - Notification configuration
 */
export async function reportError(
  document: vscode.TextDocument,
  error: any,
  config: NotificationConfig
): Promise<void> {
  const uri = document?.uri;
  const filePath = uri?.fsPath ?? "unknown";
  const relativePath = uri ? formatRelativePath(uri) : filePath;
  let message = `${relativePath}: Unexpected error.`;

  switch (error?.code) {
    case "EACCES":
      message = `${relativePath}: Permission denied when updating permissions.`;
      break;

    case "ENOENT":
      message = `${relativePath}: File no longer exists.`;
      break;

    default: {
      const details = error instanceof Error ? error.message : String(error);
      message = `${relativePath}: Unexpected error – ${details}`;
      console.error(
        `[mark-executable-on-save] Unexpected error for file ${filePath}:`,
        error
      );
      break;
    }
  }

  console.warn(`[mark-executable-on-save] ${message}`);
  await showErrorMessage(message, config);
}

/**
 * Shows an error message to the user, respecting silent configuration.
 *
 * @param message - The error message to display
 * @param config - Notification configuration
 */
export async function showErrorMessage(
  message: string,
  config: NotificationConfig
): Promise<void> {
  if (config.silent || config.silentErrors) {
    return;
  }

  await vscode.window.showErrorMessage(message);
}
