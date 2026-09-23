/**
 * リーダータブの Custom Text Editor Provider（vscode 依存。統合テストで検証する）。
 * 変換、HTML の組み立て、設定の変換は純粋関数（render、webviewHtml、resourceRoots、readerSettings、customCss）に任せ、
 * ここでは VS Code とのやり取りだけを持つ。
 */
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { resolveCustomCss } from './customCss';
import { classifyLink, isMarkdownPath } from './links';
import type { FromWebview, ToWebview } from './messages';
import {
  cssVariables,
  normalizeSettings,
  type RawSettings,
  type ReaderSettings,
} from './readerSettings';
import { injectMermaid, printHtml, rewriteFontUrls, rewriteKatexFontUrls } from './printHtml';
import type { ReadingHistory } from './readingHistory';
import type { FrontMatterOptions } from './frontMatter';
import { renderSafely } from './render';
import { STYLE_FILES } from './styles';
import { resourceRoots } from './resourceRoots';
import { webviewHtml } from './webviewHtml';

/** 編集の追従のデバウンス（ms） */
const UPDATE_DELAY = 200;

/** 設定の接頭辞 */
const CONFIG_SECTION = 'yomu';

/** 印刷用の HTML に埋め込む CSS。テーマは paper だけ（印刷は白地にする） */
const PRINT_STYLE_FILES = [
  'fonts.css',
  'reader.css',
  'highlight.css',
  'themes/paper.css',
  'print.css',
];

/** 印刷の書き出しで、Webview の返事を待つ時間（ms） */
const EXPORT_TIMEOUT = 5000;

/** 開いているリーダータブ 1 つ分 */
interface Entry {
  panel: vscode.WebviewPanel;
  document: vscode.TextDocument;
  /** Webview の準備ができて、本文を送ったことがある */
  ready?: boolean;
  /** 読んでいる行を尋ねた時の、Webview の返事の受け口 */
  onLine?: (line: number) => void;
  /** 読んだ位置の割合。Webview から知らされるまでは undefined */
  progress?: number;
  /** 印刷の書き出しで、Webview の返事を待っている時の受け口 */
  onExported?: (mermaid: (string | null)[]) => void;
  /** カスタム CSS のフォルダを除いた localResourceRoots */
  baseRoots: vscode.Uri[];
  /** 本文を変換し直して送る。変換に効く設定（yomu.frontMatter）が変わった時に使い、front matter の開閉も設定に合わせる */
  update?: () => void;
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

  /** 見出し付きのリンクで開いた文書の、開いた後に移動する見出し（URI ごと） */
  private readonly pendingAnchors = new Map<string, string>();

  private readonly activeChangeEmitter = new vscode.EventEmitter<void>();
  /** アクティブなリーダーが変わった、またはその文書が編集された（目次を作り直す） */
  readonly onDidChangeActiveReader: vscode.Event<void> = this.activeChangeEmitter.event;

  private readonly openEmitter = new vscode.EventEmitter<void>();
  /** リーダーのタブを新しく開いた（タブの切り替えでは起きない） */
  readonly onDidOpenReader: vscode.Event<void> = this.openEmitter.event;

  private readonly progressEmitter = new vscode.EventEmitter<number>();
  /** アクティブなリーダーの、読んだ位置の割合が変わった */
  readonly onDidChangeProgress: vscode.Event<number> = this.progressEmitter.event;

  private readonly positionEmitter = new vscode.EventEmitter<string | null>();
  /** アクティブなリーダーで、今読んでいる見出しの id が変わった */
  readonly onDidChangePosition: vscode.Event<string | null> = this.positionEmitter.event;

