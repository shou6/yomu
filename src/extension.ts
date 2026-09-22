import * as vscode from 'vscode';
import type { ToWebview } from './reader/messages';
import { decideOpenInReader } from './reader/openInReader';
import { HistoryView } from './reader/historyView';
import { OutlineView } from './reader/outlineView';
import { ProgressStatus } from './reader/progressStatus';
import { ReadingHistory } from './reader/readingHistory';
import { ReaderProvider } from './reader/readerProvider';

/** activate が返す API。統合テストが Webview へのメッセージを観測するために使う */
export interface YomuApi {
  onDidPostMessage: vscode.Event<ToWebview>;
  /** アクティブなリーダーの本文を印刷用の HTML に書き出し、そのパスを返す（ブラウザは開かない） */
  exportForPrint(): Promise<string | undefined>;
  /** 目次のビューに出している、一番上の階層の見出しの ID */
  outlineIds(): string[];
  /** 目次のビューが開いて見えているか */
  outlineVisible(): boolean;
  /** 読書の記録（新しい順） */
  readingHistory(): { uri: string; title: string; progress: number }[];
  /** 読書の記録を書き換える（テスト用） */
  recordProgress(uri: vscode.Uri, progress: number): Promise<void>;
  /** ステータスバーに出している文字。出していなければ undefined */
  statusBarText(): string | undefined;
}

/** エントリポイント。登録だけを行い、ロジックは各モジュールに置く */
export function activate(context: vscode.ExtensionContext): YomuApi {
  const history = new ReadingHistory(context.globalState);
  context.subscriptions.push(history);
  const provider = ReaderProvider.register(context, history);
  const outline = OutlineView.register(context, provider);
  HistoryView.register(context, history);
  const status = ProgressStatus.register(context, provider, history);
  context.subscriptions.push(
    // タイトルバーのアイコンやエクスプローラーからは URI が渡る。コマンドパレットからは渡らない
    vscode.commands.registerCommand('yomu.openInReader', async (uri?: vscode.Uri) => {
      const active = vscode.window.activeTextEditor?.document;
      const target =
        uri instanceof vscode.Uri
          ? { uri, fileName: uri.path }
          : active
            ? { uri: active.uri, fileName: active.fileName }
            : undefined;
      const decision = decideOpenInReader(target, vscode.l10n.t);
      if (decision.kind === 'open') {
        await vscode.commands.executeCommand(
          'vscode.openWith',
          decision.uri,
          ReaderProvider.viewType
        );
      } else {
        void vscode.window.showInformationMessage(decision.message);
      }
    })
  );
  // 集中モードはユーザー設定で持つ。コマンドはその値を書き換えるだけ
  const setFocusMode = (on: boolean): Thenable<void> =>
    vscode.workspace
      .getConfiguration('yomu')
      .update('focusMode', on, vscode.ConfigurationTarget.Global);
  context.subscriptions.push(
    vscode.commands.registerCommand('yomu.toggleFocusMode', () =>
      setFocusMode(vscode.workspace.getConfiguration('yomu').get<boolean>('focusMode') !== true)
    ),
    // リーダータブの右上のボタン。オンとオフで別のアイコンを出すため、コマンドを分ける
    vscode.commands.registerCommand('yomu.enableFocusMode', () => setFocusMode(true)),
    vscode.commands.registerCommand('yomu.disableFocusMode', () => setFocusMode(false)),
    // リーダーから編集に戻る。今読んでいる箇所の行にカーソルを置く（ソースへのジャンプ）。
    // タイトルバーのボタンからは、そのタブの URI が渡る
    vscode.commands.registerCommand('yomu.openInTextEditor', async (uri?: vscode.Uri) => {
      const target = uri instanceof vscode.Uri ? uri : provider.activeDocumentUri();
      if (target === undefined) {
        return;
      }
      const line = (await provider.readingLine(target)) ?? 0;
      await vscode.commands.executeCommand('vscode.openWith', target, 'default');
      const position = new vscode.Position(line, 0);
      await vscode.window.showTextDocument(target, {
        selection: new vscode.Range(position, position),
      });
      vscode.window.activeTextEditor?.revealRange(
        new vscode.Range(position, position),
        vscode.TextEditorRevealType.InCenter
      );
    })
  );
  context.subscriptions.push(
    // Webview は印刷に対応していないので、1 つの HTML に書き出してブラウザで開き、ブラウザの印刷を使う
    vscode.commands.registerCommand('yomu.openInBrowser', async () => {
      const file = await provider.exportForPrint();
      if (file === undefined) {
        void vscode.window.showInformationMessage(
          vscode.l10n.t('Open a Markdown file in the Yomu reader first.')
        );
        return;
      }
      await vscode.env.openExternal(vscode.Uri.file(file));
    })
  );
  return {
    onDidPostMessage: provider.onDidPostMessage,
    exportForPrint: () => provider.exportForPrint(),
    outlineIds: () => outline.roots().map((node) => node.heading.id),
    outlineVisible: () => outline.visible(),
    readingHistory: () =>
      history.recent().map(({ uri, title, progress }) => ({ uri, title, progress })),
    recordProgress: (uri, progress) =>
      history.record(uri, uri.path.split('/').pop() ?? '', progress),
    statusBarText: () => status.text(),
  };
}

export function deactivate(): void {}
