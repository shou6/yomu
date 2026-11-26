import * as assert from 'assert';
import {
  configScope,
  layoutPickItems,
  stepMargin,
  validateLayoutNumber,
  type LayoutKey,
  type LayoutPickItem,
} from '../../reader/layout';

/** 翻訳しない翻訳関数。{0} などは引数で置き換える */
function t(message: string, ...args: string[]): string {
  return message.replace(/\{(\d+)\}/g, (_, index: string) => args[Number(index)] ?? '');
}

function choices(items: LayoutPickItem[], key: LayoutKey): LayoutPickItem[] {
  return items.filter((item) => item.key === key);
}

suite('stepMargin', () => {
  test('本文を広げると、左右の余白の割合が 1 段階小さくなる', () => {
    assert.strictEqual(stepMargin(10, 'wider'), 5);
    assert.strictEqual(stepMargin(12, 'wider'), 10);
    assert.strictEqual(stepMargin(5, 'wider'), 0);
  });

  test('本文を狭めると、左右の余白の割合が 1 段階大きくなる', () => {
    assert.strictEqual(stepMargin(10, 'narrower'), 15);
    assert.strictEqual(stepMargin(12, 'narrower'), 15);
    assert.strictEqual(stepMargin(0, 'narrower'), 5);
  });

  test('0 より小さく、一番大きい段階（30%）より大きくはしない', () => {
    assert.strictEqual(stepMargin(0, 'wider'), 0);
    assert.strictEqual(stepMargin(30, 'narrower'), 30);
    assert.strictEqual(stepMargin(35, 'narrower'), 35);
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
  test('左右の余白と最大幅の見出しと選択肢を並べる', () => {
    const items = layoutPickItems({ margin: 10, maxWidth: 0 }, t);
    const separators = items.filter((item) => item.separator === true).map((item) => item.label);
    assert.deepStrictEqual(separators, ['Side margins', 'Maximum width']);
    assert.deepStrictEqual(
      choices(items, 'margin').map((item) => item.value),
      [0, 5, 10, 15, 20, 'custom']
    );
    assert.deepStrictEqual(
      choices(items, 'maxWidth').map((item) => item.value),
      [0, 820, 1000, 1200, 1600, 'custom']
    );
  });

  test('余白は割合で、最大幅は px で説明する', () => {
    const items = layoutPickItems({ margin: 10, maxWidth: 0 }, t);
    assert.strictEqual(choices(items, 'margin').find((i) => i.value === 15)?.description, '15%');
    assert.strictEqual(
      choices(items, 'maxWidth').find((i) => i.value === 1000)?.description,
      '1000px'
    );
  });

  test('今の値に印を付ける', () => {
    const items = layoutPickItems({ margin: 5, maxWidth: 1200 }, t);
    assert.deepStrictEqual(
      items.filter((item) => item.current === true).map((item) => [item.key, item.value]),
      [
        ['margin', 5],
        ['maxWidth', 1200],
      ]
    );
  });

  test('段階に無い値の時は、数値の入力に印を付けて今の値を見せる', () => {
    const items = layoutPickItems({ margin: 12, maxWidth: 900 }, t);
    const margin = choices(items, 'margin').find((item) => item.value === 'custom');
    assert.strictEqual(margin?.current, true);
    assert.strictEqual(margin?.description, '12%');
    const width = choices(items, 'maxWidth').find((item) => item.value === 'custom');
    assert.strictEqual(width?.current, true);
    assert.strictEqual(width?.description, '900px');
  });
});

suite('validateLayoutNumber', () => {
  test('範囲内の整数なら undefined（受け付ける）', () => {
    assert.strictEqual(validateLayoutNumber('960', 'maxWidth', t), undefined);
    assert.strictEqual(validateLayoutNumber(' 0 ', 'margin', t), undefined);
    assert.strictEqual(validateLayoutNumber('40', 'margin', t), undefined);
  });

  test('数でない、小数、範囲外は理由を返す', () => {
    assert.ok(validateLayoutNumber('abc', 'maxWidth', t));
    assert.ok(validateLayoutNumber('', 'maxWidth', t));
    assert.ok(validateLayoutNumber('12.5', 'margin', t));
    assert.ok(validateLayoutNumber('10001', 'maxWidth', t));
    assert.ok(validateLayoutNumber('41', 'margin', t));
    assert.ok(validateLayoutNumber('-1', 'margin', t));
  });
});
