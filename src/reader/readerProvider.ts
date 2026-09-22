/**
 * リーダータブの Custom Text Editor Provider（vscode 依存。統合テストで検証する）。
 * 変換と HTML の組み立ては純粋関数（render、webviewHtml、resourceRoots）に任せ、
 * ここでは VS Code とのやり取りだけを持つ。
 */
import * as crypto from 'crypto';
import * as vscode from 'vscode';
import { render } from './render';
import { resourceRoots } from './resourceRoots';
import { webviewHtml } from './webviewHtml';

/** 編集の追従のデバウンス（ms） */
const UPDATE_DELAY = 200;

/** 拡張機能側から Webview へ送るメッセージ */
export type ReaderMessage = { type: 'update'; html: string };

export class ReaderProvider implements vscode.CustomTextEditorProvider {
  static readonly viewType = 'yomu.reader';

  static register(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.window.registerCustomEditorProvider(
      ReaderProvider.viewType,
      new ReaderProvider(context.extensionUri),
      {
        // VS Code 標準の検索ウィジェット（Ctrl+F）を Webview の中で使えるようにする
        webviewOptions: { enableFindWidget: true, retainContextWhenHidden: false },
        supportsMultipleEditorsPerDocument: true,
      }
    );
  }

  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveCustomTextEditor(
    document: vscode.TextDocument,
    panel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): void {
    const documentDir = vscode.Uri.joinPath(document.uri, '..');
    const webview = panel.webview;

    webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, 'media'),
        vscode.Uri.joinPath(this.extensionUri, 'dist'),
        ...this.documentResourceRoots(documentDir),
      ],
    };
    webview.html = webviewHtml({
      nonce: crypto.randomBytes(16).toString('base64'),
      cspSource: webview.cspSource,
      styleUris: ['reader.css', 'theme.css'].map((file) =>
        webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', file)).toString()
      ),
      scriptUri: webview
        .asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview.js'))
        .toString(),
    });

    const resolveImageSrc = (src: string): string =>
      webview.asWebviewUri(vscode.Uri.joinPath(documentDir, decodePath(src))).toString();
    const update = (): void => {
      const message: ReaderMessage = {
        type: 'update',
        html: render(document.getText(), { resolveImageSrc }),
      };
      void webview.postMessage(message);
    };

    let timer: NodeJS.Timeout | undefined;
    const changeSubscription = vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.uri.toString() !== document.uri.toString()) {
        return;
      }
      clearTimeout(timer);
      timer = setTimeout(update, UPDATE_DELAY);
    });
    panel.onDidDispose(() => {
      clearTimeout(timer);
      changeSubscription.dispose();
    });

    update();
  }

  /** ワークスペースフォルダと、ワークスペース外ならドキュメントのフォルダ */
  private documentResourceRoots(documentDir: vscode.Uri): vscode.Uri[] {
    const folders = (vscode.workspace.workspaceFolders ?? []).map((folder) => folder.uri);
    const byPath = new Map([documentDir, ...folders].map((uri) => [uri.fsPath, uri]));
    return resourceRoots(
      documentDir.fsPath,
      folders.map((uri) => uri.fsPath)
    ).map((fsPath) => byPath.get(fsPath) ?? vscode.Uri.file(fsPath));
  }
}

/** markdown-it がパーセントエンコードした相対パス（`my%20img.png`）を元に戻す */
function decodePath(src: string): string {
  try {
    return decodeURIComponent(src);
  } catch {
    return src;
  }
}
