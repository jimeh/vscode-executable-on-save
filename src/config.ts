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
 * Checks if the extension is enabled for on-save processing.
 * Lightweight check that only reads the enabled setting.
 *
 * @param document - The document to check configuration for
 * @returns True if the extension is enabled for on-save processing
 */
export function onSaveEnabled(document: vscode.TextDocument): boolean {
  const config = vscode.workspace.getConfiguration(
    "executableOnSave",
    document.uri
  );
  return config.get<boolean>("enabled", true);
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
    strategy: config.get<Strategy>("permissionStrategy", "umask"),
    silent: config.get<boolean>("silent", false),
    silentErrors: config.get<boolean>("silentErrors", false),
  };
}
