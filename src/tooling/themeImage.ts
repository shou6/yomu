import * as path from 'path';

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

/** スクリーンショットの左上から切り出す範囲。見出しから表の 1 行目までが入る */
const CROP = { width: 820, height: 544 };
const SCALE = 0.55;
const COLUMNS = 3;
const GAP = 18;
/** テーマ名を書く帯の高さ */
const LABEL_HEIGHT = 32;

export function screenshotPath(dir: string, theme: string): string {
  return path.join(dir, 'theme-' + theme + '.png');
}

export function planThemeImage(
  themes: readonly string[],
  dir: string,
  exists: (file: string) => boolean
): ThemeImagePlan {
  const missing = themes.map((theme) => screenshotPath(dir, theme)).filter((file) => !exists(file));
  if (missing.length > 0) {
    throw new Error('スクリーンショットが無い: ' + missing.join(', '));
  }
  const tileWidth = Math.floor(CROP.width * SCALE);
  const tileHeight = Math.floor(CROP.height * SCALE);
  const rowHeight = LABEL_HEIGHT + tileHeight;
  const rows = Math.ceil(themes.length / COLUMNS);
  const tiles = themes.map((theme, index): ThemeImageTile => {
    const x = GAP + (index % COLUMNS) * (tileWidth + GAP);
    const y = GAP + Math.floor(index / COLUMNS) * (rowHeight + GAP);
    return { label: theme, source: screenshotPath(dir, theme), x, y, imageY: y + LABEL_HEIGHT };
  });
  return {
    width: COLUMNS * tileWidth + (COLUMNS + 1) * GAP,
    height: rows * rowHeight + (rows + 1) * GAP,
    crop: CROP,
    tileWidth,
    tileHeight,
    labelHeight: LABEL_HEIGHT,
    tiles,
  };
}
