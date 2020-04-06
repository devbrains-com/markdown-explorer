// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { MarkdownProvider } from "./markdownProvider";

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  const markdownProvider = new MarkdownProvider(vscode.workspace.rootPath);
  vscode.window.registerTreeDataProvider("markdown-list", markdownProvider);

  vscode.commands.registerCommand("markdown-list.refreshEntry", () =>
    markdownProvider.refresh()
  );

  vscode.commands.registerCommand("markdown-list.openPreview", (element) => {
    console.log("on command open Preview openWith", element);
    vscode.commands.executeCommand(
      "vscode.openWith",
      element.resourceUri,
      "vscode.markdown.preview.editor"
    );
  });

  vscode.commands.registerCommand("markdown-list.openEdit", (element) => {
    console.log("on command edit", element);
    vscode.commands.executeCommand(
      "vscode.openWith",
      element.resourceUri,
      "default"
    );
  });

  vscode.commands.registerCommand("markdown-list.viewInExplorer", (element) => {
    console.log("on command view in explorer", element);
    vscode.commands.executeCommand("revealInExplorer", element.resourceUri);
  });
}

// this method is called when your extension is deactivated
export function deactivate() {}
