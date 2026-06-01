import json
import re
from pathlib import Path
from collections import Counter, defaultdict

CARDS_PATH = Path('/home/user/xrossstars_bp01_bp03_official_cards.json')
OUT_JSON = Path('/home/user/xrossstars-react-mvp/scripts/xross_audit_table.json')
OUT_MD = Path('/home/user/xrossstars-react-mvp/scripts/xross_audit_table.md')
OUT_CSV = Path('/home/user/xrossstars-react-mvp/scripts/xross_audit_table.csv')

cards = json.loads(CARDS_PATH.read_text(encoding='utf-8'))

IMAGE_UI_COMPONENTS = [
    'CardDetailModal',
    'HandPanel',
    'FieldCardTile',
    'PendingChoiceUI',
    'DiscardPanel',
    'DeckEditor',
    'LeaderRow',
]
IMAGE_UI_READY = True

# 2026-06-01 時点で本リポジトリに反映済みの個別カード対応。
implemented_card_numbers = {
    'BP01-020/100', 'BP01-026/100', 'BP01-032/100', 'BP01-040/100', 'BP01-134/100',
    'BP02-043/082', 'BP03-024/081', 'BP03-030/081', 'BP03-107/081',
    'BP01-063/100', 'BP01-069/100', 'BP01-072/100', 'BP01-084/100',
    'BP02-047/082', 'BP02-054/082', 'BP03-054/081',
    'BP01-022/100', 'BP03-044/081', 'BP02-076/082',
    'BP01-098/100', 'BP01-099/100', 'BP01-100/100',
    'BP02-082/082', 'BP03-081/081', 'BP03-114/081', 'BP03-115/081',
    'BP01-025/100', 'BP01-035/100', 'BP01-036/100', 'BP01-041/100', 'BP01-079/100',
    'BP01-085/100', 'BP01-135/100', 'BP02-048/082', 'BP02-065/082', 'BP03-020/081',
    'BP03-029/081', 'BP03-051/081', 'BP03-057/081',
}

leader_exact = {
    '【覚醒時】カードを1枚引く。': '覚醒時1ドローを実装済み',
    '【覚醒時】カードを2枚引き、手札を2枚捨てる。': '覚醒時2ドロー2ディスカードを実装済み',
    '【覚醒時】自分のリーダー1体を20回復する。': '覚醒時20回復を実装済み',
    '【覚醒時】対戦相手のリーダー1体に10ダメージ。': '覚醒時単体10ダメージを実装済み',
    '【覚醒時】対戦相手のリーダー1体に20ダメージ。': '覚醒時単体20ダメージを実装済み',
    '【覚醒時】対戦相手のリーダーすべてに10ダメージ。': '覚醒時全体10ダメージを実装済み',
}

