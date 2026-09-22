# scripts/compose-themes.js から呼ばれ、標準入力の配置（src/tooling/themeImage.ts）どおりに画像を描く。
# 引数: 書き出す PNG のパス
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

BACKGROUND = (225, 225, 225)
LABEL_COLOR = (40, 40, 40)
FONT_SIZE = 20


def label_font():
    for name in ('segoeui.ttf', 'DejaVuSans.ttf', 'Helvetica.ttc'):
        try:
            return ImageFont.truetype(name, FONT_SIZE)
        except OSError:
            pass
    return ImageFont.load_default(FONT_SIZE)


def main():
    plan = json.load(sys.stdin)
    output = sys.argv[1]
    canvas = Image.new('RGB', (plan['width'], plan['height']), BACKGROUND)
    draw = ImageDraw.Draw(canvas)
    font = label_font()
    crop = plan['crop']
    size = (plan['tileWidth'], plan['tileHeight'])
    for tile in plan['tiles']:
        image = Image.open(tile['source']).convert('RGB')
        image = image.crop((0, 0, crop['width'], crop['height'])).resize(size, Image.LANCZOS)
        draw.text((tile['x'] + 2, tile['y']), tile['label'], fill=LABEL_COLOR, font=font)
        canvas.paste(image, (tile['x'], tile['imageY']))
    canvas.save(output, optimize=True)
    print('書き出しました: %s（%dx%d、%d KB）' % (
        output, plan['width'], plan['height'], os.path.getsize(output) // 1024))


main()
