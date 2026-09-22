/**
 * 設定 yomu.customCss のパスを解決する（純粋関数）。
 * 絶対パスか、`${workspaceFolder}` から始まるパスだけを受け付ける。
 * ファイルの有無の確認と通知は Provider が行う。
 */

export type CustomCssResolution = { path: string } | { error: 'noWorkspace' | 'notAbsolute' };

const WORKSPACE_FOLDER = '${workspaceFolder}';

/** `/…`、`C:\…`、`C:/…`、`\\server\…` */
const ABSOLUTE = /^([a-zA-Z]:[\\/]|\/|\\\\)/;

/**
 * @param setting 設定の値（前後の空白は落としてある前提だが、念のため落とす）
 * @param workspaceFolders 開いているワークスペースフォルダの fsPath
 * @returns 指定なしなら undefined
 */
export function resolveCustomCss(
  setting: string,
  workspaceFolders: readonly string[]
): CustomCssResolution | undefined {
  const value = setting.trim();
  if (value === '') {
    return undefined;
  }
  if (value.startsWith(WORKSPACE_FOLDER)) {
    const folder = workspaceFolders[0];
    if (folder === undefined) {
      return { error: 'noWorkspace' };
    }
    const rest = value.slice(WORKSPACE_FOLDER.length);
    const separator = /^[\\/]/.test(rest) ? '' : '/';
    return { path: folder.replace(/[\\/]+$/, '') + separator + rest };
  }
  return ABSOLUTE.test(value) ? { path: value } : { error: 'notAbsolute' };
}
