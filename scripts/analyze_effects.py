import json
import re
from collections import Counter, defaultdict
from pathlib import Path

src = Path('/home/user/xrossstars_bp01_bp03_official_cards.json')
cards = json.loads(src.read_text(encoding='utf-8'))

prefix_counter = Counter()
text_counter = Counter()
category_examples = defaultdict(list)

patterns = {
    'draw': r'カードを(\d+)枚引',
    'discard': r'手札を(\d+)枚捨て',
    'heal': r'(?:HPを)?(\d+)回復',
    'damage_all_opponents': r'対戦相手のリーダーすべてに(\d+)ダメージ',
    'damage_one_opponent': r'対戦相手のリーダー1体に(\d+)ダメージ',
    'next_attack_buff': r'次の自分のアタック.*?(\d+)ダメージを追加',
    'turn_attack_buff': r'このターン.*?(\d+)ダメージを追加',
    'equipment_attack_buff': r'装備している間、.*?(\d+)ダメージを追加',
    'pp_recover': r'PPを(\d+)回復',
}

for card in cards:
    text = (card.get('text') or '').strip()
    if not text:
        continue
    text_counter[text] += 1
    prefix = re.split(r'[。！?]', text)[0]
    prefix_counter[prefix] += 1
    matched = False
    for key, pat in patterns.items():
        m = re.search(pat, text)
        if m:
            matched = True
            if len(category_examples[key]) < 8:
                category_examples[key].append({
                    'name': card['name'],
                    'num': card.get('officialCardNumber'),
                    'text': text,
                })
    if not matched and len(category_examples['unmatched']) < 40:
        category_examples['unmatched'].append({
            'name': card['name'],
            'num': card.get('officialCardNumber'),
            'type': card.get('type'),
            'text': text,
        })

report = {
    'total_cards': len(cards),
    'unique_texts': len(text_counter),
    'top_prefixes': prefix_counter.most_common(80),
    'category_examples': category_examples,
}

out = Path('/home/user/xrossstars-react-mvp/scripts/effect_analysis_report.json')
out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(out)
