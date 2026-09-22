import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

interface Manifest {
  contributes: {
    commands: { command: string; icon?: string | { light: string; dark: string } }[];
    menus: { 'editor/title': { command: string; when: string; group?: string }[] };
    configuration: { properties: Record<string, { default?: unknown }> };
  };
}

/** activate が返す API（テスト用の観測点） */
interface YomuApi {
  onDidPostMessage: vscode.Event<{ type: string; [key: string]: unknown }>;
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
      'yomu.customCss',
      'yomu.font.codeFamily',
      'yomu.font.family',
      'yomu.font.lineHeight',
      'yomu.font.size',
      'yomu.layout.align',
      'yomu.layout.maxWidth',
      'yomu.layout.padding',
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
});