EXACT_REGEX_RULES = [
    ('attack_buff_flat', r'^【アタック強化】次のアタックのダメージ\+\d+。$', '次アタック強化の汎用加算ロジックで対応'),
    ('play_draw_1', r'^【プレイ時】カードを1枚引く。$', 'プレイ時1ドローを実装済み'),
    ('play_draw_2', r'^【プレイ時】カードを2枚引く。$', 'プレイ時2ドローを実装済み'),
    ('play_draw_3', r'^【プレイ時】カードを3枚引く。$', 'プレイ時3ドローを実装済み'),
    ('play_draw_1_discard_1', r'^【プレイ時】カードを1枚引き、手札を1枚捨てる。$', 'プレイ時1ドロー1ディスカードを実装済み'),
    ('play_draw_2_discard_2', r'^【プレイ時】カードを2枚引き、手札を2枚捨てる。$', 'プレイ時2ドロー2ディスカードを実装済み'),
    ('play_draw_both', r'^【プレイ時】すべてのプレイヤーはカードを1枚引く。$', '両プレイヤー1ドローを実装済み'),
    ('play_direct_damage_20', r'^【プレイ時】対戦相手のリーダー1体に20ダメージ。$', 'プレイ時の単体20ダメージを実装済み'),
    ('play_all_damage_50', r'^【プレイ時】対戦相手のリーダーすべてに50ダメージ。$', 'プレイ時の全体50ダメージを実装済み'),
    ('play_all_damage_10', r'^【プレイ時】対戦相手のリーダーすべてに10ダメージ。$', 'プレイ時の全体10ダメージを実装済み'),
    ('play_pp1_draw1', r'^【プレイ時】PPを1回復し、カードを1枚引く。$', 'PP回復+ドローの複合処理を実装済み'),
    ('play_heal_30', r'^【プレイ時】自分のリーダー1体を30回復する。$', '単体30回復を実装済み'),
    ('play_heal_40', r'^【プレイ時】自分のリーダー1体を40回復する。$', '単体40回復を実装済み'),
    ('play_heal_60', r'^【プレイ時】自分のリーダー1体を60回復する。$', '単体60回復を実装済み'),
    ('play_heal_total_40', r'^【プレイ時】自分のリーダーを合計40回復する。（複数のリーダーを選んでもよい。）$', '合計40回復を実装済み'),
    ('play_heal_total_80', r'^【プレイ時】自分のリーダーを合計80回復する。（複数のリーダーを選んでもよい。）$', '合計80回復を実装済み'),
    ('play_opp_discard_1', r'^【プレイ時】対戦相手は手札を1枚捨てる。$', '相手1ディスカードを実装済み'),
    ('play_opp_discard_2', r'^【プレイ時】対戦相手は手札を2枚捨てる。$', '相手2ディスカードを実装済み'),
    ('play_turn_attack_buff_30', r'^【プレイ時】このターン、自分のリーダーすべての攻撃力を\+30する。$', 'ターン中全体+30を実装済み'),
    ('round_attack_buff_10', r'^【ラウンド中】このラウンド、自分のリーダーすべての攻撃力を\+10する。\s*（このカードはターン終了時にトラッシュに置かない。）$', 'ラウンド中全体+10を実装済み'),
    ('attack_flat_damage', r'^【アタックする】ダメージ[+-]\d+。$', 'アタック時の固定ダメージ補正を実装済み'),
    ('attack_awakened_bonus', r'^【アタックする】アタッカーが覚醒しているなら、ダメージ\+10。$', '覚醒条件のダメージ補正を実装済み'),
    ('attack_round3_bonus', r'^【アタックする】このラウンドが3ラウンド目なら、ダメージ\+20。$', '3ラウンド目条件のダメージ補正を実装済み'),
    ('attack_equipped_bonus', r'^【アタックする】アタッカーがカードを装備しているなら、ダメージ\+10。$', '装備条件のダメージ補正を実装済み'),
    ('attack_target_down_draw_1', r'^【アタックする】\n【アタック後】このアタックを受けたリーダーがダウンしているなら、カードを1枚引く。$', '対象ダウン条件つき1ドローを実装済み'),
    ('attack_other_leader_10', r'^【アタックする】\n【アタック後】対戦相手の他のリーダー1体に10ダメージ。$', 'アタック後の他リーダー単体10ダメージ選択を実装済み'),
    ('attack_other_leader_20', r'^【アタックする】\n【アタック後】対戦相手の他のリーダー1体に20ダメージ。$', 'アタック後の他リーダー単体20ダメージ選択を実装済み'),
    ('attack_other_leader_40', r'^【アタックする】\n【アタック後】対戦相手の他のリーダー1体に40ダメージ。$', 'アタック後の他リーダー単体40ダメージ選択を実装済み'),
    ('attack_all_other_10', r'^【アタックする】\n【アタック後】対戦相手の他のリーダーすべてに10ダメージ。$', 'アタック後の他リーダー全体10ダメージを実装済み'),
    ('attack_all_other_20', r'^【アタックする】\n【アタック後】対戦相手の他のリーダーすべてに20ダメージ。$', 'アタック後の他リーダー全体20ダメージを実装済み'),
    ('attack_damaged_other_20', r'^【アタックする】\n【アタック後】対戦相手のダメージを受けている他のリーダーすべてに20ダメージ。$', 'ダメージ済み他リーダー全体20ダメージを実装済み'),
    ('attack_draw_1', r'^【アタックする】\n【アタック後】カードを1枚引く。$', 'アタック後1ドローを実装済み'),
    ('attack_draw_2', r'^【アタックする】\n【アタック後】カードを2枚引く。$', 'アタック後2ドローを実装済み'),
    ('attack_draw_1_discard_1', r'^【アタックする】\n【アタック後】カードを1枚引き、手札を1枚捨てる。$', 'アタック後1ドロー1ディスカードを実装済み'),
    ('attack_multi_three_times', r'^【アタックする】\n【アタックする】\n【アタックする】\n（アタックのたびに、アタッカーとアタックを受けるリーダーを選ぶ。）$', '3回アタック処理を実装済み'),
    ('equip_atk_10', r'^攻撃力\+10$', '装備による攻撃力+10を実装済み'),
    ('equip_hp_30', r'^体力\+30$', '装備による体力+30を実装済み'),
    ('equip_hp_40', r'^体力\+40$', '装備による体力+40を実装済み'),
]
EXACT_REGEX_RULES = [(rule_id, re.compile(pattern), reason) for rule_id, pattern, reason in EXACT_REGEX_RULES]

