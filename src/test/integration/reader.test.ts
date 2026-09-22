import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

interface Manifest {
  contributes: {
    commands: { command: string; icon?: string }[];
    menus: { 'editor/title': { command: string; when: string; group?: string }[] };
  };
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
});
