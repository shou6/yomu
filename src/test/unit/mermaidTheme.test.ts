import * as assert from 'assert';
import { mermaidConfig, mermaidTheme } from '../../reader/mermaidTheme';

suite('mermaidTheme', () => {
  test('Yomu のテーマごとに mermaid のテーマを選ぶ', () => {
    assert.strictEqual(mermaidTheme('paper', false), 'default');
    assert.strictEqual(mermaidTheme('sepia', false), 'neutral');
    assert.strictEqual(mermaidTheme('dark', false), 'dark');
  });

  test('vscode テーマは、カラーテーマの明暗に従う', () => {
    assert.strictEqual(mermaidTheme('vscode', false), 'default');
    assert.strictEqual(mermaidTheme('vscode', true), 'dark');
  });

  test('paper と sepia と dark は、カラーテーマの明暗に関わらない', () => {
    assert.strictEqual(mermaidTheme('paper', true), 'default');
    assert.strictEqual(mermaidTheme('dark', false), 'dark');
  });
});

suite('mermaidConfig', () => {
  test('スクリプトの実行を許さず、テーマを渡す', () => {
    const config = mermaidConfig('dark', 760);
    assert.strictEqual(config.startOnLoad, false);
    assert.strictEqual(config.securityLevel, 'strict');
    assert.strictEqual(config.theme, 'dark');
  });

  test('ガントチャートは本文の幅ちょうどで描き、文字を読める大きさにする', () => {
    // mermaid は描く枠の幅を読み、取れないと 1200px で描く。本文の幅に縮めて表示すると 11px の文字が 7px 前後になる
    const { gantt } = mermaidConfig('paper', 760);
    assert.strictEqual(gantt.useWidth, 760);
    assert.ok(gantt.fontSize >= 13, String(gantt.fontSize));
    assert.ok(gantt.sectionFontSize >= 13, String(gantt.sectionFontSize));
    assert.ok(gantt.barHeight >= 24, String(gantt.barHeight));
  });

  test('幅が取れない時（0 以下）は、ガントチャートの幅を指定しない', () => {
    assert.strictEqual(mermaidConfig('paper', 0).gantt.useWidth, undefined);
  });
});