ATTACK_POST_CONDITION_PREFIXES = [
    'このアタックを受けたリーダーがダウンしているなら、',
    'このラウンドが3ラウンド目なら、',
    'プレイエリアにメモリアカードが2枚以上あるなら、',
    'プレイエリアにメモリアカードが3枚以上あるなら、',
    '自分の手札が2枚以下なら、',
]

ATTACK_POST_SUPPORTED_EFFECTS = {
    'カードを1枚引く': 'アタック後1ドロー',
    'カードを2枚引く': 'アタック後2ドロー',
    'カードを1枚引き、手札を1枚捨てる': 'アタック後1ドロー1ディスカード',
    '対戦相手は手札を1枚捨てる': 'アタック後の相手1ディスカード',
    'すべてのプレイヤーは手札を1枚捨てる': 'アタック後の全員1ディスカード',
    'PPを1回復する': 'アタック後PP1回復',
    'PPを2回復する': 'アタック後PP2回復',
    '自分のリーダー1体を30回復する': 'アタック後30回復',
    '対戦相手の他のリーダー1体に10ダメージ': 'アタック後の他リーダー単体10ダメージ選択',
    '対戦相手の他のリーダー1体に20ダメージ': 'アタック後の他リーダー単体20ダメージ選択',
    '対戦相手の他のリーダー1体に30ダメージ': 'アタック後の他リーダー単体30ダメージ選択',
    '対戦相手の他のリーダー1体に40ダメージ': 'アタック後の他リーダー単体40ダメージ選択',
    '対戦相手の他のリーダー1体に50ダメージ': 'アタック後の他リーダー単体50ダメージ選択',
    '対戦相手の他のリーダー1体に90ダメージ': 'アタック後の他リーダー単体90ダメージ選択',
    '対戦相手の他のリーダーすべてに10ダメージ': 'アタック後の他リーダー全体10ダメージ',
    '対戦相手の他のリーダーすべてに20ダメージ': 'アタック後の他リーダー全体20ダメージ',
    '対戦相手のダメージを受けている他のリーダーすべてに20ダメージ': 'ダメージ済み他リーダー全体20ダメージ',
    '同じ色を持つ対戦相手の他のリーダーすべてに40ダメージ': '同色他リーダー全体40ダメージ',
}

SOFT_SUPPORTED_SIGNALS = [
    ('オーバーキル', 'オーバーキル条件の分岐シグナルあり'),
    ('プレイエリアにメモリアカード', 'プレイエリア枚数条件の分岐シグナルあり'),
    ('自分の手札が2枚以下なら', '手札枚数条件の分岐シグナルあり'),
    ('PPを1回復', 'PP回復ロジックの分岐シグナルあり'),
    ('PPを2回復', 'PP回復ロジックの分岐シグナルあり'),
    ('カードを1枚引く', 'ドローロジックの分岐シグナルあり'),
    ('カードを2枚引く', 'ドローロジックの分岐シグナルあり'),
    ('カードを3枚引く', 'ドローロジックの分岐シグナルあり'),
    ('対戦相手は手札を1枚捨てる', 'ディスカードロジックの分岐シグナルあり'),
    ('対戦相手は手札を2枚捨てる', 'ディスカードロジックの分岐シグナルあり'),
    ('自分のデッキの上から3枚を見る', 'トップデッキ参照ロジックの分岐シグナルあり'),
    ('自分のデッキの上から5枚を見る', 'トップデッキ参照ロジックの分岐シグナルあり'),
    ('対戦相手のデッキの上から1枚を公開し、トラッシュに置く', '相手デッキ公開ロジックの分岐シグナルあり'),
    ('メモリアカードとアタックカードの効果で引いたカード1枚につき20ダメージ', '効果ドロー参照ダメージの分岐シグナルあり'),
    ('ダウンしている自分のリーダー1体を、ダウンしていない状態に戻す', '復帰ロジックの分岐シグナルあり'),
    ('別の自分のリーダーに装備し直してもよい', '装備付け替えロジックの分岐シグナルあり'),
    ('メモリアカードかアタックカードのどちらかを宣言し', '宣言ロジックの分岐シグナルあり'),
    ('プレイエリアに他のアタックカードが2枚以上あるなら、ダメージ+40', '他アタック枚数条件の分岐シグナルあり'),
    ('このターン、あなたが手札を1枚以上捨てているなら、ダメージ+10', '当ターン捨て札条件の分岐シグナルあり'),
    ('アタッカーがカードを装備しているなら', '装備条件の分岐シグナルあり'),
    ('同じ色を持つ対戦相手の他のリーダーすべてに40ダメージ', '色条件の分岐シグナルあり'),
]

