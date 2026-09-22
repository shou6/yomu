/**
 * README のテーマ比較の画像（images/themes.png）の配置を決める（scripts/compose-themes.js が使う）。
 * 画像を読んで描くのは scripts/compose-themes.py で、ここはどこに何を置くかだけを決める。
 */

export interface ThemeImageTile {
  label: string;
  source: string;
  /** テーマ名を書く左上の位置 */
  x: number;
  y: number;
  /** 画像を置く上端 */
  imageY: number;
}

export interface ThemeImagePlan {
  width: number;
  height: number;
  crop: { width: number; height: number };
  tileWidth: number;
  tileHeight: number;
  labelHeight: number;
  tiles: ThemeImageTile[];
}

export function screenshotPath(_dir: string, _theme: string): string {
  throw new Error('not implemented');
}

export function planThemeImage(
  _themes: readonly string[],
  _dir: string,
  _exists: (file: string) => boolean
): ThemeImagePlan {
  throw new Error('not implemented');
}
