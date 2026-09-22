/**
 * ステータスバーの読了の割合（vscode 依存）。リーダーがアクティブな時だけ「📖 42%」を出す。
 * 押すと Yomu の目次を開く。
 */
import * as vscode from 'vscode';
import { formatProgress } from './reading';
import type { ReaderProvider } from './readerProvider';
import type { ReadingHistory } from './readingHistory';

export class ProgressStatus {
  private readonly item = vscode.window.createStatusBarItem(
    'yomu.progress',
    vscode.StatusBarAlignment.Right,
    100
  );

  static register(
    context: vscode.ExtensionContext,
    reader: ReaderProvider,
    history: ReadingHistory
  ): ProgressStatus {
    const status = new ProgressStatus(reader, history);
    context.subscriptions.push(
      status.item,
      reader.onDidChangeActiveReader(() => status.refresh()),
      reader.onDidChangeProgress(() => status.refresh())
    );
    status.refresh();
    return status;
  }

  constructor(
    private readonly reader: ReaderProvider,
    private readonly history: ReadingHistory
  ) {
    this.item.name = 'Yomu';
    this.item.command = 'yomu.outline.focus';
  }

  /** 出している文字。出していなければ undefined */
  text(): string | undefined {
    return this.shown ? this.item.text : undefined;
  }

  private shown = false;

  private refresh(): void {
    const document = this.reader.activeDocument();
    // 開いた直後でリーダーからまだ割合が届いていない時は、前回の読書の記録の割合を出す
    const progress =
      document === undefined
        ? undefined
        : (this.reader.activeProgress() ?? this.history.get(document.uri)?.progress);
    if (progress === undefined) {
      this.item.hide();
      this.shown = false;
      return;
    }
    this.item.text = '$(book) ' + formatProgress(progress);
    this.item.tooltip = vscode.l10n.t('Yomu: {0} read', formatProgress(progress));
    this.item.show();
    this.shown = true;
  }
}
