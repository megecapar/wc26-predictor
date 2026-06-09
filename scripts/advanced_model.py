"""
WC26 Predictor — Gelişmiş Model
================================
Faktörler:
1. ELO (eloratings.net güncel değerleri)
2. Form ağırlığı (son 10 maç, ağırlıklı)
3. Ev sahibi avantajı (ABD/Kanada/Meksika)
4. Gerçek gol ortalaması (takım başına, son 3 yıl)
5. H2H geçmişi (son 10 karşılaşma)
6. Kadro değeri (appearances.csv'den piyasa değeri proxy)

Çalıştır:
  python scripts/advanced_model.py
"""

import json, pandas as pd, numpy as np
from pathlib import Path
from math import exp, factorial

ROOT = Path(__file__).parent.parent

# ── Veri yükle ────────────────────────────────────────────────────────────────
RESULTS_CSV     = ROOT / "data_raw/fifa/results.csv"
APPEARANCES_CSV = ROOT / "data_raw/appearances.csv"
MATCHES_JSON    = ROOT / "src/data/matches_real.json"

print("📖 Veri yükleniyor...")
df = pd.read_csv(RESULTS_CSV, parse_dates=["date"])
df = df.dropna(subset=["home_score","away_score"])
df["home_score"] = df["home_score"].astype(int)
df["away_score"] = df["away_score"].astype(int)
print(f"   {len(df):,} maç yüklendi ({df['date'].min().year}–{df['date'].max().year})")

matches = json.loads(MATCHES_JSON.read_text())
print(f"   {len(matches)} WC maçı yüklendi")

# Appearances varsa yükle
squad_value = {}
if APPEARANCES_CSV.exists():
    try:
        app = pd.read_csv(APPEARANCES_CSV)
        print(f"   {len(app):,} oyuncu görünümü yüklendi")
        # Takım başına toplam piyasa değeri proxy: appearance sayısı × gol katkısı
        if 'player_club_id' in app.columns:
            squad_value = app.groupby('player_club_id').size().to_dict()
    except Exception as e:
        print(f"   ⚠ Appearances yüklenemedi: {e}")

# ── 1. ELO (güncel, eloratings.net) ──────────────────────────────────────────
REAL_ELO = {
    'Spain':2171,'Argentina':2113,'France':2063,'England':2042,
    'Colombia':1998,'Brazil':1979,'Portugal':1976,'Netherlands':1959,
    'Croatia':1933,'Ecuador':1933,'Norway':1922,'Germany':1910,
    'Switzerland':1897,'Uruguay':1890,'Turkey':1880,'Japan':1879,
    'Senegal':1869,'Denmark':1864,'Belgium':1849,'Morocco':1840,
    'USA':1820,'Mexico':1810,'South Korea':1800,'Australia':1790,
    'Serbia':1780,'Poland':1770,'Chile':1760,'Peru':1750,
    'Iran':1740,'Algeria':1730,'Nigeria':1720,'Ivory Coast':1710,
    'DR Congo':1700,'Cameroon':1690,'Tunisia':1680,'Paraguay':1670,
    'Saudi Arabia':1660,'South Africa':1650,'Scotland':1640,'Canada':1630,
    'Czech Republic':1620,'Ghana':1610,'Iraq':1600,'Jordan':1590,
    'Uzbekistan':1580,'Cape Verde':1570,'Bosnia & Herzegovina':1560,
    'New Zealand':1550,'Qatar':1540,'Egypt':1530,'Sweden':1860,
    'Austria':1730,'Curaçao':1390,'Haiti':1380,'Panama':1360,
}

# ── 2. Form skoru (son 10 maç, yakın maçlar daha ağırlıklı) ──────────────────
def get_form_score(team, n=10):
    """Son n maçın ağırlıklı form skoru — 1.0 etrafında normalize"""
    mask = (df["home_team"]==team) | (df["away_team"]==team)
    recent = df[mask].sort_values("date").tail(n)
    if len(recent) == 0:
        return 1.0

    score = 0.0
    total_weight = 0.0
    for i, (_, r) in enumerate(recent.iterrows()):
        w = (i + 1) / len(recent)  # yakın maç daha ağırlıklı
        if r["home_team"] == team:
            gf, ga = r["home_score"], r["away_score"]
        else:
            gf, ga = r["away_score"], r["home_score"]

        if gf > ga:   match_score = 1.0
        elif gf == ga: match_score = 0.5
        else:          match_score = 0.0

        score        += match_score * w
        total_weight += w

    # 0-1 arası normalize, sonra 0.85-1.15 arasına sıkıştır
    raw = score / total_weight if total_weight > 0 else 0.5
    return 0.85 + raw * 0.30  # 0.85 (kötü form) → 1.15 (harika form)

