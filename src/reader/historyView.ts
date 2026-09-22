/**
 * Yomu の中の「読書の記録」のビュー（vscode 依存。統合テストで検証する）。
 * 最近読んだ文書を新しい順に、読んだ割合つきで並べる。クリックでリーダーの続きから開く。
 */
import * as vscode from 'vscode';
import { formatProgress, type ReadingRecord } from './reading';
import type { ReadingHistory } from './readingHistory';

type Item = ReadingRecord & { uri: string };

export class HistoryView implements vscode.TreeDataProvider<Item> {
  private readonly changeEmitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.changeEmitter.event;

  static register(context: vscode.ExtensionContext, history: ReadingHistory): HistoryView {
    const view = new HistoryView(history);
    context.subscriptions.push(
      vscode.window.registerTreeDataProvider('yomu.history', view),
      view.changeEmitter,
      history.onDidChange(() => view.changeEmitter.fire())
    );
    return view;
  }

  constructor(private readonly history: ReadingHistory) {}

  getChildren(item?: Item): Item[] {
    return item === undefined ? this.history.recent() : [];
  }

  getTreeItem(item: Item): vscode.TreeItem {
    const uri = vscode.Uri.parse(item.uri);
    const tree = new vscode.TreeItem(item.title, vscode.TreeItemCollapsibleState.None);
    tree.id = item.uri;
    tree.description = formatProgress(item.progress);
    tree.tooltip = `${uri.fsPath}\n${formatProgress(item.progress)} · ${new Date(item.lastRead).toLocaleString()}`;
    // 最後まで読んだ文書は印を変える
    tree.iconPath = new vscode.ThemeIcon(item.progress >= 0.99 ? 'pass' : 'book');
    tree.resourceUri = uri;
    tree.command = {
      command: 'yomu.openInReader',
      title: item.title,
      arguments: [uri],
    };
    return tree;
  }
}
