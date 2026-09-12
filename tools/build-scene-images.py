#!/usr/bin/env python
"""把 sider-batch 出好的场景原图压成网页用的 1600×900 JPEG。

用法（在仓库根目录）：

    python tools/build-scene-images.py            # 处理全部已出图的场景
    python tools/build-scene-images.py ch3-07     # 只处理指定场景

原图：sider-batch/out-场景图/<id>/<id>.png（2K 16:9）
成品：assets/images/scenes/morning-colors/<id>.jpg
"""

import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(ROOT, "sider-batch", "out-场景图")
DST_DIR = os.path.join(ROOT, "assets", "images", "scenes", "morning-colors")
WIDTH, HEIGHT = 1600, 900
QUALITY = 86


def fit_cover(img, width, height):
    """等比缩放到刚好盖住目标框，再居中裁切。"""
    scale = max(width / img.width, height / img.height)
    size = (max(1, round(img.width * scale)), max(1, round(img.height * scale)))
    img = img.resize(size, Image.LANCZOS)
    left = (img.width - width) // 2
    top = (img.height - height) // 2
    return img.crop((left, top, left + width, top + height))


def convert(scene_id):
    src = os.path.join(SRC_DIR, scene_id, scene_id + ".png")
    if not os.path.exists(src):
        return "skip", scene_id
    dst = os.path.join(DST_DIR, scene_id + ".jpg")
    with Image.open(src) as img:
        img = img.convert("RGB")
        out = fit_cover(img, WIDTH, HEIGHT)
        os.makedirs(DST_DIR, exist_ok=True)
        out.save(dst, "JPEG", quality=QUALITY, optimize=True, progressive=True)
    size_kb = os.path.getsize(dst) / 1024
    return "ok", "%s  %dx%d  %.0fKB" % (scene_id, WIDTH, HEIGHT, size_kb)


def main():
    wanted = sys.argv[1:]
    if not wanted:
        wanted = sorted(
            name
            for name in os.listdir(SRC_DIR)
            if os.path.isdir(os.path.join(SRC_DIR, name)) and name.startswith("ch")
        )
    ok = skipped = 0
    for scene_id in wanted:
        status, info = convert(scene_id)
        print(("  ok  " if status == "ok" else " skip ") + info)
        ok += status == "ok"
        skipped += status != "ok"
    print("done: %d converted, %d skipped -> %s" % (ok, skipped, DST_DIR))


if __name__ == "__main__":
    main()
