import json
from collections import Counter
from pathlib import Path

cards = json.loads(Path('/home/user/xrossstars_bp01_bp03_official_cards.json').read_text(encoding='utf-8'))
texts = Counter((c.get('text') or '').strip() for c in cards if (c.get('text') or '').strip())
for text, count in texts.most_common():
    print(f'[{count}] {text}')