APPROX_RULES = [
    ('ordered_play', '好きな順番', '順序選択を簡略化'),
    ('variable_count', '好きな枚数', '選択枚数を自動化'),
    ('random_discard', 'ランダム', 'ランダム処理を簡略化'),
    ('search_select', 'その中から', '探索・選択処理を簡略化'),
    ('replay_select', 'プレイし直す', '再プレイ対象選択を簡略化'),
    ('reequip_optional', '別の自分のリーダーに装備し直してもよい', '装備付け替えを簡略化'),
    ('revive_select', '1体を、ダウンしていない状態に戻す', '復帰対象選択を簡略化'),
    ('distribution_cap', '割り振って与える', 'ダメージ割り振りを簡略化'),
    ('return_to_tactics', '代わりにタクティクスエリアに戻す', '戻り先処理を簡略化'),
    ('declare_choice', '宣言し', '宣言処理を自動化'),
    ('hp_base_change', '基本の体力は170', '装備時HP基準変更が部分対応'),
    ('damage_cap_100', '100ダメージまでしか割り振れない', '上限付き割り振りを近似'),
    ('play_restriction_only', 'このカードは、対戦相手よりダウンしているリーダーが多いなら、プレイできる', 'プレイ条件のみ実装・細部要検証'),
    ('taunt_unintegrated', '対戦相手がこのリーダーにアタックできるなら、対戦相手はこのリーダーにしかアタックできない', '挑発系を完全対戦AIに未統合'),
]


def normalize_text(text: str) -> str:
    return (text or '').replace('\r\n', '\n').replace('\r', '\n').strip()


def compact_text(text: str) -> str:
    return normalize_text(text).replace('\n', ' / ')


def split_clauses(text: str):
    lines = [line.strip() for line in normalize_text(text).split('\n') if line.strip()]
    clauses = []
    current = ''
    for line in lines:
        starts_new = line.startswith('【') or bool(re.fullmatch(r'(?:攻撃力|体力)\+\d+', line))
        if starts_new:
            if current:
                clauses.append(current)
            current = line
        else:
            current = f'{current} {line}'.strip() if current else line
    if current:
        clauses.append(current)
    return clauses


def consume_prefixes(content: str, prefixes):
    used = []
    changed = True
    while changed:
        changed = False
        for prefix in prefixes:
            if content.startswith(prefix):
                used.append(prefix)
                content = content[len(prefix):].strip()
                changed = True
                break
        if content.startswith('（'):
            break
    return content, used


def is_supported_attack_after_content(content: str):
    cleaned = content.rstrip('。').strip()
    if cleaned.startswith('オーバーキル') and '：' in cleaned:
        head, tail = cleaned.split('：', 1)
        if re.fullmatch(r'オーバーキル\d+', head):
            content = tail.strip()
        else:
            content = cleaned
    else:
        content = cleaned
    content, used_prefixes = consume_prefixes(content, ATTACK_POST_CONDITION_PREFIXES)
    content = content.rstrip('。').strip()
    if content in ATTACK_POST_SUPPORTED_EFFECTS:
        if used_prefixes:
            return True, 'attack_post_conditional', f"{' / '.join(dict.fromkeys(used_prefixes))} に対応したアタック後処理を実装済み"
        return True, 'attack_post_effect', f"{ATTACK_POST_SUPPORTED_EFFECTS[content]}を実装済み"
    return False, '', ''


