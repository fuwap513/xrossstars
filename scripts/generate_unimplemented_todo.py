import json
from pathlib import Path

AUDIT_PATH = Path('/home/user/xrossstars-react-mvp/scripts/xross_audit_table.json')
OUT_MD = Path('/home/user/xrossstars-react-mvp/scripts/xross_unimplemented_26_todo.md')
OUT_JSON = Path('/home/user/xrossstars-react-mvp/scripts/xross_unimplemented_26_todo.json')
OUT_CSV = Path('/home/user/xrossstars-react-mvp/scripts/xross_unimplemented_26_todo.csv')

report = json.loads(AUDIT_PATH.read_text(encoding='utf-8'))
rows = [row for row in report['rows'] if row['status'] == '未対応']

# 優先順位づけ方針（実戦練習向けの作業優先）
# P1: 対戦中に頻発しやすい/勝敗影響が大きい攻撃カード・中核メモリア
# P2: 実戦影響は大きいが条件付き/特殊処理寄り
# P3: PPカードや特殊周辺処理など、完全性には重要だが通常の単体効果より後回しでよいもの

def classify_priority(row):
    card_type = row['type']
    text = row['text']
    name = row['name']

    if card_type == 'pp':
        return 'P3', 'PPカード固有ルール統合', '後攻やPP運用の完全再現には必要だが、個別カード解決より先に中核効果の精度を上げる方が練習効率が高い'

    if card_type == 'attack':
        if 'ダメージ' in text or 'アタック後' in text:
            return 'P1', '攻撃カードの勝敗直結処理', '対戦中のリーサル計算・打点判断に直結するため最優先'
        return 'P2', '攻撃カード特殊処理', '攻撃カードだが条件や特殊処理の比重が高いので第2優先'

    if card_type == 'memoria':
        if 'プレイ時' in text or 'アタック強化' in text:
            return 'P1', 'メモリアの中核プレイ効果', 'ドロー・打点形成・盤面形成に直結するため最優先'
        return 'P2', 'メモリア特殊処理', '使用頻度はあるが特殊処理のため第2優先'

    if card_type == 'tactics':
        return 'P2', 'タクティクス特殊処理', 'ラウンド単位の勝敗に影響するため高優先だが、母数は少ない'

    return 'P3', '補助処理', '周辺処理のため後順位'


def implementation_task(row):
    name = row['name']
    text = row['text']
    card_type = row['type']

    tasks = []
    if card_type == 'attack':
        tasks.append('アタック宣言時の追加条件判定を実装')
        if 'アタック後' in text:
            tasks.append('アタック後誘発の解決順を実装')
        if 'ダメージ' in text:
            tasks.append('打点修正または追撃ダメージ処理を実装')
    elif card_type == 'memoria':
        tasks.append('プレイ時効果の解決分岐を追加')
        if 'アタック強化' in text:
            tasks.append('次回/条件付きアタック強化を実装')
        if 'カードを' in text:
            tasks.append('ドロー/探索/公開処理を実装')
    elif card_type == 'tactics':
        tasks.append('タクティクス使用時の固有解決を実装')
    elif card_type == 'pp':
        tasks.append('PPカードの公式配置・使用ルールを対戦開始処理へ統合')

    if '公開' in text or '選ぶ' in text or '好きな' in text:
        tasks.append('UIで対象選択/順序選択を追加')
    if 'プレイしてもよい' in text:
        tasks.append('任意効果の yes/no 分岐を追加')
    if 'タクティクス' in text:
        tasks.append('タクティクス領域との相互作用を検証')

    if not tasks:
        tasks.append('個別カード専用ロジックを追加')
    return ' / '.join(tasks)

priority_order = {'P1': 0, 'P2': 1, 'P3': 2}
priority_group_order = {'攻撃カードの勝敗直結処理': 0, 'メモリアの中核プレイ効果': 1, '攻撃カード特殊処理': 2, 'メモリア特殊処理': 3, 'タクティクス特殊処理': 4, 'PPカード固有ルール統合': 5, '補助処理': 6}

out_rows = []
for row in rows:
    priority, bucket, why = classify_priority(row)
    out_rows.append({
        **row,
        'priority': priority,
        'priority_bucket': bucket,
        'priority_reason': why,
        'implementation_task': implementation_task(row),
    })

out_rows.sort(key=lambda r: (priority_order[r['priority']], priority_group_order.get(r['priority_bucket'], 99), r['officialSet'], r['officialCardNumber']))

summary = {}
for p in ['P1', 'P2', 'P3']:
    summary[p] = sum(1 for row in out_rows if row['priority'] == p)

result = {
    'summary': summary,
    'rows': out_rows,
}
OUT_JSON.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')

csv_lines = ['priority,priority_bucket,officialSet,officialCardNumber,name,type,implementation_task,priority_reason,officialUrl,text']
for r in out_rows:
    vals = [r['priority'], r['priority_bucket'], r['officialSet'], r['officialCardNumber'], r['name'], r['type'], r['implementation_task'], r['priority_reason'], r['officialUrl'], r['text']]
    escaped = []
    for v in vals:
        s = str(v).replace('"', '""')
        escaped.append(f'"{s}"')
    csv_lines.append(','.join(escaped))
OUT_CSV.write_text('\n'.join(csv_lines), encoding='utf-8')

md = []
md.append('# 未対応カード 優先順位付きTODO')
md.append('')
md.append(f'実戦練習・大会想定の優先度で、未対応 {len(out_rows)} 枚を P1 / P2 / P3 に分類。')
md.append('')
md.append('## 件数')
for p in ['P1', 'P2', 'P3']:
    md.append(f'- {p}: {summary[p]} 枚')
md.append('')
if not out_rows:
    md.append('未対応カードはありません。')
    md.append('')
for p in ['P1', 'P2', 'P3']:
    md.append(f'## {p}')
    md.append('')
    md.append('|No.|カード名|タイプ|TODO|優先理由|')
    md.append('|---|---|---|---|---|')
    rows_for_priority = [row for row in out_rows if row['priority'] == p]
    if not rows_for_priority:
        md.append('|-|-|-|該当なし|-|')
    else:
        for r in rows_for_priority:
            md.append(f"|{r['officialCardNumber']}|{r['name']}|{r['type']}|{r['implementation_task']}|{r['priority_reason']}|")
    md.append('')
OUT_MD.write_text('\n'.join(md), encoding='utf-8')

print('MD:', OUT_MD)
print('JSON:', OUT_JSON)
print('CSV:', OUT_CSV)
print('SUMMARY:', summary)
