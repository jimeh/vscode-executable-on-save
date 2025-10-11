import * as vscode from "vscode";
import { processDocument } from "./document-handler";

/**
 * Activates the extension.
 * Registers the save hook and manual command.
 */
export function activate(context: vscode.ExtensionContext): void {
  const onSaveHook = vscode.workspace.onDidSaveTextDocument(processDocument);

  const command = vscode.commands.registerCommand(
    "mark-executable-on-save.markExecutableIfScript",
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }

      await processDocument(editor.document);
    }
  );

  context.subscriptions.push(onSaveHook, command);
}

/**
 * Deactivates the extension.
 */
export function deactivate(): void {}
