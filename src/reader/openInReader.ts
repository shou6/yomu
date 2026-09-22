/**
 * コマンド「Yomu: Open in Reader」の判断部分。
 * アクティブなエディタが .md ならリーダーで開き、そうでなければメッセージを返す。
 * vscode に依存しないよう、URI は型引数で受け取り、翻訳関数は引数で受け取る。
 */

/** vscode.l10n.t と同じ形の翻訳関数。テストでは翻訳しない関数に差し替える */
export type Translate = (message: string, ...args: string[]) => string;

export interface ActiveDocument<Uri> {
  uri: Uri;
  fileName: string;
}

export type OpenInReaderDecision<Uri> =
  { kind: 'open'; uri: Uri } | { kind: 'message'; message: string };

export function decideOpenInReader<Uri>(
  active: ActiveDocument<Uri> | undefined,
  t: Translate
): OpenInReaderDecision<Uri> {
  if (active === undefined) {
    return { kind: 'message', message: t('No editor is active. Open a .md file first.') };
  }
  if (!/\.md$/i.test(active.fileName)) {
    return {
      kind: 'message',
      message: t('Yomu reads Markdown files. The active editor is not a .md file.'),
    };
  }
  return { kind: 'open', uri: active.uri };
}