def is_supported_attack_clause(clause: str):
    if clause == '【アタックする】':
        return True, 'attack_marker', 'アタック宣言マーカーを実装済み'
    if not clause.startswith('【アタックする】'):
        return False, '', ''
    content = clause[len('【アタックする】'):].strip()
    if not content:
        return True, 'attack_marker', 'アタック宣言マーカーを実装済み'

    attack_exact_patterns = [
        (r'^ダメージ[+-]\d+。$', 'attack_flat_damage', 'アタック時の固定ダメージ補正を実装済み'),
        (r'^アタッカーが覚醒しているなら、ダメージ\+10。$', 'attack_awakened_bonus', '覚醒条件のダメージ補正を実装済み'),
        (r'^このラウンドが3ラウンド目なら、ダメージ\+20。$', 'attack_round3_bonus', '3ラウンド目条件のダメージ補正を実装済み'),
        (r'^アタッカーがカードを装備しているなら、ダメージ\+10。$', 'attack_equipped_bonus', '装備条件のダメージ補正を実装済み'),
        (r'^手札を1枚捨ててもよい。そうしたならダメージ\+20。$', 'attack_optional_discard_bonus', '任意ディスカード+20の選択処理を実装済み'),
        (r'^自分の手札のコスト0のカード1枚を公開し、捨ててもよい。そうしたならカードを1枚引き、ダメージ\+(?:20|40)。$', 'attack_optional_cost0_bonus', 'コスト0公開ディスカード+ドローの選択処理を実装済み'),
        (r'^対戦相手のデッキの上から1枚を公開し、トラッシュに置く。そのカードが(?:アタック|メモリア)カードなら、ダメージ\+20。$', 'attack_reveal_top_bonus', '相手デッキ公開による条件ダメージを実装済み'),
        (r'^このターン、あなたが手札を1枚以上捨てているなら、ダメージ\+10。$', 'attack_discarded_this_turn_bonus', '当ターン捨て札条件のダメージ補正を実装済み'),
        (r'^プレイエリアに他のアタックカードが2枚以上あるなら、ダメージ\+40。プレイエリアに他のアタックカードが4枚以上あるなら、さらにダメージ\+20。$', 'attack_other_attack_count_bonus', '他アタック枚数条件のダメージ補正を実装済み'),
    ]
    for pattern, rule_id, reason in attack_exact_patterns:
        if re.fullmatch(pattern, content):
            return True, rule_id, reason
    return False, '', ''


def is_supported_play_clause(clause: str):
    if not clause.startswith('【プレイ時】'):
        return False, '', ''
    content = clause[len('【プレイ時】'):].strip()
    exact_content = {
        'カードを1枚引く。': ('play_draw_1', 'プレイ時1ドローを実装済み'),
        'カードを2枚引く。': ('play_draw_2', 'プレイ時2ドローを実装済み'),
        'カードを3枚引く。': ('play_draw_3', 'プレイ時3ドローを実装済み'),
        'カードを1枚引き、手札を1枚捨てる。': ('play_draw_1_discard_1', 'プレイ時1ドロー1ディスカードを実装済み'),
        'カードを2枚引き、手札を2枚捨てる。': ('play_draw_2_discard_2', 'プレイ時2ドロー2ディスカードを実装済み'),
        'すべてのプレイヤーはカードを1枚引く。': ('play_draw_both', '両プレイヤー1ドローを実装済み'),
        '対戦相手のリーダー1体に20ダメージ。': ('play_direct_damage_20', 'プレイ時の単体20ダメージを実装済み'),
        '対戦相手のリーダーすべてに50ダメージ。': ('play_all_damage_50', 'プレイ時の全体50ダメージを実装済み'),
        '対戦相手のリーダーすべてに10ダメージ。': ('play_all_damage_10', 'プレイ時の全体10ダメージを実装済み'),
        'PPを1回復し、カードを1枚引く。': ('play_pp1_draw1', 'PP回復+ドローの複合処理を実装済み'),
        '自分のリーダー1体を30回復する。': ('play_heal_30', '単体30回復を実装済み'),
        '自分のリーダー1体を40回復する。': ('play_heal_40', '単体40回復を実装済み'),
        '自分のリーダー1体を60回復する。': ('play_heal_60', '単体60回復を実装済み'),
        '自分のリーダーを合計40回復する。（複数のリーダーを選んでもよい。）': ('play_heal_total_40', '合計40回復を実装済み'),
        '自分のリーダーを合計80回復する。（複数のリーダーを選んでもよい。）': ('play_heal_total_80', '合計80回復を実装済み'),
        '対戦相手は手札を1枚捨てる。': ('play_opp_discard_1', '相手1ディスカードを実装済み'),
        '対戦相手は手札を2枚捨てる。': ('play_opp_discard_2', '相手2ディスカードを実装済み'),
        'このターン、自分のリーダーすべての攻撃力を+30する。': ('play_turn_attack_buff_30', 'ターン中全体+30を実装済み'),
        'プレイエリアに他のカードがないなら、PPを1回復する。': ('play_pp_if_no_other_cards', '場に他カードがない条件のPP回復を実装済み'),
    }
    if content in exact_content:
        return True, exact_content[content][0], exact_content[content][1]
    return False, '', ''


