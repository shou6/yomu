# Yomu - Markdown Reader with Japanese Typography

[![CI](https://github.com/shou6/yomu/actions/workflows/ci.yml/badge.svg)](https://github.com/shou6/yomu/actions/workflows/ci.yml)

[日本語](README.ja.md)

Yomu opens a Markdown file in a dedicated reader tab, typeset for reading Japanese text.
It is a viewer, not an editor: when you want to edit, open the file in the regular text editor.

![A Markdown document in the Yomu reader tab with the paper theme](images/reader-paper.png)

## Features

- **Reader tab**: opens `.md` files as a custom editor tab. The default editor stays untouched; open the reader explicitly from the book icon in the editor title bar, the Command Palette, or "Reopen Editor With...".
- **Japanese typography**: separate fonts for Japanese and Latin text, comfortable line height, and tighter spacing around Japanese punctuation. Japanese gothic and mincho fonts are bundled, so the text looks the same on every OS.
- **Rendering**: CommonMark plus GFM tables, strikethrough and task lists, syntax highlighting for code blocks, Mermaid diagrams, heading anchors, local and remote images, and YAML front matter shown as a table. Raw HTML is disabled.
- **Themes**: `paper` (white page), `sepia`, `dark`, Solarized, GitHub, Nord, Catppuccin, and `vscode` (follows your color theme). All share the same structure: clear heading levels, tables with horizontal rules, and soft code blocks.
- **Outline**: click the Yomu (book) icon in the activity bar to see the headings of the document you are reading. Click to jump; the current heading follows your scrolling.
- **Links between documents**: relative links to other Markdown files open in the reader (with `#heading` support). Go back with **Alt+Left**.
- **Reading progress**: the status bar shows how far you have read. Yomu remembers where you stopped and continues from there next time. The **Reading History** view in the Yomu side bar lists recent documents with their progress.
- **Print and PDF**: run **Yomu: Open in Browser to Print** (or use the reader tab's `...` menu). The document opens in your browser with print styles, ready to print or save as PDF.
- **Folding long code**: code blocks longer than 20 lines are folded, with a button to show the rest. Change the limit with `yomu.code.foldLines`.
- **Focus mode**: dims everything except the block you are reading. Toggle it with **Yomu: Toggle Focus Mode** or `yomu.focusMode`.
- **Zoom**: click an image or a Mermaid diagram to view it full screen. Scroll to zoom, drag to pan, double-click to fit, Esc to close.
- **Live update**: editing and saving the file in the text editor updates the reader tab.

## Title bar buttons

The reader tab shows three buttons at the top right:

- **Focus mode**: an eye icon turns it on, a closed eye turns it off.
- **Print**: opens the document in your browser to print or save as PDF.
- **Open in Text Editor**: switches back to the text editor to edit, with the cursor on the line you were reading.

## Usage

1. Open a `.md` file.
2. Click the book icon in the editor title bar, or open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and run **Yomu: Open in Reader**.
   You can also use **Reopen Editor With...** and choose **Yomu Reader**.
3. To edit, click **Open in Text Editor** in the title bar, or use **Reopen Editor With...** and choose **Text Editor**.

![Syntax-highlighted code blocks with language labels](images/code-block.png)

## Settings

All settings start with `yomu.` and apply to open reader tabs immediately.

| Setting | Default | What it does |
| --- | --- | --- |
| `yomu.theme` | `paper` | Color theme: `paper` (white page), `sepia` (warm page), `dark`, `solarized-light`, `solarized-dark`, `github-light`, `github-dark`, `nord`, `catppuccin-latte`, `catppuccin-mocha`, or `vscode` (follows your VS Code theme). High-contrast VS Code themes always use the VS Code colors. |
| `yomu.layout.maxWidth` | `820` | Maximum width of the text in pixels. `0` means no limit. |
| `yomu.layout.align` | `center` | Where the text sits when the window is wider: `left`, `center`, or `right`. |
| `yomu.layout.padding` | `32` | Horizontal padding around the text in pixels. |
| `yomu.font.family` | Latin fonts, then Japanese fonts | CSS `font-family` for the text. Put Latin fonts first and Japanese fonts after them so each script uses its own font. |
| `yomu.font.codeFamily` | (empty) | Font for code. Empty means a Japanese monospace font with an exact 1:2 width ratio (BIZ UDGothic, Osaka-Mono, Noto Sans Mono CJK JP), with box-drawing characters narrowed to half width, so text diagrams line up even with Japanese in them. |
| `yomu.font.size` | `16` | Font size in pixels. |
| `yomu.font.lineHeight` | `1.8` | Line height as a multiple of the font size. |
| `yomu.code.foldLines` | `20` | Fold code blocks longer than this many lines. `0` never folds. |
| `yomu.focusMode` | `false` | Dim everything except the block you are reading. Also toggled by **Yomu: Toggle Focus Mode**. |
| `yomu.outline.revealOnOpen` | `false` | Open the Outline view automatically when you open a reader tab. |
| `yomu.customCss` | (empty) | Path to a CSS file loaded after the theme. Absolute, or starting with `${workspaceFolder}`. Saved changes apply immediately. |

### Themes

![All 11 themes: paper, sepia, dark, Solarized, GitHub, Nord, Catppuccin, and vscode](images/themes.png)

### Bundled fonts

Three Japanese fonts ship with the extension, under the SIL Open Font License. Use their names in `yomu.font.family`:

- `BIZ UDPGothic` (Morisawa): a universal-design gothic made for legibility. Regular and Bold.
- `Noto Sans JP` (Google): a variable font with weights 100 to 900.
- `BIZ UDPMincho` (Morisawa): a universal-design mincho (serif) for book-like reading. Regular and Bold. Not used by default.

The default puts Latin fonts first and `Noto Sans JP` after them. To use a bundled font for everything, put it first:

```json
"yomu.font.family": "'BIZ UDPGothic', sans-serif"
```

To read in mincho:

```json
"yomu.font.family": "Georgia, 'BIZ UDPMincho', serif"
```

### Custom CSS

Every color is a CSS variable on `body`, so a small file is enough to restyle the reader:

```css
body {
  --yomu-link: rebeccapurple;
  --yomu-h2-border: #888;
}
```

Variables:

- Page: `--yomu-bg` `--yomu-fg` `--yomu-link` `--yomu-hr`
- Headings: `--yomu-h1` to `--yomu-h5`, `--yomu-h1-border` to `--yomu-h3-border`
- Tables: `--yomu-th` `--yomu-th-border` `--yomu-td-border` `--yomu-row-hover`
- Code: `--yomu-pre-bg` `--yomu-pre-border` `--yomu-code-bg` `--yomu-code-fg` `--yomu-code-label-fg` `--yomu-code-label-bg`
- Quotes: `--yomu-quote-border` `--yomu-quote-bg` `--yomu-quote-fg`
- Syntax highlighting: `--yomu-hl-keyword` `--yomu-hl-string` `--yomu-hl-number` `--yomu-hl-comment` `--yomu-hl-function` `--yomu-hl-type` `--yomu-hl-variable` `--yomu-hl-attr` `--yomu-hl-meta`

Any other rule works too. The text lives in `<main id="content">`, and code blocks with a language are wrapped in `<div class="yomu-code" data-lang="…">`.

## Requirements

- Visual Studio Code 1.138 or later

## License

[MIT](LICENSE)
