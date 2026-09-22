import * as vscode from 'vscode';
import type { ToWebview } from './reader/messages';
import { decideOpenInReader } from './reader/openInReader';
import { ReaderProvider } from './reader/readerProvider';

/** activate が返す API。統合テストが Webview へのメッセージを観測するために使う */
export interface YomuApi {
  onDidPostMessage: vscode.Event<ToWebview>;
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
  context.subscriptions.push(
    // 集中モードはユーザー設定で持つ。コマンドはその値を反転するだけ
    vscode.commands.registerCommand('yomu.toggleFocusMode', async () => {
      const config = vscode.workspace.getConfiguration('yomu');
      await config.update(
        'focusMode',
        config.get<boolean>('focusMode') !== true,
        vscode.ConfigurationTarget.Global
      );
    })
  );
  return { onDidPostMessage: provider.onDidPostMessage };
}

export function deactivate(): void {}
