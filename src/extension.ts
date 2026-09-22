import * as vscode from 'vscode';
import { decideOpenInReader } from './reader/openInReader';
import { ReaderProvider } from './reader/readerProvider';

/** エントリポイント。登録だけを行い、ロジックは各モジュールに置く */
export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    ReaderProvider.register(context),
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
}

export function deactivate(): void {}
