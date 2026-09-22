import * as assert from 'assert';
import { resourceRoots } from '../../reader/resourceRoots';

suite('resourceRoots', () => {
  test('ドキュメントがワークスペース内なら、ワークスペースフォルダだけ', () => {
    assert.deepStrictEqual(resourceRoots('/ws/docs', ['/ws']), ['/ws']);
    assert.deepStrictEqual(resourceRoots('/ws', ['/ws']), ['/ws']);
  });

  test('ドキュメントがワークスペース外なら、そのフォルダも足す', () => {
    assert.deepStrictEqual(resourceRoots('/other/notes', ['/ws']), ['/ws', '/other/notes']);
    // 名前が前方一致するだけの別フォルダは「内」とみなさない
    assert.deepStrictEqual(resourceRoots('/ws2/docs', ['/ws']), ['/ws', '/ws2/docs']);
  });

  test('ワークスペースフォルダが複数あれば全部入れる', () => {
    assert.deepStrictEqual(resourceRoots('/b/x', ['/a', '/b']), ['/a', '/b']);
    assert.deepStrictEqual(resourceRoots('/c', ['/a', '/b']), ['/a', '/b', '/c']);
  });

  test('ワークスペースを開いていなければ、ドキュメントのフォルダだけ', () => {
    assert.deepStrictEqual(resourceRoots('/c', []), ['/c']);
  });

  test('Windows の区切りと末尾の区切りの違いを吸収する', () => {
    assert.deepStrictEqual(resourceRoots('C:\\ws\\docs', ['C:\\ws\\']), ['C:\\ws\\']);
  });
});
