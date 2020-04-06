// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

function handleResult<T>(
  resolve: (result: T) => void,
  reject: (error: Error) => void,
  error: Error | null | undefined,
  result: T
): void {
  if (error) {
    reject(massageError(error));
  } else {
    resolve(result);
  }
}

function massageError(error: Error & { code?: string }): Error {
  if (error.code === "ENOENT") {
    return vscode.FileSystemError.FileNotFound();
  }

  if (error.code === "EISDIR") {
    return vscode.FileSystemError.FileIsADirectory();
  }

  if (error.code === "EEXIST") {
    return vscode.FileSystemError.FileExists();
  }

  if (error.code === "EPERM" || error.code === "EACCESS") {
    return vscode.FileSystemError.NoPermissions();
  }

  return error;
}

function normalizeNFC(items: string): string;
function normalizeNFC(items: string[]): string[];
function normalizeNFC(items: string | string[]): string | string[] {
  if (process.platform !== "darwin") {
    return items;
  }

  if (Array.isArray(items)) {
    return items.map((item) => item.normalize("NFC"));
  }

  return items.normalize("NFC");
}

export function readdir(path: string): Promise<string[]> {
  return new Promise<string[]>((resolve, reject) => {
    fs.readdir(path, (error, children) =>
      handleResult(resolve, reject, error, normalizeNFC(children))
    );
  });
}

export class MarkdownProvider implements vscode.TreeDataProvider<MarkdownFile> {
  constructor(private workspaceRoot?: string) {}
  private _onDidChangeTreeData: vscode.EventEmitter<
    MarkdownFile | undefined
  > = new vscode.EventEmitter<MarkdownFile | undefined>();
  readonly onDidChangeTreeData: vscode.Event<MarkdownFile | undefined> = this
    ._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: MarkdownFile): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: MarkdownFile): Promise<MarkdownFile[]> {
    if (!this.workspaceRoot) {
      vscode.window.showInformationMessage("No markdowns in empty workspace");
      return Promise.resolve([]);
    }

    if (!element) {
      return Promise.resolve(this.getMarkdownsInPath(this.workspaceRoot));
    } else if (element.directoryPath) {
      return Promise.resolve(this.getMarkdownsInPath(element.directoryPath));
    }

    return Promise.resolve([]);
  }

  private async hasChildMarkdowns(currentPath: string): Promise<boolean> {
    const fileNames = await readdir(currentPath);

    if (fileNames.find((fileName) => path.extname(fileName) === ".md")) {
      return true;
    }

    for (let i = 0; i < fileNames.length; i++) {
      const fullPath = path.join(currentPath, fileNames[i]);
      if (
        fs.lstatSync(fullPath).isDirectory() &&
        (await this.hasChildMarkdowns(fullPath))
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Given the path to package.json, read all its dependencies and devDependencies.
   */
  private async getMarkdownsInPath(
    currentPath: string
  ): Promise<MarkdownFile[]> {
    if (!currentPath || !this.pathExists(currentPath)) {
      return [];
    }

    const fileNames = await readdir(currentPath);
    const entries: MarkdownFile[] = [];

    for (let i = 0; i < fileNames.length; i++) {
      const fileName = fileNames[i];

      const fullPath = path.join(currentPath, fileName);
      const ext = path.extname(fileName);
      const label = path.basename(fileName, ext);

      if (entries.find((entry) => entry.label === label)) {
        continue;
      }

      let directoryPath: string | undefined;
      let filePath: string | undefined;

      const isDirectory = fs.lstatSync(fullPath).isDirectory();
      if (isDirectory) {
        if (!(await this.hasChildMarkdowns(fullPath))) {
          continue;
        }

        directoryPath = fullPath;

        // check if file also exists
        if (fileNames.includes(label + ".md")) {
          filePath = fullPath + ".md";
        }
      } else if (ext === ".md") {
        filePath = fullPath;

        // check if directory also exists
        if (fileNames.includes(label)) {
          directoryPath = path.join(currentPath, label);
        }
      }

      if (directoryPath || filePath) {
        entries.push(new MarkdownFile(label, filePath, directoryPath));
      }
    }

    return entries;
  }

  private pathExists(p: string): boolean {
    try {
      fs.accessSync(p);
    } catch (err) {
      return false;
    }
    return true;
  }
}

class MarkdownFile extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly filePath?: string,
    public readonly directoryPath?: string
  ) {
    super(label);

    this.isFile = !!filePath;
    this.isDirectory = !!directoryPath;

    this.resourceUri = vscode.Uri.file(filePath || directoryPath || "");

    if (this.isFile) {
      this.contextValue = "file";
      this.command = {
        command: "markdown-list.openPreview",
        title: "Open File",
        arguments: [this],
      };
    }

    if (this.isDirectory) {
      this.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
      this.contextValue = (this.contextValue || "") + "folder";
    }
  }

  isFile: boolean;
  isDirectory: boolean;

  get tooltip(): string {
    return `${this.label} - ${this.filePath || this.directoryPath}`;
  }
}
