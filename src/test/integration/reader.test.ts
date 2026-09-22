import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

interface Manifest {
  contributes: {
    viewsContainers: { activitybar: { id: string; title: string; icon: string }[] };
    views: Record<string, { id: string; name: string; when?: string }[]>;
    viewsWelcome?: { view: string; contents: string; when?: string }[];
    commands: { command: string; icon?: string | { light: string; dark: string } }[];
    menus: { 'editor/title': { command: string; when: string; group?: string }[] };
    configuration: { properties: Record<string, { default?: unknown }> };
  };
}

/** activate が返す API（テスト用の観測点） */
interface YomuApi {
  onDidPostMessage: vscode.Event<{ type: string; [key: string]: unknown }>;
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

async function api(): Promise<YomuApi> {
  const extension = vscode.extensions.getExtension('shou6.yomu');
  assert.ok(extension);
  return (await extension.activate()) as YomuApi;
}

/** 条件を満たすメッセージが来るまで待つ */
function waitForMessage(
  event: vscode.Event<{ type: string; [key: string]: unknown }>,
  predicate: (message: { type: string; [key: string]: unknown }) => boolean,
  timeoutMs = 5000
): Promise<{ type: string; [key: string]: unknown }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      subscription.dispose();
      reject(new Error('メッセージが来ない'));
    }, timeoutMs);
    const subscription = event((message) => {
      if (predicate(message)) {
        clearTimeout(timer);
        subscription.dispose();
        resolve(message);
      }
    });
  });
}

// out/test/integration から見たプロジェクトルート
const ROOT = path.resolve(__dirname, '../../..');
const FIXTURES = path.join(ROOT, 'src', 'test', 'fixtures');
const VIEW_TYPE = 'yomu.reader';

function fixture(name: string): vscode.Uri {
  return vscode.Uri.file(path.join(FIXTURES, name));
}

/** アクティブなタブがリーダー（カスタムエディタ）なら、その viewType */
function activeCustomViewType(): string | undefined {
  const input = vscode.window.tabGroups.activeTabGroup.activeTab?.input;
  return input instanceof vscode.TabInputCustom ? input.viewType : undefined;
}

async function closeAll(): Promise<void> {
  await vscode.commands.executeCommand('workbench.action.closeAllEditors');
}

