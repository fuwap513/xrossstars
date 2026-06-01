import json
from pathlib import Path
from collections import defaultdict

SRC = Path('/home/user/xrossstars-react-mvp/scripts/xross_unimplemented_26_todo.json')
OUT_MD = Path('/home/user/xrossstars-react-mvp/scripts/xross_p1_detailed_workplan.md')
OUT_JSON = Path('/home/user/xrossstars-react-mvp/scripts/xross_p1_detailed_workplan.json')
OUT_CSV = Path('/home/user/xrossstars-react-mvp/scripts/xross_p1_detailed_workplan.csv')

report = json.loads(SRC.read_text(encoding='utf-8'))
rows = [r for r in report['rows'] if r['priority'] == 'P1']

# 実装順は「共通処理を先に入れると一気に片付く」順にする
# 1) 共通アタックコスト/手札discard系
# 2) 共通アタック後ドロー/捨てる系
# 3) 共通メモリア(プレイ時 + 次アタック強化)系
# 4) 例外カード

def derive_group(row):
    name = row['name']
    text = row['text']
    t = row['type']
    if t == 'attack' and '手札を1枚捨ててもよい' in text:
        return 'A1: アタック前 任意ディスカード→打点上昇 共通化'
    if t == 'attack' and 'コスト0のカード1枚を公開し、捨ててもよい' in text:
        return 'A2: アタック前 コスト0公開/捨て→ドロー+打点 共通化'
    if t == 'attack' and 'すべてのプレイヤーは手札を1枚捨てる' in text:
        return 'A3: アタック後 全員ディスカード'
    if t == 'attack' and 'プレイエリアにあるメモリアカードのコストの合計と同じ数のカードを引く' in text:
        return 'A4: アタック後 メモリア総コスト参照ドロー'
    if t == 'attack' and '【アタック強化】次のアタックのダメージ+20' in text:
        return 'A5: アタックカード自身が次アタック強化を付与'
    if t == 'memoria' and 'カードを2枚引き、手札を2枚捨てる' in text and '次のアタックのダメージ+30' in text:
        return 'M1: 2ドロー2ディスカード + 次アタック+30 共通化'
    if t == 'memoria' and '自分のデッキの上から1枚を見る' in text:
        return 'M2: 山上1枚確認→任意トラッシュ + 次アタック+10'
    if t == 'memoria' and '別の「引っ張り合い」' in text:
        return 'M3: 同名カード参照のコスト踏み倒し + 次アタック+40'
    if t == 'memoria' and '自分のリーダー1体を30回復する' in text and '次のアタックのダメージ+30' in text:
        return 'M4: 単体30回復 + 次アタック+30 共通化'
    if t == 'memoria' and 'カードを1枚引き、手札を1枚捨てる' in text:
        return 'M5: 1ドロー1ディスカード'
    return 'Z: 個別確認'


def derive_touchpoints(row):
    text = row['text']
    touches = ['src/store/battleEffects.ts']
    if '捨ててもよい' in text or '公開' in text:
        touches.append('src/App.tsx')
        touches.append('入力UI/確認モーダル')
    if '見る' in text or '公開' in text:
        touches.append('山札確認UI')
    return ' / '.join(dict.fromkeys(touches))


def derive_steps(row):
    text = row['text']
    steps = []
    if row['type'] == 'attack':
        steps.append('attack前処理フックを追加')
        if '捨ててもよい' in text:
            steps.append('任意ディスカード分岐を追加')
        if '公開' in text:
            steps.append('コスト0カード存在確認と選択UIを追加')
        if 'ダメージ+20' in text or 'ダメージ+40' in text:
            steps.append('一時打点加算を実装')
        if 'カードを1枚引く' in text:
            steps.append('解決後1ドローを追加')
        if 'すべてのプレイヤーは手札を1枚捨てる' in text:
            steps.append('attack後の両者ディスカードを追加')
        if 'メモリアカードのコストの合計' in text:
            steps.append('field memoria cost集計関数を追加')
            steps.append('集計値ぶんドローを追加')
        if '【アタック強化】次のアタックのダメージ+20' in text:
            steps.append('このカード解決後にnextAttackBuffへ+20付与')
    else:
        steps.append('memoria play解決に複合効果を追加')
        if 'カードを2枚引き、手札を2枚捨てる' in text:
            steps.append('2ドロー2ディスカードを先に解決')
        if '自分のデッキの上から1枚を見る' in text:
            steps.append('山上1枚確認状態を追加')
            steps.append('任意でtrash移動するyes/noを追加')
        if '別の「引っ張り合い」' in text:
            steps.append('field同名枚数判定を追加')
            steps.append('コスト0プレイ分岐を追加')
        if '自分のリーダー1体を30回復する' in text:
            steps.append('対象1体30回復を追加')
        if 'カードを1枚引き、手札を1枚捨てる' in text:
            steps.append('1ドロー1ディスカードを追加')
        if '次のアタックのダメージ+30' in text or '次のアタックのダメージ+40' in text or '次のアタックのダメージ+10' in text:
            steps.append('後段でnextAttackBuffを加算')
    return ' → '.join(steps)


