"""Draws the Strong & Steady icon (a figure with arms raised under a gold star) at every size needed.
Run from the project folder: python3 tools/make_icons.py"""
import pathlib
from PIL import Image, ImageDraw

root = pathlib.Path(__file__).resolve().parent.parent
TEAL, GOLD, WHITE = (14, 90, 87, 255), (232, 170, 50, 255), (255, 255, 255, 255)

def star(d, cx, cy, r, fill):
    import math
    pts = []
    for i in range(10):
        a = -math.pi / 2 + i * math.pi / 5
        rr = r if i % 2 == 0 else r * 0.45
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    d.polygon(pts, fill=fill)

def figure(d, S, scale=1.0, ox=0, oy=0):
    """Figure drawn on a 1000-unit canvas, scaled."""
    k = S / 1000 * scale
    o = (S - S * scale) / 2
    P = lambda x, y: (o + ox + x * k, o + oy + y * k)
    w = int(62 * k)
    d.ellipse([*P(440, 300), *P(560, 420)], fill=WHITE)                     # head
    for a, b in [((500, 440), (500, 690)),                                   # body
                 ((500, 480), (330, 330)), ((500, 480), (670, 330)),         # arms up
                 ((500, 690), (400, 880)), ((500, 690), (600, 880))]:        # legs
        d.line([P(*a), P(*b)], fill=WHITE, width=w)
        for x, y in (a, b):
            cx, cy = P(x, y); d.ellipse([cx - w / 2, cy - w / 2, cx + w / 2, cy + w / 2], fill=WHITE)
    cx, cy = P(500, 170); star(d, cx, cy, 120 * k, GOLD)

def full(S, radius=0.22, pad=1.0):
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * radius), fill=TEAL)
    figure(d, S, pad); return im

def big(fn, S, **kw):
    im = fn(S * 4, **kw); return im.resize((S, S), Image.LANCZOS)

icons = root / "app" / "icons"; icons.mkdir(parents=True, exist_ok=True)
big(full, 192).save(icons / "icon-192.png")
big(full, 512).save(icons / "icon-512.png")
big(lambda S: full(S, radius=0, pad=0.72), 512).save(icons / "icon-maskable-512.png")
big(lambda S: full(S, radius=0, pad=0.92), 180).save(icons / "apple-touch-icon.png")

res = root / "native" / "res"
for dpi, legacy, fg in [("mdpi", 48, 108), ("hdpi", 72, 162), ("xhdpi", 96, 216), ("xxhdpi", 144, 324), ("xxxhdpi", 192, 432)]:
    m = res / ("mipmap-" + dpi); m.mkdir(parents=True, exist_ok=True)
    big(lambda S: full(S, radius=0.18, pad=0.95), legacy).save(m / "ic_launcher.png")
    def rnd(S):
        im = Image.new("RGBA", (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
        d.ellipse([0, 0, S - 1, S - 1], fill=TEAL); figure(d, S, 0.82); return im
    big(rnd, legacy).save(m / "ic_launcher_round.png")
    def fore(S):
        im = Image.new("RGBA", (S, S), (0, 0, 0, 0)); figure(ImageDraw.Draw(im), S, 0.6); return im
    big(fore, fg).save(m / "ic_launcher_foreground.png")
(res / "values").mkdir(parents=True, exist_ok=True)
(res / "values" / "ic_launcher_background.xml").write_text('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#0E5A57</color>\n</resources>\n')
(res / "drawable").mkdir(parents=True, exist_ok=True)
(res / "drawable" / "ic_stat_steady.xml").write_text('''<?xml version="1.0" encoding="utf-8"?>
<!-- Notification icon: a figure with arms raised (white silhouette; Android tints it). -->
<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24">
  <path android:fillColor="#FFFFFFFF" android:pathData="M12,2.2l0.9,1.9 2.1,0.3 -1.5,1.4 0.4,2.1 -1.9,-1 -1.9,1 0.4,-2.1 -1.5,-1.4 2.1,-0.3z"/>
  <path android:fillColor="#FFFFFFFF" android:pathData="M12,8.6a1.5,1.5 0,1 1,0 3a1.5,1.5 0,1 1,0 -3z"/>
  <path android:strokeColor="#FFFFFFFF" android:strokeWidth="1.6" android:strokeLineCap="round" android:pathData="M12,12.4V17.2M12,13.2L8.2,10.2M12,13.2L15.8,10.2M12,17.2L9.8,21.4M12,17.2L14.2,21.4"/>
</vector>
''')
print("Icons written")

# Splash screens (cream background, the icon in the middle)
CREAM = (250, 246, 238, 255)
for name, (w, h) in {"splash-port.png": (1080, 1920), "splash-land.png": (1920, 1080)}.items():
    im = Image.new("RGBA", (w, h), CREAM)
    ic = big(full, 360)
    im.paste(ic, ((w - 360) // 2, (h - 360) // 2), ic)
    im.convert("RGB").save(res / name)
print("Splash screens written")
