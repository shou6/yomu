import * as vscode from 'vscode';
import type { ToWebview } from './reader/messages';
import { decideOpenInReader } from './reader/openInReader';
import { ReaderProvider } from './reader/readerProvider';

/** activate が返す API。統合テストが Webview へのメッセージを観測するために使う */
export interface YomuApi {
  onDidPostMessage: vscode.Event<ToWebview>;
  /** アクティブなリーダーの本文を印刷用の HTML に書き出し、そのパスを返す（ブラウザは開かない） */
  exportForPrint(): Promise<string | undefined>;
}

/** エントリポイント。登録だけを行い、ロジックは各モジュールに置く */
export function activate(context: vscode.ExtensionContext): YomuApi {
  const provider = ReaderProvider.register(context);
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
    // リーダーから編集に戻る。タイトルバーのボタンからは、そのタブの URI が渡る
    vscode.commands.registerCommand('yomu.openInTextEditor', async (uri?: vscode.Uri) => {
      const target = uri instanceof vscode.Uri ? uri : provider.activeDocumentUri();
      if (target !== undefined) {
        await vscode.commands.executeCommand('vscode.openWith', target, 'default');
      }
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
  };
}

export function deactivate(): void {}
