/**
 * Webview が読んでよいローカルのフォルダ（localResourceRoots）を決める（純粋関数）。
 * ワークスペースフォルダに加えて、ドキュメントがワークスペースの外にある時はそのフォルダも足す。
 * ワークスペース外の .md を開いた時にも、隣の画像が表示されるようにするため。
 */

/** 区切りを / にそろえ、末尾の / を落とす */
function normalize(dir: string): string {
  return dir.replace(/\\/g, '/').replace(/\/+$/, '');
}

function isInside(dir: string, root: string): boolean {
  const d = normalize(dir);
  const r = normalize(root);
  return d === r || d.startsWith(r + '/');
}

/**
 * @param documentDir ドキュメントのあるフォルダ
 * @param workspaceFolders 開いているワークスペースフォルダ
 * @returns localResourceRoots に渡すフォルダ。元の文字列のまま返す
 */
export function resourceRoots(documentDir: string, workspaceFolders: readonly string[]): string[] {
  const roots = [...workspaceFolders];
  if (!workspaceFolders.some((folder) => isInside(documentDir, folder))) {
    roots.push(documentDir);
  }
  return roots;
}