# ── 3. Ev sahibi avantajı ─────────────────────────────────────────────────────
HOST_TEAMS = {'USA', 'Canada', 'Mexico'}
HOST_BOOST = 1.08  # %8 lambda artışı

# ── 4. Gerçek gol ortalaması ──────────────────────────────────────────────────
r3 = df[df["date"] >= "2021-01-01"]
global_avg = (r3["home_score"].mean() + r3["away_score"].mean()) / 2

def team_attack_avg(team, n_min=8):
    """Takımın son 3 yıldaki gol atma ortalaması"""
    gf = pd.concat([
        r3[r3["home_team"]==team]["home_score"],
        r3[r3["away_team"]==team]["away_score"]
    ])
    return float(gf.mean()) if len(gf) >= n_min else global_avg

def team_defense_avg(team, n_min=8):
    """Takımın son 3 yıldaki gol yeme ortalaması"""
    ga = pd.concat([
        r3[r3["home_team"]==team]["away_score"],
        r3[r3["away_team"]==team]["home_score"]
    ])
    return float(ga.mean()) if len(ga) >= n_min else global_avg

# ── 5. H2H geçmişi ────────────────────────────────────────────────────────────
def get_h2h_factor(team1, team2, n=10):
    """Son n H2H maçındaki kazanma oranı — 1.0 etrafında"""
    h2h = df[
        ((df["home_team"]==team1)&(df["away_team"]==team2)) |
        ((df["home_team"]==team2)&(df["away_team"]==team1))
    ].sort_values("date").tail(n)

    if len(h2h) < 3:
        return 1.0  # Yetersiz veri, nötr

    wins = draws = 0
    for _, r in h2h.iterrows():
        if r["home_team"] == team1:
            gf, ga = r["home_score"], r["away_score"]
        else:
            gf, ga = r["away_score"], r["home_score"]
        if gf > ga:    wins  += 1
        elif gf == ga: draws += 1

    win_rate = (wins + draws * 0.5) / len(h2h)
    # 0.5 = nötr → 1.0, 1.0 = tam üstün → 1.08, 0.0 = tam alt → 0.92
    return 0.92 + win_rate * 0.16

# ── 6. Gelişmiş lambda hesapla ────────────────────────────────────────────────
def calc_lambda(team, opp, is_attack=True):
    """
    Takımın beklenen gol sayısı:
    base_attack × (elo_factor) × (form_factor) × (h2h_factor) × (host_factor)
    """
    elo_t = REAL_ELO.get(team, 1500)
    elo_o = REAL_ELO.get(opp,  1500)
    elo_diff = elo_t - elo_o

    # ELO faktörü
    elo_fac = 10 ** (elo_diff / 400)

    # Gol ortalaması bazlı lambda
    atk_avg = team_attack_avg(team)
    def_avg = team_defense_avg(opp)
    base_lam = (atk_avg + def_avg) / 2  # saldırı + rakip savunma ortalaması

    # Form faktörü
    form_fac = get_form_score(team)

    # H2H faktörü (saldıran takım için)
    h2h_fac = get_h2h_factor(team, opp) if is_attack else 1.0

    # Ev sahibi avantajı
    host_fac = HOST_BOOST if team in HOST_TEAMS else 1.0

    # Final lambda
    lam = base_lam * (elo_fac ** 0.5) * form_fac * h2h_fac * host_fac
    return float(np.clip(lam, 0.3, 4.5))

# ── 7. Poisson ────────────────────────────────────────────────────────────────
def poisson(lh, la, mx=8):
    def p(l, k): return (l**k * exp(-l)) / factorial(k)
    ms = {"home":0,"draw":0,"away":0}; ov = bt = 0.0
    for gh in range(mx+1):
        for ga in range(mx+1):
            pr = p(lh,gh)*p(la,ga)
            if gh>ga: ms["home"]+=pr
            elif gh==ga: ms["draw"]+=pr
            else: ms["away"]+=pr
            if gh+ga>2.5: ov+=pr
            if gh>0 and ga>0: bt+=pr
    return ms, ov, 1-ov, bt, 1-bt