suite('Reader', () => {
  test('エディタのタイトルバーに、.md の時だけ「リーダーで開く」のアイコンを出す', () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')
    ) as Manifest;
    const item = manifest.contributes.menus['editor/title'].find(
      (m) => m.command === 'yomu.openInReader'
    );
    assert.ok(item, 'editor/title に yomu.openInReader が無い');
    assert.ok(item.when.includes('resourceExtname == .md'), item.when);
    assert.ok(item.when.includes('activeCustomEditorId != yomu.reader'), item.when);
    assert.strictEqual(item.group, 'navigation');
    const command = manifest.contributes.commands.find((c) => c.command === 'yomu.openInReader');
    assert.ok(command?.icon, 'コマンドにアイコンが無い');
    // 自前の SVG。ライトとダークの両方があり、公開パッケージに入る
    assert.ok(typeof command.icon === 'object', 'アイコンが SVG でない');
    for (const file of [command.icon.light, command.icon.dark]) {
      assert.ok(fs.existsSync(path.join(ROOT, file)), file + ' が無い');
      assert.match(file, /^resources\/[\w.-]+\.svg$/);
    }
  });

  setup(closeAll);
  teardown(closeAll);

  test('vscode.openWith で .md をリーダータブとして開ける', async () => {
    await vscode.commands.executeCommand('vscode.openWith', fixture('sample.md'), VIEW_TYPE);
    assert.strictEqual(activeCustomViewType(), VIEW_TYPE);
  });

  test('リーダータブの表示名は「Yomu: ファイル名」で、標準エディタのタブと見分けが付く', async () => {
    await vscode.commands.executeCommand('vscode.openWith', fixture('sample.md'), VIEW_TYPE);
    assert.strictEqual(vscode.window.tabGroups.activeTabGroup.activeTab?.label, 'Yomu: sample.md');
  });

  test('コマンドで、アクティブな .md をリーダータブで開ける', async () => {
    await vscode.window.showTextDocument(fixture('sample.md'));
    await vscode.commands.executeCommand('yomu.openInReader');
    assert.strictEqual(activeCustomViewType(), VIEW_TYPE);
  });

  test('タイトルバーのアイコンのように、URI を引数に渡してもリーダータブで開ける', async () => {
    await vscode.commands.executeCommand('yomu.openInReader', fixture('sample.md'));
    assert.strictEqual(activeCustomViewType(), VIEW_TYPE);
  });

  test('.md でないファイルでコマンドを実行しても、リーダータブは開かない', async () => {
    await vscode.window.showTextDocument(fixture('plain.txt'));
    await vscode.commands.executeCommand('yomu.openInReader');
    assert.strictEqual(activeCustomViewType(), undefined);
    assert.ok(
      vscode.window.tabGroups.activeTabGroup.activeTab?.input instanceof vscode.TabInputText
    );
  });

  test('エディタが無い時にコマンドを実行しても例外にならない', async () => {
    await vscode.commands.executeCommand('yomu.openInReader');
    assert.strictEqual(activeCustomViewType(), undefined);
  });

  test('画像入りの .md を開いても例外にならない', async () => {
    await vscode.commands.executeCommand('vscode.openWith', fixture('with-image.md'), VIEW_TYPE);
    assert.strictEqual(activeCustomViewType(), VIEW_TYPE);
  });

  test('ダブルクリック相当の vscode.open では標準エディタで開く（既定を奪わない）', async () => {
    await vscode.commands.executeCommand('vscode.open', fixture('sample.md'));
    assert.ok(
      vscode.window.tabGroups.activeTabGroup.activeTab?.input instanceof vscode.TabInputText
    );
  });

  test('package.json に yomu.* の設定がすべて定義されている', () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')
    ) as Manifest;
    const keys = Object.keys(manifest.contributes.configuration.properties);
    assert.deepStrictEqual(keys.sort(), [
      'yomu.code.foldLines',
      'yomu.customCss',
      'yomu.focusMode',
      'yomu.font.codeFamily',
      'yomu.font.family',
      'yomu.font.lineHeight',
      'yomu.font.size',
      'yomu.layout.align',
      'yomu.layout.maxWidth',
      'yomu.layout.padding',
      'yomu.outline.revealOnOpen',
      'yomu.theme',
    ]);
  });

  test('リーダータブを開くと、Webview の準備ができた後に settings、update の順で送られる', async () => {
    const { onDidPostMessage } = await api();
    const types: string[] = [];
    const subscription = onDidPostMessage((message) => types.push(message.type));
    try {
      const firstUpdate = waitForMessage(onDidPostMessage, (m) => m.type === 'update');
      await vscode.commands.executeCommand('vscode.openWith', fixture('sample.md'), VIEW_TYPE);
      // Webview のスクリプトが ready を送ってから配るので、openWith が返った直後はまだ届いていない
      await firstUpdate;
      assert.deepStrictEqual(types, ['settings', 'update']);
    } finally {
      subscription.dispose();
    }
  });

  test('yomu の設定を変えると、開いているリーダータブに settings が再送される', async () => {
    const { onDidPostMessage } = await api();
    const opened = waitForMessage(onDidPostMessage, (m) => m.type === 'update');
    await vscode.commands.executeCommand('vscode.openWith', fixture('sample.md'), VIEW_TYPE);
    await opened;
    const config = vscode.workspace.getConfiguration('yomu');
    try {
      const received = waitForMessage(
        onDidPostMessage,
        (m) =>
          m.type === 'settings' &&
          (m.cssVariables as Record<string, string>)['--yomu-font-size'] === '17px'
      );
      await config.update('font.size', 17, vscode.ConfigurationTarget.Global);
      const message = await received;
      assert.strictEqual(message.theme, 'paper');
    } finally {
      await config.update('font.size', undefined, vscode.ConfigurationTarget.Global);
    }
  });

  test('yomu.customCss に CSS のパスを書くと、settings にその Webview URI が入る', async () => {
    const { onDidPostMessage } = await api();
    const config = vscode.workspace.getConfiguration('yomu');
    const cssPath = path.join(FIXTURES, 'custom.css');
    try {
      const received = waitForMessage(
        onDidPostMessage,
        (m) => m.type === 'settings' && String(m.customCssUri ?? '').includes('custom.css')
      );
      await vscode.commands.executeCommand('vscode.openWith', fixture('sample.md'), VIEW_TYPE);
      await config.update('customCss', cssPath, vscode.ConfigurationTarget.Global);
      const message = await received;
      assert.match(String(message.customCssUri), /^https:\/\//, 'asWebviewUri で変換されていない');
    } finally {
      await config.update('customCss', undefined, vscode.ConfigurationTarget.Global);
    }
  });

  test('yomu.customCss のファイルが無ければ、settings に customCssUri は入らない', async () => {
    const { onDidPostMessage } = await api();
    const config = vscode.workspace.getConfiguration('yomu');
    try {
      await config.update(
        'customCss',
        path.join(FIXTURES, 'missing.css'),
        vscode.ConfigurationTarget.Global
      );
      const received = waitForMessage(onDidPostMessage, (m) => m.type === 'settings');
      await vscode.commands.executeCommand('vscode.openWith', fixture('sample.md'), VIEW_TYPE);
      const message = await received;
      assert.strictEqual(message.customCssUri, undefined);
    } finally {
      await config.update('customCss', undefined, vscode.ConfigurationTarget.Global);
    }
  });

  test('集中モードの切り替えコマンドで、yomu.focusMode が反転し、settings に載る', async () => {
    const { onDidPostMessage } = await api();
    const config = (): vscode.WorkspaceConfiguration => vscode.workspace.getConfiguration('yomu');
    const opened = waitForMessage(onDidPostMessage, (m) => m.type === 'update');
    await vscode.commands.executeCommand('vscode.openWith', fixture('sample.md'), VIEW_TYPE);
    await opened;
    try {
      assert.strictEqual(config().get('focusMode'), false);
      const received = waitForMessage(
        onDidPostMessage,
        (m) => m.type === 'settings' && m.focusMode === true
      );
      await vscode.commands.executeCommand('yomu.toggleFocusMode');
      await received;
      assert.strictEqual(config().get('focusMode'), true);
    } finally {
      await config().update('focusMode', undefined, vscode.ConfigurationTarget.Global);
    }
  });

  test('settings に、コードの折りたたみの行数と翻訳済みのボタンの文言が載る', async () => {
    const { onDidPostMessage } = await api();
    const received = waitForMessage(onDidPostMessage, (m) => m.type === 'settings');
    await vscode.commands.executeCommand('vscode.openWith', fixture('sample.md'), VIEW_TYPE);
    const message = await received;
    assert.strictEqual(message.foldLines, 20);
    const labels = message.foldLabels as { expand: string; collapse: string };
    assert.ok(labels.expand.includes('{0}'), labels.expand);
    assert.ok(labels.collapse.length > 0);
  });

  test('印刷用の HTML を一時フォルダに書き出す。題名、本文、paper テーマ、印刷の CSS が入る', async () => {
    const yomu = await api();
    const opened = waitForMessage(yomu.onDidPostMessage, (m) => m.type === 'update');
    await vscode.commands.executeCommand('vscode.openWith', fixture('sample.md'), VIEW_TYPE);
    await opened;
    const file = await yomu.exportForPrint();
    assert.ok(file, '書き出せなかった');
    const html = fs.readFileSync(file, 'utf8');
    assert.ok(html.includes('<title>sample.md</title>'), html.slice(0, 300));
    assert.ok(html.includes('サンプル'), '本文が無い');
    assert.ok(html.includes('<body data-theme="paper">'));
    assert.ok(html.includes('@media print'));
  });

  test('印刷のコマンドが登録されていて、リーダーが無い時に実行しても例外にならない', async () => {
    const registered = await vscode.commands.getCommands(true);
    assert.ok(registered.includes('yomu.openInBrowser'));
    await vscode.commands.executeCommand('yomu.openInBrowser');
  });

  test('リーダータブの右上に、印刷・集中モード・標準エディタで開くのボタンを出す', () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')
    ) as Manifest;
    const items = manifest.contributes.menus['editor/title'];
    const find = (command: string): { when: string; group?: string } => {
      const item = items.find((m) => m.command === command);
      assert.ok(item, 'editor/title に ' + command + ' が無い');
      return item;
    };
    for (const command of [
      'yomu.openInBrowser',
      'yomu.enableFocusMode',
      'yomu.disableFocusMode',
      'yomu.openInTextEditor',
    ]) {
      const item = find(command);
      assert.strictEqual(item.group, 'navigation', command);
      assert.ok(
        item.when.includes('activeCustomEditorId == yomu.reader'),
        command + ': ' + item.when
      );
      const declared = manifest.contributes.commands.find((c) => c.command === command);
      assert.ok(declared?.icon, command + ' にアイコンが無い');
    }
    // 集中モードは、今の状態に応じてどちらか一方だけを出す
    assert.ok(find('yomu.enableFocusMode').when.includes('!config.yomu.focusMode'));
    assert.ok(/(^|[^!])config\.yomu\.focusMode/.test(find('yomu.disableFocusMode').when));
  });

  test('集中モードをオンにするコマンドとオフにするコマンド', async () => {
    const config = (): vscode.WorkspaceConfiguration => vscode.workspace.getConfiguration('yomu');
    try {
      await vscode.commands.executeCommand('yomu.enableFocusMode');
      assert.strictEqual(config().get('focusMode'), true);
      await vscode.commands.executeCommand('yomu.disableFocusMode');
      assert.strictEqual(config().get('focusMode'), false);
    } finally {
      await config().update('focusMode', undefined, vscode.ConfigurationTarget.Global);
    }
  });

  test('標準エディタで開くと、同じファイルがテキストエディタのタブで開く', async () => {
    const yomu = await api();
    const opened = waitForMessage(yomu.onDidPostMessage, (m) => m.type === 'update');
    await vscode.commands.executeCommand('vscode.openWith', fixture('sample.md'), VIEW_TYPE);
    await opened;
    await vscode.commands.executeCommand('yomu.openInTextEditor');
    const input = vscode.window.tabGroups.activeTabGroup.activeTab?.input;
    assert.ok(input instanceof vscode.TabInputText, 'テキストエディタで開いていない');
    assert.strictEqual(input.uri.fsPath, fixture('sample.md').fsPath);
  });

  test('コマンドの $(name) のアイコンは、VS Code に実在するもの', () => {
    // 存在しない名前（例: print）を書くと、タイトルバーに空白の四角が出る
    const workbench = fs.readFileSync(
      path.join(vscode.env.appRoot, 'out', 'vs', 'workbench', 'workbench.desktop.main.js'),
      'utf8'
    );
    const manifest = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')
    ) as Manifest;
    const icons = manifest.contributes.commands
      .map((c) => (typeof c.icon === 'string' ? /^\$\(([\w-]+)\)$/.exec(c.icon)?.[1] : undefined))
      .filter((name): name is string => name !== undefined);
    assert.ok(icons.length > 0);
    const missing = icons.filter((name) => !workbench.includes(`("${name}",`));
    assert.deepStrictEqual(missing, [], 'VS Code に無いアイコン');
  });

  test('アクティビティバーに Yomu の入口があり、その中に目次のビューがある', () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')
    ) as Manifest;
    const container = manifest.contributes.viewsContainers.activitybar.find((c) => c.id === 'yomu');
    assert.ok(container, 'アクティビティバーに yomu が無い');
    assert.ok(fs.existsSync(path.join(ROOT, container.icon)), container.icon + ' が無い');
    // エクスプローラーには置かない（他の拡張機能のビューと混ざって窮屈になるため）
    assert.strictEqual(manifest.contributes.views.explorer, undefined);
    const view = manifest.contributes.views.yomu?.find((v) => v.id === 'yomu.outline');
    assert.ok(view, 'yomu.outline が無い');
    // リーダーを開いていない時は、見出しの代わりに案内を出す
    const welcome = manifest.contributes.viewsWelcome?.find((w) => w.view === 'yomu.outline');
    assert.ok(welcome, 'yomu.outline の案内が無い');
  });

  test('リーダーで開くと、目次にその文書の見出しが出る', async () => {
    const yomu = await api();
    const opened = waitForMessage(yomu.onDidPostMessage, (m) => m.type === 'update');
    await vscode.commands.executeCommand('vscode.openWith', fixture('sample.md'), VIEW_TYPE);
    await opened;
    assert.deepStrictEqual(yomu.outlineIds(), ['サンプル']);
  });

  test('目次の項目を選ぶと、リーダーにその見出しへ移動する指示が送られる', async () => {
    const yomu = await api();
    const opened = waitForMessage(yomu.onDidPostMessage, (m) => m.type === 'update');
    await vscode.commands.executeCommand('vscode.openWith', fixture('sample.md'), VIEW_TYPE);
    await opened;
    const received = waitForMessage(
      yomu.onDidPostMessage,
      (m) => m.type === 'scrollTo' && m.id === 'サンプル'
    );
    await vscode.commands.executeCommand('yomu.revealHeading', 'サンプル');
    await received;
  });

  test('リーダーを開いた時に目次を開いて見せる設定があり、既定はオフ', () => {
    // 専用のビューなので、開くたびにファイル一覧から勝手に切り替わると煩わしい
    const manifest = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')
    ) as Manifest;
    const property = manifest.contributes.configuration.properties['yomu.outline.revealOnOpen'];
    assert.strictEqual(property?.default, false);
  });

  test('設定をオンにすると、リーダーを開いた時に目次のビューが開いて見える', async () => {
    const yomu = await api();
    const config = vscode.workspace.getConfiguration('yomu');
    await config.update('outline.revealOnOpen', true, vscode.ConfigurationTarget.Global);
    try {
      await vscode.commands.executeCommand('workbench.action.closeSidebar');
      const opened = waitForMessage(yomu.onDidPostMessage, (m) => m.type === 'update');
      await vscode.commands.executeCommand('vscode.openWith', fixture('sample.md'), VIEW_TYPE);
      await opened;
      for (let i = 0; i < 50 && !yomu.outlineVisible(); i++) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      assert.strictEqual(yomu.outlineVisible(), true);
      // 操作先はリーダーのまま
      assert.strictEqual(activeCustomViewType(), VIEW_TYPE);
    } finally {
      await config.update('outline.revealOnOpen', undefined, vscode.ConfigurationTarget.Global);
    }
  });

  test('Yomu の中に、目次と並べて読書の記録のビューがある', () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')
    ) as Manifest;
    const ids = (manifest.contributes.views.yomu ?? []).map((v) => v.id);
    assert.deepStrictEqual(ids, ['yomu.outline', 'yomu.history']);
    assert.ok(manifest.contributes.viewsWelcome?.some((w) => w.view === 'yomu.history'));
  });

  test('リーダーで開くと、読書の記録に残り、ステータスバーに割合が出る', async () => {
    const yomu = await api();
    const opened = waitForMessage(yomu.onDidPostMessage, (m) => m.type === 'update');
    await vscode.commands.executeCommand('vscode.openWith', fixture('sample.md'), VIEW_TYPE);
    await opened;
    const uri = fixture('sample.md').toString();
    for (let i = 0; i < 50 && !yomu.readingHistory().some((r) => r.uri === uri); i++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const record = yomu.readingHistory().find((r) => r.uri === uri);
    assert.ok(record, '記録に残っていない');
    assert.strictEqual(record.title, 'sample.md');
    assert.match(yomu.statusBarText() ?? '', /\d+%/);
  });

  test('リーダーでない時は、ステータスバーに割合を出さない', async () => {
    const yomu = await api();
    await vscode.window.showTextDocument(fixture('plain.txt'));
    assert.strictEqual(yomu.statusBarText(), undefined);
  });

  test('記録のある文書を新しく開くと、その割合の位置から再開するよう Webview に伝える', async () => {
    const yomu = await api();
    await yomu.recordProgress(fixture('with-image.md'), 0.5);
    const opened = waitForMessage(yomu.onDidPostMessage, (m) => m.type === 'update');
    await vscode.commands.executeCommand('vscode.openWith', fixture('with-image.md'), VIEW_TYPE);
    const message = await opened;
    assert.strictEqual(message.resume, 0.5);
  });

  test('標準エディタで開くと、リーダーで読んでいる行にカーソルを置く', async () => {
    const yomu = await api();
    const opened = waitForMessage(yomu.onDidPostMessage, (m) => m.type === 'update');
    await vscode.commands.executeCommand('vscode.openWith', fixture('sample.md'), VIEW_TYPE);
    await opened;
    const asked = waitForMessage(yomu.onDidPostMessage, (m) => m.type === 'requestLine');
    await vscode.commands.executeCommand('yomu.openInTextEditor');
    await asked;
    const editor = vscode.window.activeTextEditor;
    assert.ok(editor, 'テキストエディタが開いていない');
    assert.strictEqual(editor.document.uri.fsPath, fixture('sample.md').fsPath);
    // 開いた直後は一番上を読んでいるので、先頭の見出しの行
    assert.strictEqual(editor.selection.active.line, 0);
  });
});
