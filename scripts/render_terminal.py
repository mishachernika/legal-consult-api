#!/usr/bin/env python3
"""Рендерить текстовий вивід терміналу у PNG-скріншот (стиль macOS Terminal).

Використання: python scripts/render_terminal.py <вхідний.txt> <вихідний.png> <заголовок>
"""
import re
import sys

from PIL import Image, ImageDraw, ImageFont

FONT = '/System/Library/Fonts/Menlo.ttc'


def render(txt_path, png_path, title):
    text = open(txt_path, encoding='utf-8').read()
    text = re.sub(r'\x1b\[[0-9;]*m', '', text)  # прибрати ANSI-коди
    lines = text.rstrip('\n').split('\n')

    font = ImageFont.truetype(FONT, 13, index=0)
    pad, title_h, line_h = 16, 36, 19
    maxw = max((font.getlength(l) for l in lines), default=0)
    width = int(min(max(maxw + 2 * pad, 640), 1700))
    height = int(title_h + len(lines) * line_h + pad)

    img = Image.new('RGB', (width, height), (24, 24, 26))
    d = ImageDraw.Draw(img)

    # заголовок вікна з трьома кнопками
    d.rectangle([0, 0, width, title_h], fill=(45, 45, 48))
    for i, c in enumerate([(255, 95, 86), (255, 189, 46), (39, 201, 63)]):
        d.ellipse([14 + i * 22, 12, 26 + i * 22, 24], fill=c)
    d.text((60, 10), title, fill=(220, 220, 220), font=font)

    y = title_h + 8
    for line in lines:
        color = (230, 230, 230)
        if line.startswith('PASS') or '✔' in line:
            color = (90, 220, 120)
        elif line.startswith('FAIL') or '✖' in line:
            color = (255, 110, 100)
        elif line.startswith('$ '):
            color = (120, 200, 255)
        elif line.startswith('ℹ'):
            color = (160, 160, 160)
        d.text((pad, y), line, fill=color, font=font)
        y += line_h

    img.save(png_path)
    print(png_path, img.size)


if __name__ == '__main__':
    render(sys.argv[1], sys.argv[2], sys.argv[3])
