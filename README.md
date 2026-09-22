# Yomu - Markdown Reader with Japanese Typography

[![CI](https://github.com/shou6/yomu/actions/workflows/ci.yml/badge.svg)](https://github.com/shou6/yomu/actions/workflows/ci.yml)

[日本語](README.ja.md)

Yomu opens a Markdown file in a dedicated reader tab, typeset for reading Japanese text.
It is a viewer, not an editor: when you want to edit, open the file in the regular text editor.

## Features

- **Reader tab**: opens `.md` files as a custom editor tab. The default editor stays untouched; open the reader explicitly from the book icon in the editor title bar, the Command Palette, or "Reopen Editor With...".
- **Japanese typography**: separate fonts for Japanese and Latin text, comfortable line height, and tighter spacing around Japanese punctuation. No web fonts are bundled; system fonts are used.
- **Rendering**: CommonMark plus GFM tables, strikethrough and task lists, syntax highlighting for code blocks, heading anchors, local and remote images. Raw HTML is disabled.
- **Paper-like look**: a white page with clear heading levels, tables with horizontal rules, and soft code blocks, regardless of your color theme. High-contrast themes use the theme colors.
- **Live update**: editing and saving the file in the text editor updates the reader tab.

## Usage

1. Open a `.md` file.
2. Click the book icon in the editor title bar, or open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and run **Yomu: Open in Reader**.
   You can also use **Reopen Editor With...** and choose **Yomu Reader**.
3. To edit, use **Reopen Editor With...** and choose **Text Editor**.

## Requirements

- Visual Studio Code 1.138 or later

## License

[MIT](LICENSE)
