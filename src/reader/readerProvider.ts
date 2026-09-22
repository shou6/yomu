/**
 * リーダータブの Custom Text Editor Provider（vscode 依存。統合テストで検証する）。
 * 変換、HTML の組み立て、設定の変換は純粋関数（render、webviewHtml、resourceRoots、readerSettings、customCss）に任せ、
 * ここでは VS Code とのやり取りだけを持つ。
 */
import * as crypto from 'crypto';
import * as path from 'path';
import * as vscode from 'vscode';
import { resolveCustomCss } from './customCss';
import { classifyLink } from './links';
import type { FromWebview, ToWebview } from './messages';
import {
  cssVariables,
  normalizeSettings,
  type RawSettings,
  type ReaderSettings,
} from './readerSettings';
import { renderSafely } from './render';
import { resourceRoots } from './resourceRoots';
import { webviewHtml } from './webviewHtml';

/** 編集の追従のデバウンス（ms） */
const UPDATE_DELAY = 200;

/** 設定の接頭辞 */
const CONFIG_SECTION = 'yomu';

/** Webview に配る CSS。テーマは全部読み込み、body の data-theme で切り替える。vscode.css は最後（ハイコントラストの上書きのため） */
const STYLE_FILES = [
  'fonts.css',
  'reader.css',
  'highlight.css',
  'themes/paper.css',
  'themes/sepia.css',
  'themes/dark.css',
  'themes/vscode.css',
];

/** 開いているリーダータブ 1 つ分 */
interface Entry {
  panel: vscode.WebviewPanel;
  /** カスタム CSS のフォルダを除いた localResourceRoots */
  baseRoots: vscode.Uri[];
}

export class ReaderProvider implements vscode.CustomTextEditorProvider {
  static readonly viewType = 'yomu.reader';

  /** 開いているリーダータブ。設定の変更をすべてに配るために持つ */
  private readonly entries = new Set<Entry>();

  private readonly postMessageEmitter = new vscode.EventEmitter<ToWebview>();
  /** Webview へ送ったメッセージ。統合テストが観測するために公開する */
  readonly onDidPostMessage: vscode.Event<ToWebview> = this.postMessageEmitter.event;

  /** カスタム CSS の保存を拾う。設定のパスが変わったら作り直す */
  private customCssWatcher: { path: string; watcher: vscode.FileSystemWatcher } | undefined;

  /** 同じ問題を何度も通知しないための記録 */
  private readonly notified = new Set<string>();

