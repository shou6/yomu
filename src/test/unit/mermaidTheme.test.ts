import * as assert from 'assert';
import { mermaidTheme } from '../../reader/mermaidTheme';

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
