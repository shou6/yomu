/**
 * リーダータブの Custom Text Editor Provider（vscode 依存。統合テストで検証する）。
 * 変換と HTML の組み立ては純粋関数（render、webviewHtml、resourceRoots）に任せ、
 * ここでは VS Code とのやり取りだけを持つ。
 */
import * as crypto from 'crypto';
import * as vscode from 'vscode';
import { classifyLink } from './links';
import type { FromWebview, ToWebview } from './messages';
import { render } from './render';
import { resourceRoots } from './resourceRoots';
import { webviewHtml } from './webviewHtml';

/** 編集の追従のデバウンス（ms） */
const UPDATE_DELAY = 200;

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
      const message: ToWebview = {
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
    const messageSubscription = webview.onDidReceiveMessage((message: FromWebview) => {
      if (message.type === 'openLink') {
        void openLink(message.href, documentDir);
      }
    });
    panel.onDidDispose(() => {
      clearTimeout(timer);
      changeSubscription.dispose();
      messageSubscription.dispose();
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

/**
 * Webview でクリックされたリンクを開く。
 * 外部は既定のブラウザ、相対パスは標準エディタ（要件定義 4.6 節）。文書内の移動は Webview 側で済ませている
 */
async function openLink(href: string, documentDir: vscode.Uri): Promise<void> {
  const link = classifyLink(href);
  if (link.kind === 'external') {
    await vscode.env.openExternal(vscode.Uri.parse(link.href));
  } else if (link.kind === 'relative' && link.path !== '') {
    await vscode.commands.executeCommand(
      'vscode.open',
      vscode.Uri.joinPath(documentDir, link.path)
    );
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