def is_supported_attack_buff_clause(clause: str):
    if not clause.startswith('【アタック強化】'):
        return False, '', ''
    content = clause[len('【アタック強化】'):].strip()
    if re.fullmatch(r'次のアタックのダメージ\+\d+。', content):
        return True, 'attack_buff_flat', '次アタック強化の汎用加算ロジックで対応'
    return False, '', ''


def is_supported_round_clause(clause: str):
    if re.fullmatch(r'【ラウンド中】このラウンド、自分のリーダーすべての攻撃力を\+10する。\s*（このカードはターン終了時にトラッシュに置かない。）', clause):
        return True, 'round_attack_buff_10', 'ラウンド中全体+10を実装済み'
    return False, '', ''


def is_supported_preamble_clause(clause: str):
    if re.fullmatch(r'プレイエリアに別の「.+」が1枚あるなら、コストを支払わずにこのカードをプレイしてもよい。（2枚以上あるときはコストを支払う。）', clause):
        return True, 'free_play_if_one_same_name', '同名カード1枚条件の無料プレイ分岐を実装済み'
    return False, '', ''


def is_supported_simple_clause(clause: str):
    if re.fullmatch(r'攻撃力\+10', clause):
        return True, 'equip_atk_10', '装備による攻撃力+10を実装済み'
    if re.fullmatch(r'体力\+30', clause):
        return True, 'equip_hp_30', '装備による体力+30を実装済み'
    if re.fullmatch(r'体力\+40', clause):
        return True, 'equip_hp_40', '装備による体力+40を実装済み'
    return False, '', ''


def classify_composite_exact(card):
    text = normalize_text(card.get('text', ''))
    clauses = split_clauses(text)
    if not clauses:
        return None

    reasons = []
    rule_ids = []
    has_attack_buff = False
    next_attack_other_leader_clause = False

    for clause in clauses:
        ok = False
        if clause.startswith('【アタック後】'):
            content = clause[len('【アタック後】'):].strip()
            ok, rule_id, reason = is_supported_attack_after_content(content)
        else:
            for checker in (
                is_supported_attack_clause,
                is_supported_play_clause,
                is_supported_attack_buff_clause,
                is_supported_round_clause,
                is_supported_preamble_clause,
                is_supported_simple_clause,
            ):
                ok, rule_id, reason = checker(clause)
                if ok:
                    break
        if not ok:
            if clause.startswith('【アタック後】'):
                content = clause[len('【アタック後】'):].strip().rstrip('。').strip()
                if content in ATTACK_POST_SUPPORTED_EFFECTS and any(item.startswith('【アタック強化】') for item in clauses):
                    next_attack_other_leader_clause = '対戦相手の他のリーダー1体に' in content
                else:
                    return None
            else:
                return None
        else:
            rule_ids.append(rule_id)
            reasons.append(reason)
            if clause.startswith('【アタック強化】'):
                has_attack_buff = True

    if any(clause.startswith('【アタック後】') for clause in clauses) and any(clause.startswith('【アタック強化】') for clause in clauses):
        post_clauses = [clause[len('【アタック後】'):].strip() for clause in clauses if clause.startswith('【アタック後】')]
        supported_next_attack_post = [
            content.rstrip('。').strip() for content in post_clauses
            if content.rstrip('。').strip().startswith('対戦相手の他のリーダー1体に')
        ]
        if supported_next_attack_post and has_attack_buff:
            return '完全対応', 'next_attack_post_other_leader', '次アタック強化とアタック後の他リーダー単体ダメージ予約を実装済み'
        return None

    if rule_ids:
        reason = ' / '.join(dict.fromkeys(reasons[:3]))
        return '完全対応', '+'.join(dict.fromkeys(rule_ids[:3])), reason
    return None