def derive_tests(row):
    text = row['text']
    tests = []
    if row['type'] == 'attack':
        tests.append('通常使用時')
        if '捨ててもよい' in text:
            tests.append('任意効果を使う/使わない')
        if '公開' in text:
            tests.append('コスト0あり/なし')
        if 'アタック後' in text:
            tests.append('アタック後効果の発火確認')
        tests.append('リーサル計算')
    else:
        tests.append('プレイ時即時効果')
        if '引っ張り合い' in row['name']:
            tests.append('同名1枚あり/0枚/2枚以上')
        if '見る' in text:
            tests.append('見たカードを残す/捨てる')
        tests.append('次アタックへのbuff持ち越し')
    return ' / '.join(tests)


def estimate_points(row):
    text = row['text']
    score = 2
    if '公開' in text or '見る' in text:
        score += 2
    if '捨ててもよい' in text:
        score += 1
    if '別の「' in text:
        score += 1
    if 'メモリアカードのコストの合計' in text:
        score += 1
    return score


def phase(group):
    mapping = {
        'A1: アタック前 任意ディスカード→打点上昇 共通化': 1,
        'A2: アタック前 コスト0公開/捨て→ドロー+打点 共通化': 2,
        'A3: アタック後 全員ディスカード': 3,
        'A4: アタック後 メモリア総コスト参照ドロー': 3,
        'A5: アタックカード自身が次アタック強化を付与': 4,
        'M1: 2ドロー2ディスカード + 次アタック+30 共通化': 5,
        'M2: 山上1枚確認→任意トラッシュ + 次アタック+10': 6,
        'M3: 同名カード参照のコスト踏み倒し + 次アタック+40': 7,
        'M4: 単体30回復 + 次アタック+30 共通化': 5,
        'M5: 1ドロー1ディスカード': 5,
        'Z: 個別確認': 9,
    }
    return mapping.get(group, 9)

expanded = []
for row in rows:
    group = derive_group(row)
    expanded.append({
        **row,
        'work_group': group,
        'phase': phase(group),
        'estimated_points': estimate_points(row),
        'touchpoints': derive_touchpoints(row),
        'detailed_steps': derive_steps(row),
        'test_cases': derive_tests(row),
    })

expanded.sort(key=lambda r: (r['phase'], r['work_group'], r['officialSet'], r['officialCardNumber']))

summary_by_group = defaultdict(int)
for r in expanded:
    summary_by_group[r['work_group']] += 1

OUT_JSON.write_text(json.dumps({
    'summary': {
        'total_p1_cards': len(expanded),
        'groups': dict(summary_by_group),
    },
    'rows': expanded,
}, ensure_ascii=False, indent=2), encoding='utf-8')

csv_lines = ['phase,work_group,estimated_points,officialSet,officialCardNumber,name,type,touchpoints,detailed_steps,test_cases,officialUrl,text']
for r in expanded:
    vals = [r['phase'], r['work_group'], r['estimated_points'], r['officialSet'], r['officialCardNumber'], r['name'], r['type'], r['touchpoints'], r['detailed_steps'], r['test_cases'], r['officialUrl'], r['text']]
    esc = []
    for v in vals:
        s = str(v).replace('"','""')
        esc.append(f'"{s}"')
    csv_lines.append(','.join(esc))
OUT_CSV.write_text('\n'.join(csv_lines), encoding='utf-8')

md = []
md.append('# Xross Stars P1詳細作業表')
md.append('')
md.append(f'- 対象: P1 {len(expanded)}枚')
md.append('- 方針: 共通処理を先に実装して、複数カードをまとめて解消する順番で並べ替え')
md.append('')
md.append('## 作業グループ要約')
for k, v in sorted(summary_by_group.items(), key=lambda kv: phase(kv[0])):
    md.append(f'- Phase {phase(k)} / {k}: {v}枚')
md.append('')
for current_phase in sorted(set(r['phase'] for r in expanded)):
    md.append(f'## Phase {current_phase}')
    md.append('')
    md.append('|No.|カード名|グループ|主変更箇所|詳細手順|テスト観点|工数pt|')
    md.append('|---|---|---|---|---|---|---:|')
    for r in [x for x in expanded if x['phase'] == current_phase]:
        md.append(f"|{r['officialCardNumber']}|{r['name']}|{r['work_group']}|{r['touchpoints']}|{r['detailed_steps']}|{r['test_cases']}|{r['estimated_points']}|")
    md.append('')
OUT_MD.write_text('\n'.join(md), encoding='utf-8')

print('MD:', OUT_MD)
print('JSON:', OUT_JSON)
print('CSV:', OUT_CSV)
print('TOTAL:', len(expanded))