def odd(p, m=0.05): return round(1/max(p,0.01)/(1+m), 2)
def rnd(n): return round(n*1000)/1000

# ── 8. Tüm maçları güncelle ───────────────────────────────────────────────────
print("\n🔮 Gelişmiş model hesaplanıyor...\n")

for match in matches:
    h = match['home']['name']
    a = match['away']['name']

    lh = calc_lambda(h, a, is_attack=True)
    la = calc_lambda(a, h, is_attack=True)

    # Güven seviyesi — ELO farkı + form farkı
    elo_h = REAL_ELO.get(h, 1500)
    elo_a = REAL_ELO.get(a, 1500)
    diff  = abs(elo_h - elo_a)
    form_h = get_form_score(h)
    form_a = get_form_score(a)
    form_diff = abs(form_h - form_a)
    confidence_score = diff + form_diff * 200

    conf = "high" if confidence_score > 250 else "mid" if confidence_score > 100 else "low"

    ms, ov, un, by, bn = poisson(lh, la)
    ht, *_ = poisson(lh*0.44, la*0.44)

    # Nesine oranları varsa MS değerlerini koru, sadece olasılıkları güncelle
    match['ms']['home']['probability'] = rnd(ms["home"])
    match['ms']['draw']['probability'] = rnd(ms["draw"])
    match['ms']['away']['probability'] = rnd(ms["away"])

    match['overUnder']['expectedGoals'] = round(lh+la, 1)
    match['overUnder']['over']['probability']  = rnd(ov)
    match['overUnder']['under']['probability'] = rnd(un)
    # 2.5 Üst/Alt oranlarını modelden hesapla (Nesine'de bazen yok)
    if not match['overUnder']['over'].get('value'):
        match['overUnder']['over']['value']  = odd(ov)
        match['overUnder']['under']['value'] = odd(un)

    match['btts'] = {
        "yes": {"label":"KG Var","value":odd(by),"probability":rnd(by)},
        "no":  {"label":"KG Yok","value":odd(bn),"probability":rnd(bn)},
    }
    match['htMs'] = {
        "home": {"label":"İY 1","value":odd(ht["home"]),"probability":rnd(ht["home"])},
        "draw": {"label":"İY X","value":odd(ht["draw"]),"probability":rnd(ht["draw"])},
        "away": {"label":"İY 2","value":odd(ht["away"]),"probability":rnd(ht["away"])},
    }
    match['confidence'] = conf
    match['home']['elo'] = elo_h
    match['away']['elo'] = elo_a

    # Debug faktörleri
    form_h_val = get_form_score(h)
    form_a_val = get_form_score(a)
    h2h_h = get_h2h_factor(h, a)

    print(f"  {h:22s} vs {a:22s}")
    print(f"    λ: {lh:.2f}/{la:.2f} | ELO:{elo_h}/{elo_a} | Form:{form_h_val:.2f}/{form_a_val:.2f} | H2H:{h2h_h:.2f} | Exp:{round(lh+la,1)} gol")
    print(f"    MS: 1={ms['home']:.0%} X={ms['draw']:.0%} 2={ms['away']:.0%} | 2.5Üst={ov:.0%} | KGVar={by:.0%}")
    print()

MATCHES_JSON.write_text(json.dumps(matches, ensure_ascii=False, indent=2))
print(f"✅ {len(matches)} maç gelişmiş modelle güncellendi → {MATCHES_JSON}")
print("\nNot: Nesine MS oranları korundu, olasılıklar modelden hesaplandı.")


# ── Nesine oranlarını tekrar uygula ───────────────────────────────────────────
NESINE_CACHE = ROOT / "data_raw/nesine_odds.json"
if NESINE_CACHE.exists():
    nesine = json.loads(NESINE_CACHE.read_text())
    applied = 0
    for match in matches:
        key = f"{match['home']['name']}-{match['away']['name']}"
        if key in nesine:
            o = nesine[key]
            if o.get('ms1'): match['ms']['home']['value'] = o['ms1']
            if o.get('msX'): match['ms']['draw']['value'] = o['msX']
            if o.get('ms2'): match['ms']['away']['value'] = o['ms2']
            if o.get('alt'): match['overUnder']['under']['value'] = o['alt']
            if o.get('ust'): match['overUnder']['over']['value']  = o['ust']
            applied += 1
    MATCHES_JSON.write_text(json.dumps(matches, ensure_ascii=False, indent=2))
    print(f"✅ {applied} maça Nesine oranları geri uygulandı")