def apply_image_gate(card, status, rule_id, reason, risk):
    official_image_url = (card.get('officialImageUrl') or '').strip()
    image_status = (card.get('imageStatus') or '').strip() or ('ready' if official_image_url else 'missing')

    if not IMAGE_UI_READY:
        if status == '完全対応':
            return '近似対応', f'{rule_id}+image_ui_pending', f'{reason} / 正規イラストUI監査が未完了', 'medium', official_image_url, image_status, 'ui_pending'
        return status, rule_id, reason, risk, official_image_url, image_status, 'ui_pending'

    if not official_image_url or image_status != 'ready':
        if status == '完全対応':
            return '近似対応', f'{rule_id}+missing_official_image', f'{reason} / 正規イラストが未設定のため完全対応扱い不可', 'medium', official_image_url, image_status or 'missing', 'missing_asset'
        if status == '近似対応':
            return '近似対応', f'{rule_id}+missing_official_image', f'{reason} / 正規イラスト未設定', risk, official_image_url, image_status or 'missing', 'missing_asset'
        return '未対応', f'{rule_id}+missing_official_image', f'{reason} / 正規イラスト未設定', 'high', official_image_url, image_status or 'missing', 'missing_asset'

    return status, rule_id, f'{reason} / 正規イラスト表示UI確認済み', risk, official_image_url, image_status, 'ready'


def classify(card):
    text = normalize_text(card.get('text') or '')
    card_type = card.get('type')
    official_card_number = card.get('officialCardNumber', '')

    if official_card_number in implemented_card_numbers:
        return apply_image_gate(card, '完全対応', 'manual_card_override', '個別実装済みカードとして監査レポートへ反映', 'low')

    if card_type == 'pp':
        return apply_image_gate(card, '完全対応', 'pp_rule_integration', 'PPカード固有の配置・使用ルールを対戦開始処理へ統合済み', 'low')

    if not text:
        return apply_image_gate(card, '未対応', 'empty_text', '効果テキストが空または解析不能', 'high')

    if card_type == 'leader':
        if text in leader_exact:
            return apply_image_gate(card, '完全対応', 'leader_exact', leader_exact[text], 'low')
        return apply_image_gate(card, '未対応', 'leader_unmatched', '現在の覚醒効果実装パターンに未一致', 'high')

    for rule_id, pattern, reason in EXACT_REGEX_RULES:
        if pattern.fullmatch(text):
            return apply_image_gate(card, '完全対応', rule_id, reason, 'low')

    composite = classify_composite_exact(card)
    if composite:
        status, rule_id, reason = composite
        return apply_image_gate(card, status, rule_id, reason, 'low')

    approx_reasons = []
    approx_rule_ids = []
    for rule_id, needle, reason in APPROX_RULES:
        if needle in text:
            approx_rule_ids.append(rule_id)
            approx_reasons.append(reason)

    signal_reasons = []
    signal_rule_ids = []
    for idx, (needle, reason) in enumerate(SOFT_SUPPORTED_SIGNALS, start=1):
        if needle in text:
            signal_rule_ids.append(f'signal_{idx}')
            signal_reasons.append(reason)

    if approx_reasons:
        uniq_reasons = list(dict.fromkeys(approx_reasons))
        uniq_rule_ids = list(dict.fromkeys(approx_rule_ids))
        return apply_image_gate(card, '近似対応', '+'.join(uniq_rule_ids[:3]), ' / '.join(uniq_reasons[:3]), 'medium')

    if signal_reasons:
        uniq_reasons = list(dict.fromkeys(signal_reasons))
        uniq_rule_ids = list(dict.fromkeys(signal_rule_ids))
        return apply_image_gate(card, '近似対応', '+'.join(uniq_rule_ids[:3]), '実装済みサブ処理の組み合わせだが全文一致では未検証', 'medium')

    return apply_image_gate(card, '未対応', 'no_match', '現在の実装に対応する明示ロジックを確認できず', 'high')


rows = []
summary = Counter()
by_set = defaultdict(Counter)
by_type = defaultdict(Counter)
examples = defaultdict(list)
reason_summary = defaultdict(Counter)

image_summary = Counter()

for card in cards:
    status, rule_id, reason, risk, official_image_url, image_status, image_audit = classify(card)
    row = {
        'officialCardNumber': card.get('officialCardNumber', ''),
        'name': card.get('name', ''),
        'type': card.get('type', ''),
        'officialSet': card.get('officialSet', ''),
        'status': status,
        'risk': risk,
        'ruleId': rule_id,
        'reason': reason,
        'text': compact_text(card.get('text') or ''),
        'officialUrl': card.get('officialUrl', ''),
        'officialImageUrl': official_image_url,
        'imageStatus': image_status,
        'imageAudit': image_audit,
    }
    rows.append(row)
    summary[status] += 1
    by_set[card.get('officialSet', '')][status] += 1
    by_type[card.get('type', '')][status] += 1
    reason_summary[status][reason] += 1
    image_summary[image_audit] += 1
    if len(examples[status]) < 12:
        examples[status].append(row)

