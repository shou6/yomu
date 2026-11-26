import * as assert from 'assert';
import {
  configScope,
  layoutPickItems,
  stepWidth,
  validateLayoutNumber,
  type LayoutPickItem,
} from '../../reader/layout';

/** 翻訳しない翻訳関数。{0} などは引数で置き換える */
function t(message: string, ...args: string[]): string {
  return message.replace(/\{(\d+)\}/g, (_, index: string) => args[Number(index)] ?? '');
}

function choices(items: LayoutPickItem[], key: 'maxWidth' | 'padding'): LayoutPickItem[] {
  return items.filter((item) => item.key === key);
}

suite('stepWidth', () => {
  test('広げると、今より広い次の段階になる', () => {
    assert.strictEqual(stepWidth(820, 'wider'), 1000);
    assert.strictEqual(stepWidth(700, 'wider'), 820);
  });

  test('一番広い段階より広げると制限なし（0）になり、制限なしはそのまま', () => {
    assert.strictEqual(stepWidth(1200, 'wider'), 0);
    assert.strictEqual(stepWidth(5000, 'wider'), 0);
    assert.strictEqual(stepWidth(0, 'wider'), 0);
  });

  test('狭めると、今より狭い次の段階になる。制限なしからは一番広い段階になる', () => {
    assert.strictEqual(stepWidth(820, 'narrower'), 680);
    assert.strictEqual(stepWidth(900, 'narrower'), 820);
    assert.strictEqual(stepWidth(0, 'narrower'), 1200);
  });

  test('一番狭い段階より狭くはしない', () => {
    assert.strictEqual(stepWidth(560, 'narrower'), 560);
    assert.strictEqual(stepWidth(400, 'narrower'), 400);
  });
});

suite('configScope', () => {
  test('ワークスペースやフォルダーで値を指定していなければ、ユーザー設定に書く', () => {
    assert.strictEqual(configScope({}), 'global');
  });

  test('ワークスペースで指定していれば、ワークスペースの設定に書く（そうしないと変更が効かない）', () => {
    assert.strictEqual(configScope({ workspaceValue: 900 }), 'workspace');
  });

  test('フォルダーで指定していれば、フォルダーの設定を優先する', () => {
    assert.strictEqual(
      configScope({ workspaceValue: 900, workspaceFolderValue: 700 }),
      'workspaceFolder'
    );
  });
});

suite('layoutPickItems', () => {
  test('幅と余白の見出しと選択肢を並べる', () => {
    const items = layoutPickItems({ maxWidth: 820, padding: 32 }, t);
    const separators = items.filter((item) => item.separator === true).map((item) => item.label);
    assert.deepStrictEqual(separators, ['Body width', 'Side margins']);
    assert.deepStrictEqual(
      choices(items, 'maxWidth').map((item) => item.value),
      [680, 820, 1000, 1200, 0, 'custom']
    );
    assert.deepStrictEqual(
      choices(items, 'padding').map((item) => item.value),
      [0, 16, 32, 64, 'custom']
    );
  });

  test('今の値に印を付ける', () => {
    const items = layoutPickItems({ maxWidth: 820, padding: 16 }, t);
    assert.deepStrictEqual(
      items.filter((item) => item.current === true).map((item) => [item.key, item.value]),
      [
        ['maxWidth', 820],
        ['padding', 16],
      ]
    );
  });

  test('段階に無い値の時は、数値の入力に印を付けて今の値を見せる', () => {
    const items = layoutPickItems({ maxWidth: 900, padding: 32 }, t);
    const custom = choices(items, 'maxWidth').find((item) => item.value === 'custom');
    assert.strictEqual(custom?.current, true);
    assert.strictEqual(custom?.description, '900px');
  });

  test('制限なしの説明は px で出さない', () => {
    const items = layoutPickItems({ maxWidth: 0, padding: 32 }, t);
    const none = choices(items, 'maxWidth').find((item) => item.value === 0);
    assert.strictEqual(none?.current, true);
    assert.strictEqual(none?.label, 'No limit');
  });
});

suite('validateLayoutNumber', () => {
  test('範囲内の整数なら undefined（受け付ける）', () => {
    assert.strictEqual(validateLayoutNumber('960', 'maxWidth', t), undefined);
    assert.strictEqual(validateLayoutNumber(' 0 ', 'padding', t), undefined);
  });

  test('数でない、小数、範囲外は理由を返す', () => {
    assert.ok(validateLayoutNumber('abc', 'maxWidth', t));
    assert.ok(validateLayoutNumber('', 'maxWidth', t));
    assert.ok(validateLayoutNumber('12.5', 'padding', t));
    assert.ok(validateLayoutNumber('10001', 'maxWidth', t));
    assert.ok(validateLayoutNumber('1001', 'padding', t));
    assert.ok(validateLayoutNumber('-1', 'padding', t));
  });
});
