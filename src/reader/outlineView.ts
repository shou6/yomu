/**
 * エクスプローラーの「Yomu 目次」のビュー（vscode 依存。統合テストで検証する）。
 * アクティブなリーダーの見出しをツリーで出し、クリックでその見出しへ移動する。
 * リーダーをスクロールすると、今読んでいる見出しを選んだ状態にする。
 */
import * as vscode from 'vscode';
import { buildOutline, extractHeadings, type OutlineNode } from './outline';
import type { ReaderProvider } from './readerProvider';

export class OutlineView implements vscode.TreeDataProvider<OutlineNode> {
  private readonly changeEmitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.changeEmitter.event;

  /** 作った目次と、その元になった文書の版 */
  private cache: { uri: string; version: number; roots: OutlineNode[] } | undefined;

  private view: vscode.TreeView<OutlineNode> | undefined;

  static register(context: vscode.ExtensionContext, reader: ReaderProvider): OutlineView {
    const outline = new OutlineView(reader);
    outline.view = vscode.window.createTreeView('yomu.outline', { treeDataProvider: outline });
    context.subscriptions.push(
      outline.view,
      outline.changeEmitter,
      reader.onDidChangeActiveReader(() => outline.changeEmitter.fire()),
      reader.onDidChangePosition((id) => outline.select(id)),
      vscode.commands.registerCommand('yomu.revealHeading', (id: string) =>
        reader.revealHeading(id)
      )
    );
    return outline;
  }

  constructor(private readonly reader: ReaderProvider) {}

  /** アクティブなリーダーの目次の、一番上の階層 */
  roots(): OutlineNode[] {
    const document = this.reader.activeDocument();
    if (document === undefined) {
      return [];
    }
    const uri = document.uri.toString();
    if (this.cache?.uri !== uri || this.cache.version !== document.version) {
      this.cache = {
        uri,
        version: document.version,
        roots: buildOutline(extractHeadings(document.getText())),
      };
    }
    return this.cache.roots;
  }

  getChildren(node?: OutlineNode): OutlineNode[] {
    return node === undefined ? this.roots() : node.children;
  }

  getParent(node: OutlineNode): OutlineNode | undefined {
    return node.parent;
  }

  getTreeItem(node: OutlineNode): vscode.TreeItem {
    const item = new vscode.TreeItem(
      node.heading.text,
      node.children.length > 0
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.None
    );
    item.id = node.heading.id;
    item.description = 'H' + node.heading.level;
    item.command = {
      command: 'yomu.revealHeading',
      title: node.heading.text,
      arguments: [node.heading.id],
    };
    return item;
  }

  /** 今読んでいる見出しを選んだ状態にする。ビューが見えていない時は何もしない */
  private select(id: string | null): void {
    if (id === null || this.view?.visible !== true) {
      return;
    }
    const find = (nodes: OutlineNode[]): OutlineNode | undefined => {
      for (const node of nodes) {
        const found = node.heading.id === id ? node : find(node.children);
        if (found !== undefined) {
          return found;
        }
      }
      return undefined;
    };
    const node = find(this.roots());
    if (node !== undefined) {
      void this.view.reveal(node, { select: true, focus: false, expand: true });
    }
  }
}
