"""Generate simple app icons for the Klondike PWA (no external assets, offline-safe)."""
from PIL import Image, ImageDraw, ImageFont
import os

OUT_DIR = os.path.join(os.path.dirname(__file__), "icons")
os.makedirs(OUT_DIR, exist_ok=True)

BG = (18, 92, 61)       # deep felt green
CARD_BG = (250, 248, 240)
SUIT_RED = (196, 46, 46)
SUIT_BLACK = (30, 30, 34)


def draw_icon(size, filename, padding_ratio=0.12, rounded_ratio=0.22):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # background rounded square
    radius = int(size * rounded_ratio)
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=BG)

    # a single stylised card, tilted look via two overlapping rounded rects
    pad = int(size * padding_ratio)
    card_w = size - pad * 2
    card_h = int(card_w * 1.4)
    if card_h > size - pad * 2:
        card_h = size - pad * 2
        card_w = int(card_h / 1.4)
    cx = size // 2
    cy = size // 2
    card_radius = int(card_w * 0.12)

    # shadow card (slightly offset, rotated look simulated by offset only)
    shadow_box = [cx - card_w // 2 + int(size * 0.05), cy - card_h // 2 + int(size * 0.05),
                  cx + card_w // 2 + int(size * 0.05), cy + card_h // 2 + int(size * 0.05)]
    draw.rounded_rectangle(shadow_box, radius=card_radius, fill=(0, 0, 0, 60))

    # main card
    box = [cx - card_w // 2, cy - card_h // 2, cx + card_w // 2, cy + card_h // 2]
    draw.rounded_rectangle(box, radius=card_radius, fill=CARD_BG)

    # suit glyph (spade) drawn as simple polygon + triangle stem for crispness at small sizes
    suit_h = int(card_h * 0.5)
    suit_w = int(suit_h * 0.9)
    sx = cx
    sy = cy - int(card_h * 0.05)

    # spade shape approximated with a heart-like top (two circles) + triangle bottom, inverted
    top_r = suit_w // 4
    draw.ellipse([sx - top_r * 2, sy - suit_h // 2, sx, sy - suit_h // 2 + top_r * 2], fill=SUIT_BLACK)
    draw.ellipse([sx, sy - suit_h // 2, sx + top_r * 2, sy - suit_h // 2 + top_r * 2], fill=SUIT_BLACK)
    draw.polygon([
        (sx, sy - suit_h // 2 + top_r),
        (sx - suit_w // 2, sy + suit_h // 6),
        (sx + suit_w // 2, sy + suit_h // 6),
    ], fill=SUIT_BLACK)
    # stem
    stem_w = max(2, suit_w // 8)
    draw.polygon([
        (sx - stem_w, sy + suit_h // 6),
        (sx + stem_w, sy + suit_h // 6),
        (sx + stem_w * 2, sy + suit_h // 2),
        (sx - stem_w * 2, sy + suit_h // 2),
    ], fill=SUIT_BLACK)

    img.save(os.path.join(OUT_DIR, filename))
    print("wrote", filename, size)


for size, name in [
    (192, "icon-192.png"),
    (512, "icon-512.png"),
    (180, "apple-touch-icon.png"),
    (32, "favicon-32.png"),
    (167, "apple-touch-icon-167.png"),
]:
    draw_icon(size, name)

# maskable icon needs more padding so the shape sits inside the safe zone
draw_icon(512, "icon-512-maskable.png", padding_ratio=0.24)