  static register(context: vscode.ExtensionContext, history: ReadingHistory): ReaderProvider {
    const provider = new ReaderProvider(context.extensionUri, history);
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
          if (event.affectsConfiguration(`${CONFIG_SECTION}.frontMatter`)) {
            provider.rerenderAll();
          }
        }
      }),
      provider.postMessageEmitter,
      provider.activeChangeEmitter,
      provider.openEmitter,
      provider.progressEmitter,
      provider.positionEmitter,
      { dispose: () => provider.customCssWatcher?.watcher.dispose() }
    );
    return provider;
  }

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly history: ReadingHistory
  ) {}

  resolveCustomTextEditor(
    document: vscode.TextDocument,
    panel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): void {
    const documentDir = vscode.Uri.joinPath(document.uri, '..');
    const webview = panel.webview;
    const entry: Entry = {
      panel,
      document,
      baseRoots: [
        vscode.Uri.joinPath(this.extensionUri, 'media'),
        vscode.Uri.joinPath(this.extensionUri, 'dist'),
        vscode.Uri.joinPath(this.extensionUri, 'fonts'),
        ...this.documentResourceRoots(documentDir),
      ],
    };

    // タブの表示名とアイコンを標準エディタと変え、どちらのタブか一目で分かるようにする
    panel.title = 'Yomu: ' + path.basename(document.fileName);
    panel.iconPath = {
      light: vscode.Uri.joinPath(this.extensionUri, 'resources', 'reader-light.svg'),
      dark: vscode.Uri.joinPath(this.extensionUri, 'resources', 'reader-dark.svg'),
    };
    webview.options = { enableScripts: true, localResourceRoots: entry.baseRoots };
    webview.html = webviewHtml({
      nonce: crypto.randomBytes(16).toString('base64'),
      cspSource: webview.cspSource,
      // KaTeX の CSS は先に読み、組版の CSS で上書きできるようにする
      styleUris: [
        webview.asWebviewUri(this.katexCssUri()).toString(),
        ...STYLE_FILES.map((file) =>
          webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', file)).toString()
        ),
      ],
      scriptUri: webview
        .asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview.js'))
        .toString(),
      mermaidUri: webview
        .asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'dist', 'mermaid.min.js'))
        .toString(),
    });

    const resolveImageSrc = (src: string): string =>
      webview.asWebviewUri(vscode.Uri.joinPath(documentDir, decodePath(src))).toString();
    const update = (resume?: number, anchor?: string, resetFrontMatter?: boolean): void => {
      this.post(panel, {
        type: 'update',
        html: renderSafely(document.getText(), {
          resolveImageSrc,
          frontMatter: this.frontMatterOptions(),
        }),
        ...(resume === undefined ? {} : { resume }),
        ...(anchor === undefined ? {} : { anchor }),
        ...(resetFrontMatter === true ? { resetFrontMatter } : {}),
      });
    };

    entry.update = () => update(undefined, undefined, true);

    let timer: NodeJS.Timeout | undefined;
    const changeSubscription = vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.uri.toString() !== document.uri.toString()) {
        return;
      }
      clearTimeout(timer);
      timer = setTimeout(update, UPDATE_DELAY);
      if (panel.active) {
        this.activeChangeEmitter.fire();
      }
    });
    const messageSubscription = webview.onDidReceiveMessage((message: FromWebview) => {
      if (message.type === 'ready') {
        // 本文より先に見た目を決めておく。本文が出た後に幅やフォントが変わって見えるのを避ける。
        // retainContextWhenHidden を使わないので、タブを隠して戻すたびに Webview が作り直されてここに来る
        // 読書の記録があれば、その位置から再開するよう伝える。
        // タブを隠して戻した時は Webview が自分の覚えた位置を優先する
        const anchor = this.pendingAnchors.get(document.uri.toString());
        this.pendingAnchors.delete(document.uri.toString());
        void this.sendSettings(entry).then(() => {
          update(this.history.get(document.uri)?.progress, anchor);
          entry.ready = true;
        });
      } else if (message.type === 'openLink') {
        void this.followLink(document.uri, message.href);
      } else if (message.type === 'exported') {
        entry.onExported?.(message.mermaid);
      } else if (message.type === 'position' && panel.active) {
        this.positionEmitter.fire(message.id);
      } else if (message.type === 'line') {
        entry.onLine?.(message.line);
      } else if (message.type === 'progress') {
        entry.progress = message.value;
        void this.history.record(document.uri, path.basename(document.fileName), message.value);
        // 出すかどうかは、受け手が今アクティブなリーダーを見て決める
        this.progressEmitter.fire(message.value);
      }
    });
    this.entries.add(entry);
    // 目次のビューを出すかどうかと、その中身を、アクティブなリーダーに合わせる
    const viewStateSubscription = panel.onDidChangeViewState(() => this.activeChanged());
    panel.onDidDispose(() => {
      clearTimeout(timer);
      changeSubscription.dispose();
      messageSubscription.dispose();
      viewStateSubscription.dispose();
      this.entries.delete(entry);
      this.activeChanged();
    });
    this.activeChanged();
    this.openEmitter.fire();
  }

  /** アクティブなリーダーの文書。リーダーがアクティブでなければ undefined */
  activeDocument(): vscode.TextDocument | undefined {
    return [...this.entries].find((entry) => entry.panel.active)?.document;
  }

  /** アクティブなリーダーの、読んだ位置の割合。リーダーがアクティブでない、または不明なら undefined */
  activeProgress(): number | undefined {
    return [...this.entries].find((entry) => entry.panel.active)?.progress;
  }

  /** アクティブなリーダーの文書の URI。リーダーがアクティブでなければ undefined */
  activeDocumentUri(): vscode.Uri | undefined {
    return this.activeDocument()?.uri;
  }

  /**
   * その文書を開いているリーダーに、今読んでいる箇所の元の行番号を尋ねる。
   * リーダーが無い、または 1 秒以内に返事が無ければ undefined
   */
  async readingLine(uri: vscode.Uri): Promise<number | undefined> {
    const entry = [...this.entries]
      .filter((candidate) => candidate.document.uri.toString() === uri.toString())
      .sort((a, b) => Number(b.panel.active) - Number(a.panel.active))[0];
    if (entry === undefined) {
      return undefined;
    }
    return new Promise<number | undefined>((resolve) => {
      const timer = setTimeout(() => resolve(undefined), 1000);
      entry.onLine = (line) => {
        clearTimeout(timer);
        entry.onLine = undefined;
        resolve(line);
      };
      this.post(entry.panel, { type: 'requestLine' });
    });
  }

  /**
   * リーダーでクリックされたリンクを開く（要件定義 4.6 節）。
   * 外部は既定のブラウザ。相対パスの .md はリーダーで開き、見出し付きならその見出しへ移動する。
   * それ以外のファイルは標準エディタで開く。戻る・進むは VS Code 標準の「戻る」「進む」に任せる。
   * 文書内の移動（#見出し）は Webview 側で済ませている
   */
  async followLink(from: vscode.Uri, href: string): Promise<void> {
    const link = classifyLink(href);
    if (link.kind === 'external') {
      await vscode.env.openExternal(vscode.Uri.parse(link.href));
      return;
    }
    if (link.kind !== 'relative' || link.path === '') {
      return;
    }
    const target = vscode.Uri.joinPath(from, '..', link.path);
    if (!isMarkdownPath(link.path)) {
      await vscode.commands.executeCommand('vscode.open', target);
      return;
    }
    const key = target.toString();
    const opened = [...this.entries].find(
      (entry) => entry.document.uri.toString() === key && entry.ready === true
    );
    if (link.fragment !== undefined && opened === undefined) {
      // 新しく開くリーダーには、本文と一緒に見出しを渡す
      this.pendingAnchors.set(key, link.fragment);
    }
    await vscode.commands.executeCommand('vscode.openWith', target, ReaderProvider.viewType);
    if (link.fragment !== undefined && opened !== undefined) {
      // 既に開いているリーダーは、そのタブへ移ってから見出しへ移動させる
      this.post(opened.panel, { type: 'scrollTo', id: link.fragment });
    }
  }

  /** アクティブなリーダーを、その見出しまでスクロールさせる */
  revealHeading(id: string): void {
    const entry = [...this.entries].find((candidate) => candidate.panel.active);
    if (entry !== undefined) {
      this.post(entry.panel, { type: 'scrollTo', id });
    }
  }

  private activeChanged(): void {
    void vscode.commands.executeCommand(
      'setContext',
      'yomu.readerActive',
      this.activeDocument() !== undefined
    );
    this.activeChangeEmitter.fire();
  }

  /**
   * アクティブなリーダーの本文を、印刷用の 1 つの HTML にして一時フォルダに書き出す。
   * 本文は画像をローカルのファイルの URI にして描き直し、Mermaid の図はリーダーが描いた SVG を使う。
   * @returns 書き出したファイルのパス。アクティブなリーダーが無ければ undefined
   */
  async exportForPrint(): Promise<string | undefined> {
    const entry = [...this.entries].find((candidate) => candidate.panel.active);
    if (entry === undefined) {
      return undefined;
    }
    const mermaid = await new Promise<(string | null)[]>((resolve) => {
      const timer = setTimeout(() => resolve([]), EXPORT_TIMEOUT);
      entry.onExported = (svgs) => {
        clearTimeout(timer);
        entry.onExported = undefined;
        resolve(svgs);
      };
      void entry.panel.webview.postMessage({ type: 'export' } satisfies ToWebview);
    });

    const documentDir = vscode.Uri.joinPath(entry.document.uri, '..');
    const body = injectMermaid(
      renderSafely(entry.document.getText(), {
        resolveImageSrc: (src) => vscode.Uri.joinPath(documentDir, decodePath(src)).toString(),
        frontMatter: this.frontMatterOptions(),
      }),
      mermaid
    );
    const fontsDir = vscode.Uri.joinPath(this.extensionUri, 'fonts').toString();
    const css = await Promise.all(
      PRINT_STYLE_FILES.map(async (file) =>
        rewriteFontUrls(
          new TextDecoder().decode(
            await vscode.workspace.fs.readFile(
              vscode.Uri.joinPath(this.extensionUri, 'media', file)
            )
          ),
          fontsDir
        )
      )
    );
    const katexCss = rewriteKatexFontUrls(
      new TextDecoder().decode(await vscode.workspace.fs.readFile(this.katexCssUri())),
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'katex', 'fonts').toString()
    );
    const settings = this.readSettings();
    const title = path.basename(entry.document.fileName);
    const html = printHtml({
      title,
      body,
      css: [katexCss, ...css],
      cssVariables: cssVariables(settings),
    });

    const dir = path.join(os.tmpdir(), 'yomu-print');
    await fs.mkdir(dir, { recursive: true });
    const file = path.join(dir, title.replace(/\.md$/i, '') + '.html');
    await fs.writeFile(file, html, 'utf8');
    return file;
  }

  /** 数式の CSS（esbuild.js が dist/katex に写す） */
  private katexCssUri(): vscode.Uri {
    return vscode.Uri.joinPath(this.extensionUri, 'dist', 'katex', 'katex.min.css');
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
      focusMode: config.get('focusMode'),
      foldLines: config.get('code.foldLines'),
      frontMatter: config.get('frontMatter'),
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
      focusMode: settings.focusMode,
      foldLines: settings.foldLines,
      // Webview の中では l10n が使えないので、翻訳した文言を渡す
      foldLabels: {
        expand: vscode.l10n.t('Show all {0} lines'),
        collapse: vscode.l10n.t('Collapse'),
      },
      ...(customCss === undefined ? {} : { customCssUri: customCss }),
    });
  }

  /** front matter の見せ方。折りたたみの見出しは翻訳して渡す */
  private frontMatterOptions(): FrontMatterOptions {
    return { display: this.readSettings().frontMatter, label: vscode.l10n.t('Front matter') };
  }

  /** 開いているすべてのリーダータブの本文を、変換し直して送る */
  private rerenderAll(): void {
    for (const entry of this.entries) {
      if (entry.ready) {
        entry.update?.();
      }
    }
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

/** markdown-it がパーセントエンコードした相対パス（`my%20img.png`）を元に戻す */
function decodePath(src: string): string {
  try {
    return decodeURIComponent(src);
  } catch {
    return src;
  }
}
