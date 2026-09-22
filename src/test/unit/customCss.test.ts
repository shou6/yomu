import * as assert from 'assert';
import { resolveCustomCss } from '../../reader/customCss';

suite('resolveCustomCss', () => {
  test('空なら指定なし', () => {
    assert.strictEqual(resolveCustomCss('', ['/ws']), undefined);
    assert.strictEqual(resolveCustomCss('   ', ['/ws']), undefined);
  });

  test('絶対パスはそのまま', () => {
    assert.deepStrictEqual(resolveCustomCss('/home/me/yomu.css', []), {
      path: '/home/me/yomu.css',
    });
    assert.deepStrictEqual(resolveCustomCss('C:\\Users\\me\\yomu.css', []), {
      path: 'C:\\Users\\me\\yomu.css',
    });
  });

  test('${workspaceFolder} は最初のワークスペースフォルダに置き換える', () => {
    assert.deepStrictEqual(
      resolveCustomCss('${workspaceFolder}/.vscode/yomu.css', ['/ws', '/other']),
      {
        path: '/ws/.vscode/yomu.css',
      }
    );
    assert.deepStrictEqual(resolveCustomCss('${workspaceFolder}\\style.css', ['C:\\ws']), {
      path: 'C:\\ws\\style.css',
    });
  });

  test('ワークスペースを開いていなければ、${workspaceFolder} は解決できない', () => {
    assert.deepStrictEqual(resolveCustomCss('${workspaceFolder}/a.css', []), {
      error: 'noWorkspace',
    });
  });

  test('相対パスは受け付けない', () => {
    assert.deepStrictEqual(resolveCustomCss('style.css', ['/ws']), { error: 'notAbsolute' });
    assert.deepStrictEqual(resolveCustomCss('./style.css', ['/ws']), { error: 'notAbsolute' });
  });
});
