/**
 * 長いコードブロックの折りたたみの判定（純粋関数）。Webview 側から使う。
 */

/** コードの行数。末尾の改行は数えない */
export function countLines(text: string): number {
  if (text === '') {
    return 0;
  }
  const lines = text.split(/\r?\n/);
  return lines[lines.length - 1] === '' ? lines.length - 1 : lines.length;
}

/**
 * @param lines コードの行数
 * @param foldLines 設定 yomu.code.foldLines。これより長いコードを畳む。0 なら畳まない
 */
export function shouldFold(lines: number, foldLines: number): boolean {
  return foldLines > 0 && lines > foldLines;
}