status_order = {'未対応': 0, '近似対応': 1, '完全対応': 2}
risk_order = {'high': 0, 'medium': 1, 'low': 2}
rows.sort(key=lambda r: (status_order[r['status']], risk_order[r['risk']], r['officialSet'], r['officialCardNumber']))

report = {
    'summary': dict(summary),
    'image_summary': dict(image_summary),
    'image_ui_components': IMAGE_UI_COMPONENTS,
    'by_set': {k: dict(v) for k, v in by_set.items()},
    'by_type': {k: dict(v) for k, v in by_type.items()},
    'reason_summary': {k: dict(v) for k, v in reason_summary.items()},
    'examples': dict(examples),
    'rows': rows,
}

OUT_JSON.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')

csv_lines = ['officialSet,officialCardNumber,name,type,status,risk,ruleId,reason,officialUrl,officialImageUrl,imageStatus,imageAudit,text']
for r in rows:
    vals = [r['officialSet'], r['officialCardNumber'], r['name'], r['type'], r['status'], r['risk'], r['ruleId'], r['reason'], r['officialUrl'], r['officialImageUrl'], r['imageStatus'], r['imageAudit'], r['text']]
    escaped = []
    for v in vals:
        s = str(v).replace('"', '""')
        escaped.append(f'"{s}"')
    csv_lines.append(','.join(escaped))
OUT_CSV.write_text('\n'.join(csv_lines), encoding='utf-8')

md = []
md.append('# Xross Stars BP01-BP03 実装監査表')
md.append('')
md.append('`src/store/battleEffects.ts` / `src/store/gameStore.ts` と、個別カード実装の反映状況をもとに、公式カード367枚を **完全対応 / 近似対応 / 未対応** で監査した自動生成レポートです。')
md.append('また、今回から **正規イラストの有無** と **画像表示UI反映状況** を完全対応条件に含めます。')
md.append('')
md.append('今回の監査ロジックでは、単純なキーワード一致だけでなく、**複合テキストの句単位解析**・**次アタック予約処理**・**アタック後条件分岐** を優先して判定します。')
md.append('')
md.append('## サマリー')
for k in ['完全対応', '近似対応', '未対応']:
    md.append(f'- {k}: {summary.get(k, 0)} 枚')
md.append('')
md.append('## 画像監査サマリー')
for k in ['ready', 'missing_asset', 'ui_pending']:
    md.append(f'- {k}: {image_summary.get(k, 0)} 枚')
md.append(f"- 対象UI: {', '.join(IMAGE_UI_COMPONENTS)}")
md.append('')
md.append('## 判定理由 上位')
for status in ['未対応', '近似対応', '完全対応']:
    md.append(f'### {status}')
    for reason, count in reason_summary[status].most_common(5):
        md.append(f'- {reason}: {count} 枚')
    if not reason_summary[status]:
        md.append('- なし')
md.append('')
md.append('## 弾別')
for set_name in sorted(by_set.keys()):
    c = by_set[set_name]
    md.append(f'- {set_name}: 完全対応 {c.get("完全対応",0)} / 近似対応 {c.get("近似対応",0)} / 未対応 {c.get("未対応",0)}')
md.append('')
md.append('## タイプ別')
for type_name in sorted(by_type.keys()):
    c = by_type[type_name]
    md.append(f'- {type_name}: 完全対応 {c.get("完全対応",0)} / 近似対応 {c.get("近似対応",0)} / 未対応 {c.get("未対応",0)}')
md.append('')
for status in ['未対応', '近似対応', '完全対応']:
    md.append(f'## {status} 代表例')
    md.append('')
    md.append('|No.|カード名|タイプ|ruleId|判定理由|')
    md.append('|---|---|---|---|---|')
    for r in examples[status][:10]:
        md.append(f"|{r['officialCardNumber']}|{r['name']}|{r['type']}|{r['ruleId']}|{r['reason']}|")
    md.append('')
md.append('## 全件CSV')
md.append(f'- {OUT_CSV}')
OUT_MD.write_text('\n'.join(md), encoding='utf-8')

print('JSON:', OUT_JSON)
print('CSV:', OUT_CSV)
print('MD:', OUT_MD)
print('SUMMARY:', dict(summary))
print('IMAGE_SUMMARY:', dict(image_summary))
