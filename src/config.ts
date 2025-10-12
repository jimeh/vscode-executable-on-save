import * as vscode from "vscode";
import { type Strategy } from "./permissions";

/**
 * Extension configuration settings.
 */
export interface Config {
  enabled: boolean;
  strategy: Strategy;
  silent: boolean;
  silentErrors: boolean;
}

/**
 * Reads the extension configuration from the workspace.
 *
 * @param document - The document to get configuration for (supports
 *                   resource-specific configuration)
 * @returns The extension configuration
 */
export function readConfiguration(document: vscode.TextDocument): Config {
  const config = vscode.workspace.getConfiguration(
    "executableOnSave",
    document.uri
  );

  return {
    enabled: config.get<boolean>("enabled", true),
    strategy: config.get<Strategy>("permissionStrategy", "safe"),
    silent: config.get<boolean>("silent", false),
    silentErrors: config.get<boolean>("silentErrors", false),
  };
}
