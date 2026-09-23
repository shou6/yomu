# Yomu - Markdown Reader with Japanese Typography

[![CI](https://github.com/shou6/yomu/actions/workflows/ci.yml/badge.svg)](https://github.com/shou6/yomu/actions/workflows/ci.yml)

[English](README.md)

Yomu は Markdown を専用のリーダータブで開き、日本語を読むための組版で表示する拡張機能です。
編集はしません。直したくなったら標準のテキストエディタで開きます。

![Yomu のリーダータブで Markdown を表示したところ（paper テーマ）](images/reader-paper.png)

## 機能

- **リーダータブ**：`.md` をカスタムエディタのタブで開く。既定のエディタは奪わず、エディタ右上の本のアイコン、コマンドパレット、「エディターを再度開く方法を選択」から明示的に開く
- **日本語組版**：和文と欧文のフォントの出し分け、日本語向けの行間、約物のアキ詰め。和文のゴシック体と明朝体を同梱しているので、どの OS でも同じ見た目になる
- **レンダリング**：CommonMark と GFM の表・取り消し線・タスクリスト・脚注、コードブロックのシンタックスハイライト、Mermaid の図、KaTeX による数式（`$...$`、`$$...$$`、言語が `math` のコードブロック）、見出しのアンカー、ローカルとリモートの画像、折りたたみにした YAML の front matter。生の HTML は `<details>`、`<summary>`、`<kbd>`、`<sub>`、`<sup>`、`<br>` だけを通し、ほかのタグは文字のまま表示し、コメントは隠す
- **テーマ**：`paper`（白地）、`sepia`、`dark`、Solarized、GitHub、Nord、Catppuccin、`vscode`（カラーテーマに追従）。見出しの階層、横線だけの表、淡いコードブロックという構成は共通
- **目次**：左端のアクティビティバーの Yomu（本のアイコン）を押すと、読んでいる文書の見出しが出る。クリックでその見出しへ移動し、スクロールすると今読んでいる見出しが選ばれる
- **文書間のリンク**：他の Markdown への相対リンクはリーダーで開く。`#見出し` 付きならその見出しへ移動する。戻るのは **Alt+←**
- **読了の進捗**：ステータスバーに読んだ割合を出す。文書ごとに読んだ位置を覚え、次に開くと続きから表示する。Yomu のサイドバーの **読書の記録** に、最近読んだ文書を割合つきで並べる
- **印刷と PDF**：**Yomu: ブラウザで開いて印刷** を実行する（リーダータブの右上の `…` からも選べる）。印刷用のスタイルでブラウザに開き、印刷や PDF への保存ができる
- **長いコードの折りたたみ**：20 行を超えるコードブロックは畳んで表示し、ボタンで残りを開く。行数は `yomu.code.foldLines` で変えられる
- **集中モード**：読んでいるブロック以外を薄く表示する。**Yomu: 集中モードの切り替え** か `yomu.focusMode` で切り替える
- **ズーム表示**：画像や Mermaid の図をクリックすると画面いっぱいに表示する。ホイールで拡大・縮小、ドラッグで移動、ダブルクリックで画面に収め、Esc で閉じる
- **編集への追従**：テキストエディタで編集して保存すると、リーダータブの内容が更新される

## タイトルバーのボタン

リーダータブの右上に 3 つのボタンが出ます。

- **集中モード**：目のアイコンでオン、閉じた目のアイコンでオフ
- **印刷**：文書をブラウザで開き、印刷や PDF への保存をする
- **標準エディタで開く**：編集するためにテキストエディタへ戻る。読んでいた箇所の行にカーソルを置く

## 使い方

1. `.md` ファイルを開く
2. エディタ右上の本のアイコンを押す。コマンドパレット（`Ctrl+Shift+P` / `Cmd+Shift+P`）の **Yomu: リーダーで開く** や、「エディターを再度開く方法を選択」の **Yomu Reader** からも開ける
3. 編集する時は、右上の **標準エディタで開く** を押す。「エディターを再度開く方法を選択」から **テキスト エディター** を選んでもよい

![言語ラベル付きでシンタックスハイライトされたコードブロック](images/code-block.png)

## 設定

設定はすべて `yomu.` で始まります。変更は開いているリーダータブへ即座に反映されます。

| 設定 | 既定値 | 内容 |
| --- | --- | --- |
| `yomu.theme` | `paper` | 配色。`paper`（白地）、`sepia`（淡い黄褐色）、`dark`（暗い背景）、`solarized-light`、`solarized-dark`、`github-light`、`github-dark`、`nord`、`catppuccin-latte`、`catppuccin-mocha`、`vscode`（VS Code のテーマに追従）。VS Code のハイコントラストテーマの時は常に VS Code の色を使います |
| `yomu.layout.maxWidth` | `820` | 本文の最大幅（px）。`0` で制限なし |
| `yomu.layout.align` | `center` | ウィンドウが広い時の本文の位置。`left` / `center` / `right` |
| `yomu.layout.padding` | `32` | 本文の左右の余白（px） |
| `yomu.font.family` | 欧文フォント、続けて和文フォント | 本文の `font-family`。欧文フォントを先に、和文フォントを後に並べると、それぞれの文字が自分のフォントで描かれます |
| `yomu.font.codeFamily` | （空） | コードのフォント。空なら半角と全角が 1:2 の和文等幅フォント（BIZ UDGothic、Osaka-Mono、Noto Sans Mono CJK JP）で、罫線だけ半角の幅に縮める。和文を含む図も揃う |
| `yomu.font.size` | `16` | 文字の大きさ（px） |
| `yomu.font.lineHeight` | `1.8` | 行間。文字の大きさに対する倍率 |
| `yomu.code.foldLines` | `20` | この行数より長いコードブロックを畳む。`0` なら畳まない |
| `yomu.frontMatter` | `collapsed` | YAML の front matter の見せ方。`collapsed`（閉じた折りたたみ）、`expanded`（開いた折りたたみ）、`hidden`（表示しない） |
| `yomu.focusMode` | `false` | 読んでいるブロック以外を薄く表示する。**Yomu: 集中モードの切り替え** でも切り替えられます |
| `yomu.outline.revealOnOpen` | `false` | リーダーを開いた時に、目次のビューを自動で開く |
| `yomu.customCss` | （空） | テーマの後に読み込む CSS ファイルのパス。絶対パスか `${workspaceFolder}` から始まるパス。保存すると即座に反映されます |

### テーマ

![11 テーマの比較（paper、sepia、dark、Solarized、GitHub、Nord、Catppuccin、vscode）](images/themes.png)

### 同梱フォント

SIL Open Font License の和文フォントを 3 書体同梱しています。`yomu.font.family` に名前を書けば使えます。

- `BIZ UDPGothic`（モリサワ）：読みやすさを重視したユニバーサルデザインのゴシック体。Regular と Bold
- `Noto Sans JP`（Google）：太さ 100〜900 の可変フォント
- `BIZ UDPMincho`（モリサワ）：読みやすさを重視したユニバーサルデザインの明朝体。Regular と Bold。既定では使わない

既定値は欧文フォントの後に `Noto Sans JP` を置いた並びです。欧文も含めて同梱フォントにしたい時は、先頭に置きます。

```json
"yomu.font.family": "'BIZ UDPGothic', sans-serif"
```

明朝体で読む時は、次のように書きます。

```json
"yomu.font.family": "Georgia, 'BIZ UDPMincho', serif"
```

### カスタム CSS

色はすべて `body` の CSS 変数なので、小さなファイルで見た目を変えられます。

```css
body {
  --yomu-link: rebeccapurple;
  --yomu-h2-border: #888;
}
```

変数の一覧は次のとおりです。

- 全体：`--yomu-bg` `--yomu-fg` `--yomu-link` `--yomu-hr`
- 見出し：`--yomu-h1` から `--yomu-h5`、`--yomu-h1-border` から `--yomu-h3-border`
- 表：`--yomu-th` `--yomu-th-border` `--yomu-td-border` `--yomu-row-hover`
- コードブロック：`--yomu-pre-bg` `--yomu-pre-border`
- インラインコードと言語ラベル：`--yomu-code-bg` `--yomu-code-fg` `--yomu-code-label-fg` `--yomu-code-label-bg`
- 引用：`--yomu-quote-border` `--yomu-quote-bg` `--yomu-quote-fg`
- ハイライト（1）：`--yomu-hl-keyword` `--yomu-hl-string` `--yomu-hl-number` `--yomu-hl-comment`
- ハイライト（2）：`--yomu-hl-function` `--yomu-hl-type` `--yomu-hl-variable` `--yomu-hl-attr` `--yomu-hl-meta`

それ以外の規則も書けます。本文は `<main id="content">` の中にあり、言語指定のあるコードブロックは `<div class="yomu-code" data-lang="…">` で包まれます。

## 動作環境

- Visual Studio Code 1.138 以上

## ライセンス

[MIT](LICENSE)
