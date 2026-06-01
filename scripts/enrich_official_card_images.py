import json
import re
import time
from pathlib import Path
from typing import Optional

import requests

ROOT = Path('/home/user/xrossstars-react-mvp')
PUBLIC_JSON = ROOT / 'public/data/xrossstars-bp01-bp03-official-cards.json'
ROOT_JSON = Path('/home/user/xrossstars_bp01_bp03_official_cards.json')
TIMEOUT = 20
SLEEP_SEC = 0.15
USER_AGENT = 'Mozilla/5.0 (compatible; XrossStarsImageSync/1.0; +https://xross-stars.com/)'

ASSET_PATTERN = re.compile(r'https://assets\.xross-stars\.com/card/[^"\'\s<>\\]+')


def sanitize_url(url: str) -> str:
    return url.rstrip('\\').strip()


def prefer_asset(candidates: list[str], card_number: str) -> Optional[str]:
    if not candidates:
        return None
    normalized = card_number.split('/')[0].replace('/', '')
    prefixed = [url for url in candidates if normalized in url]
    if prefixed:
        return prefixed[0]
    return candidates[0]


def extract_official_image_url(official_url: str, card_number: str, session: requests.Session) -> Optional[str]:
    response = session.get(official_url, timeout=TIMEOUT)
    response.raise_for_status()
    html = response.text
    matches = [sanitize_url(url) for url in ASSET_PATTERN.findall(html)]
    matches = [url for url in dict.fromkeys(matches) if '/card/' in url]
    return prefer_asset(matches, card_number)


def enrich_file(path: Path) -> tuple[int, int]:
    cards = json.loads(path.read_text(encoding='utf-8'))
    updated = 0
    missing = 0
    session = requests.Session()
    session.headers.update({'User-Agent': USER_AGENT})

    for index, card in enumerate(cards, start=1):
      official_url = (card.get('officialUrl') or '').strip()
      card_number = (card.get('officialCardNumber') or '').strip()
      if not official_url:
          card['officialImageUrl'] = None
          card['imageStatus'] = 'missing'
          missing += 1
          continue

      try:
          image_url = extract_official_image_url(official_url, card_number, session)
      except Exception:
          image_url = None

      if image_url:
          card['officialImageUrl'] = image_url
          card['imageStatus'] = 'ready'
          updated += 1
      else:
          card['officialImageUrl'] = None
          card['imageStatus'] = 'missing'
          missing += 1

      if index % 25 == 0:
          print(f'processed {index}/{len(cards)} ... updated={updated} missing={missing}')
      time.sleep(SLEEP_SEC)

    path.write_text(json.dumps(cards, ensure_ascii=False, indent=2), encoding='utf-8')
    return updated, missing


def main() -> None:
    targets = [PUBLIC_JSON]
    if ROOT_JSON.exists():
        targets.append(ROOT_JSON)

    for target in targets:
        updated, missing = enrich_file(target)
        print(f'{target}: updated={updated}, missing={missing}')


if __name__ == '__main__':
    main()
