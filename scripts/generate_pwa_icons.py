from pathlib import Path
from PIL import Image, ImageDraw

out_dir = Path('/home/user/xrossstars-react-mvp/public/icons')
out_dir.mkdir(parents=True, exist_ok=True)

sizes = [192, 512]
background = '#0f1115'
panel = '#171b22'
accent = '#5d76ff'
accent2 = '#8fa6ff'
text = '#f5f7fb'

for size in sizes:
    img = Image.new('RGBA', (size, size), background)
    draw = ImageDraw.Draw(img)

    padding = int(size * 0.09)
    draw.rounded_rectangle(
        [padding, padding, size - padding, size - padding],
        radius=int(size * 0.12),
        fill=panel,
        outline=accent,
        width=max(4, size // 64),
    )

    bar_top = int(size * 0.18)
    bar_left = int(size * 0.22)
    bar_right = int(size * 0.78)
    bar_height = max(8, size // 18)
    gap = int(size * 0.09)
    for idx, width_rate in enumerate([1.0, 0.76, 0.52]):
        y = bar_top + idx * gap
        current_right = bar_left + int((bar_right - bar_left) * width_rate)
        draw.rounded_rectangle(
            [bar_left, y, current_right, y + bar_height],
            radius=bar_height // 2,
            fill=accent2 if idx == 0 else accent,
        )

    circle_r = int(size * 0.12)
    cx = int(size * 0.5)
    cy = int(size * 0.72)
    draw.ellipse([cx - circle_r, cy - circle_r, cx + circle_r, cy + circle_r], fill=accent)
    cross = int(circle_r * 0.55)
    thick = max(4, size // 64)
    draw.rounded_rectangle([cx - cross, cy - thick // 2, cx + cross, cy + thick // 2], radius=thick // 2, fill=text)
    draw.rounded_rectangle([cx - thick // 2, cy - cross, cx + thick // 2, cy + cross], radius=thick // 2, fill=text)

    img.save(out_dir / f'icon-{size}.png')

# create apple touch icon from 192 base resized to 180
base = Image.open(out_dir / 'icon-192.png')
base.resize((180, 180)).save(out_dir / 'apple-touch-icon.png')