  static register(context: vscode.ExtensionContext): ReaderProvider {
    const provider = new ReaderProvider(context.extensionUri);
    context.subscriptions.push(
      vscode.window.registerCustomEditorProvider(ReaderProvider.viewType, provider, {
        // VS Code 標準の検索ウィジェット（Ctrl+F）を Webview の中で使えるようにする
        webviewOptions: { enableFindWidget: true, retainContextWhenHidden: false },
        supportsMultipleEditorsPerDocument: true,
      }),
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration(CONFIG_SECTION)) {
          // 通知はパスごとに一度だけ。設定を変えたら改めて知らせる
          provider.notified.clear();
          provider.broadcastSettings();
        }
      }),
      provider.postMessageEmitter,
      { dispose: () => provider.customCssWatcher?.watcher.dispose() }
    );
    return provider;
  }

  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveCustomTextEditor(
    document: vscode.TextDocument,
    panel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): void {
    const documentDir = vscode.Uri.joinPath(document.uri, '..');
    const webview = panel.webview;
    const entry: Entry = {
      panel,
      baseRoots: [
        vscode.Uri.joinPath(this.extensionUri, 'media'),
        vscode.Uri.joinPath(this.extensionUri, 'dist'),
        vscode.Uri.joinPath(this.extensionUri, 'fonts'),
        ...this.documentResourceRoots(documentDir),
      ],
    };

    webview.options = { enableScripts: true, localResourceRoots: entry.baseRoots };
    webview.html = webviewHtml({
      nonce: crypto.randomBytes(16).toString('base64'),
      cspSource: webview.cspSource,
      styleUris: STYLE_FILES.map((file) =>
        webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', file)).toString()
      ),
      scriptUri: webview
        .asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview.js'))
        .toString(),
    });

    const resolveImageSrc = (src: string): string =>
      webview.asWebviewUri(vscode.Uri.joinPath(documentDir, decodePath(src))).toString();
    const update = (): void => {
      this.post(panel, {
        type: 'update',
        html: renderSafely(document.getText(), { resolveImageSrc }),
      });
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
      if (message.type === 'ready') {
        // 本文より先に見た目を決めておく。本文が出た後に幅やフォントが変わって見えるのを避ける。
        // retainContextWhenHidden を使わないので、タブを隠して戻すたびに Webview が作り直されてここに来る
        void this.sendSettings(entry).then(update);
      } else if (message.type === 'openLink') {
        void openLink(message.href, documentDir);
      }
    });
    this.entries.add(entry);
    panel.onDidDispose(() => {
      clearTimeout(timer);
      changeSubscription.dispose();
      messageSubscription.dispose();
      this.entries.delete(entry);
    });
  }

  /** 設定を読み、検査して返す */
  readSettings(): ReaderSettings {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    const raw: RawSettings = {
      theme: config.get('theme'),
      maxWidth: config.get('layout.maxWidth'),
      align: config.get('layout.align'),
      padding: config.get('layout.padding'),
      fontFamily: config.get('font.family'),
      codeFontFamily: config.get('font.codeFamily'),
      fontSize: config.get('font.size'),
      lineHeight: config.get('font.lineHeight'),
      customCss: config.get('customCss'),
    };
    return normalizeSettings(raw);
  }

  private async sendSettings(entry: Entry): Promise<void> {
    const settings = this.readSettings();
    const customCss = await this.customCssUri(entry, settings.customCss);
    this.post(entry.panel, {
      type: 'settings',
      theme: settings.theme,
      cssVariables: cssVariables(settings),
      ...(customCss === undefined ? {} : { customCssUri: customCss }),
    });
  }

  /** 設定が変わった時に、開いているすべてのリーダータブへ配る */
  private broadcastSettings(): void {
    for (const entry of this.entries) {
      void this.sendSettings(entry);
    }
  }

  /**
   * カスタム CSS の Webview URI。無ければ undefined。
   * ファイルのあるフォルダを localResourceRoots に足し、保存を拾う watcher を張る
   */
  private async customCssUri(entry: Entry, setting: string): Promise<string | undefined> {
    const folders = (vscode.workspace.workspaceFolders ?? []).map((folder) => folder.uri.fsPath);
    const resolved = resolveCustomCss(setting, folders);
    if (resolved === undefined) {
      this.watchCustomCss(undefined);
      return undefined;
    }
    if ('error' in resolved) {
      this.notifyOnce(
        resolved.error + ':' + setting,
        resolved.error === 'noWorkspace'
          ? vscode.l10n.t(
              'Yomu: ${workspaceFolder} in the custom CSS path needs an open workspace: {0}',
              setting
            )
          : vscode.l10n.t(
              'Yomu: the custom CSS path must be absolute or start with ${workspaceFolder}: {0}',
              setting
            )
      );
      return undefined;
    }
    const uri = vscode.Uri.file(resolved.path);
    try {
      await vscode.workspace.fs.stat(uri);
    } catch {
      this.notifyOnce(
        'missing:' + resolved.path,
        vscode.l10n.t('Yomu: the custom CSS file was not found: {0}', resolved.path)
      );
      return undefined;
    }
    const folder = vscode.Uri.joinPath(uri, '..');
    entry.panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [...entry.baseRoots, folder],
    };
    this.watchCustomCss(uri);
    // 保存のたびに URI を変え、Webview のキャッシュを避ける
    return entry.panel.webview
      .asWebviewUri(uri)
      .with({ query: 'v=' + Date.now() })
      .toString();
  }

  private watchCustomCss(uri: vscode.Uri | undefined): void {
    const target = uri?.fsPath;
    if (this.customCssWatcher?.path === target) {
      return;
    }
    this.customCssWatcher?.watcher.dispose();
    this.customCssWatcher = undefined;
    if (uri === undefined || target === undefined) {
      return;
    }
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(vscode.Uri.joinPath(uri, '..'), path.basename(target))
    );
    const refresh = (): void => this.broadcastSettings();
    watcher.onDidChange(refresh);
    watcher.onDidCreate(refresh);
    watcher.onDidDelete(refresh);
    this.customCssWatcher = { path: target, watcher };
  }

  private notifyOnce(key: string, message: string): void {
    if (this.notified.has(key)) {
      return;
    }
    this.notified.add(key);
    void vscode.window.showWarningMessage(message);
  }

  private post(panel: vscode.WebviewPanel, message: ToWebview): void {
    void panel.webview.postMessage(message);
    this.postMessageEmitter.fire(message);
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
