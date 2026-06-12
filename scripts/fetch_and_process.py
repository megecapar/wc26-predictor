"""
WC26 Predictor — Veri çekme ve işleme scripti
Çalıştır: python scripts/fetch_and_process.py
Çıktı:    src/data/matches_real.json
"""

import os, json, subprocess, sys
from pathlib import Path

try:
    import pandas as pd
    import numpy as np
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pandas", "numpy"])
    import pandas as pd
    import numpy as np

ROOT   = Path(__file__).parent.parent
DATA   = ROOT / "data_raw" / "fifa"
OUTPUT = ROOT / "src" / "data" / "matches_real.json"
DATA.mkdir(parents=True, exist_ok=True)

# ── 1. Kaggle'dan indir ──────────────────────────────────────────────────────
def download():
    token = os.environ.get("KAGGLE_API_TOKEN", "KGAT_6a35325ee3d8006cb2ddd7e59717fd1b")

    # kaggle.json yaz
    kaggle_dir = Path.home() / ".kaggle"
    kaggle_dir.mkdir(exist_ok=True)
    kaggle_json = kaggle_dir / "kaggle.json"
    kaggle_json.write_text(json.dumps({"username": "wc26predictor", "key": token}))
    kaggle_json.chmod(0o600)

    # kaggle CLI kur
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "kaggle"])

    print("⬇  Kaggle'dan results.csv indiriliyor...")
    result = subprocess.run(
        [sys.executable, "-m", "kaggle", "datasets", "download",
         "-d", "martj42/international-football-results-from-1872-to-2017",
         "-p", str(DATA), "--unzip"],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        print("❌  Kaggle indirme hatası:")
        print(result.stderr)
        print("\n── Manuel indirme adımları ──────────────────────────────────")
        print("1. https://www.kaggle.com/datasets/martj42/international-football-results-from-1872-to-2017")
        print("   sayfasına git → Download → ZIP'i aç")
        print(f"2. results.csv dosyasını şuraya koy: {DATA}/results.csv")
        print("3. Scripti tekrar çalıştır: python scripts/fetch_and_process.py")
        sys.exit(1)
    else:
        print("✓  İndirildi")

# ── 2. ELO ──────────────────────────────────────────────────────────────────
K = 30

def expected(ra, rb): return 1 / (1 + 10 ** ((rb - ra) / 400))

def update_elo(ra, rb, score_a):
    ea = expected(ra, rb)
    return ra + K * (score_a - ea), rb + K * ((1 - score_a) - (1 - ea))

def compute_elo(df):
    elo = {}
    for _, r in df.sort_values("date").iterrows():
        h, a = r["home_team"], r["away_team"]
        elo.setdefault(h, 1500); elo.setdefault(a, 1500)
        gh, ga = r["home_score"], r["away_score"]
        score = 1.0 if gh > ga else 0.5 if gh == ga else 0.0
        elo[h], elo[a] = update_elo(elo[h], elo[a], score)
    return elo

# ── 3. Form ─────────────────────────────────────────────────────────────────
def get_form(team, df, n=5):
    mask = (df["home_team"] == team) | (df["away_team"] == team)
    recent = df[mask].sort_values("date").tail(n)
    form = []
    for _, r in recent.iterrows():
        is_home = r["home_team"] == team
        gf = r["home_score"] if is_home else r["away_score"]
        ga = r["away_score"] if is_home else r["home_score"]
        form.append("win" if gf > ga else "draw" if gf == ga else "loss")
    return form

# ── 4. Poisson ──────────────────────────────────────────────────────────────
def poisson_probs(lam_h, lam_a, max_goals=7):
    from math import exp, factorial
    def p(lam, k): return (lam**k * exp(-lam)) / factorial(k)
    ms = {"home": 0, "draw": 0, "away": 0}
    over25 = btts = 0.0
    for gh in range(max_goals + 1):
        for ga in range(max_goals + 1):
            prob = p(lam_h, gh) * p(lam_a, ga)
            if gh > ga:    ms["home"] += prob
            elif gh == ga: ms["draw"] += prob
            else:          ms["away"] += prob
            if gh + ga > 2.5: over25 += prob
            if gh > 0 and ga > 0: btts += prob
    return ms, over25, 1 - over25, btts, 1 - btts

def odd(p, margin=0.05):
    return round(1 / max(p, 0.01) / (1 + margin), 2)

# ── 5. WC 2026 Fikstür ──────────────────────────────────────────────────────
FLAGS = {
    "Argentina":"🇦🇷","Australia":"🇦🇺","Belgium":"🇧🇪","Bolivia":"🇧🇴",
    "Brazil":"🇧🇷","Canada":"🇨🇦","Chile":"🇨🇱","Croatia":"🇭🇷",
    "Denmark":"🇩🇰","Ecuador":"🇪🇨","England":"🏴󠁧󠁢󠁥󠁮󠁧󠁿","France":"🇫🇷",
    "Germany":"🇩🇪","Ghana":"🇬🇭","Iran":"🇮🇷","Japan":"🇯🇵",
    "Mexico":"🇲🇽","Morocco":"🇲🇦","Netherlands":"🇳🇱","Poland":"🇵🇱",
    "Portugal":"🇵🇹","Saudi Arabia":"🇸🇦","Senegal":"🇸🇳","Serbia":"🇷🇸",
    "South Korea":"🇰🇷","Spain":"🇪🇸","Switzerland":"🇨🇭","Tunisia":"🇹🇳",
    "Turkey":"🇹🇷","United States":"🇺🇸","Uruguay":"🇺🇾","Venezuela":"🇻🇪",
    "Wales":"🏴󠁧󠁢󠁷󠁬󠁳󠁿","Panama":"🇵🇦","Costa Rica":"🇨🇷","Honduras":"🇭🇳",
}

FIXTURES = [
    # Grup A
    ("Mexico",        "South Africa",       "2026-06-11", "22:00", "A", 1),
    ("South Korea",   "Czech Republic",     "2026-06-12", "05:00", "A", 1),
    ("Czech Republic","South Africa",       "2026-06-15", "19:00", "A", 2),
    ("Mexico",        "South Korea",        "2026-06-15", "22:00", "A", 2),
    ("South Africa",  "South Korea",        "2026-06-19", "22:00", "A", 3),
    ("Czech Republic","Mexico",             "2026-06-19", "22:00", "A", 3),
    # Grup B
    ("Canada",        "Switzerland",        "2026-06-12", "22:00", "B", 1),
    ("Qatar",         "Bosnia & Herzegovina","2026-06-13", "01:00", "B", 1),
    ("Switzerland",   "Bosnia & Herzegovina","2026-06-16", "22:00", "B", 2),
    ("Canada",        "Qatar",              "2026-06-17", "01:00", "B", 2),
    ("Switzerland",   "Canada",             "2026-06-20", "22:00", "B", 3),
    ("Bosnia & Herzegovina","Qatar",        "2026-06-20", "22:00", "B", 3),
    # Grup C
    ("Brazil",        "Morocco",            "2026-06-13", "22:00", "C", 1),
    ("Scotland",      "Haiti",              "2026-06-14", "01:00", "C", 1),
    ("Morocco",       "Scotland",           "2026-06-17", "19:00", "C", 2),
    ("Brazil",        "Haiti",              "2026-06-17", "22:00", "C", 2),
    ("Scotland",      "Brazil",             "2026-06-21", "22:00", "C", 3),
    ("Morocco",       "Haiti",              "2026-06-21", "22:00", "C", 3),
    # Grup D
    ("USA",           "Paraguay",           "2026-06-14", "22:00", "D", 1),
    ("Australia",     "Turkey",             "2026-06-15", "01:00", "D", 1),
    ("Turkey",        "Paraguay",           "2026-06-18", "19:00", "D", 2),
    ("USA",           "Australia",          "2026-06-18", "22:00", "D", 2),
    ("Turkey",        "USA",                "2026-06-22", "22:00", "D", 3),
    ("Paraguay",      "Australia",          "2026-06-22", "22:00", "D", 3),
    # Grup E
    ("Germany",       "Curaçao",            "2026-06-15", "22:00", "E", 1),
    ("Ivory Coast",   "Ecuador",            "2026-06-16", "01:00", "E", 1),
    ("Germany",       "Ivory Coast",        "2026-06-19", "19:00", "E", 2),
    ("Ecuador",       "Curaçao",            "2026-06-19", "01:00", "E", 2),
    ("Curaçao",       "Ivory Coast",        "2026-06-23", "22:00", "E", 3),
    ("Ecuador",       "Germany",            "2026-06-23", "22:00", "E", 3),
    # Grup F
    ("Netherlands",   "Japan",              "2026-06-16", "19:00", "F", 1),
    ("Sweden",        "Tunisia",            "2026-06-16", "22:00", "F", 1),
    ("Japan",         "Sweden",             "2026-06-20", "01:00", "F", 2),
    ("Netherlands",   "Tunisia",            "2026-06-20", "19:00", "F", 2),
    ("Tunisia",       "Japan",              "2026-06-24", "22:00", "F", 3),
    ("Netherlands",   "Sweden",             "2026-06-24", "22:00", "F", 3),
    # Grup G
    ("Belgium",       "Egypt",              "2026-06-17", "22:00", "G", 1),
    ("Iran",          "New Zealand",        "2026-06-18", "01:00", "G", 1),
    ("Belgium",       "Iran",               "2026-06-21", "01:00", "G", 2),
    ("Egypt",         "New Zealand",        "2026-06-21", "19:00", "G", 2),
    ("Egypt",         "Iran",               "2026-06-25", "22:00", "G", 3),
    ("New Zealand",   "Belgium",            "2026-06-25", "22:00", "G", 3),
    # Grup H
    ("Spain",         "Cape Verde",         "2026-06-18", "22:00", "H", 1),
    ("Saudi Arabia",  "Uruguay",            "2026-06-19", "01:00", "H", 1),
    ("Spain",         "Saudi Arabia",       "2026-06-22", "01:00", "H", 2),
    ("Uruguay",       "Cape Verde",         "2026-06-22", "19:00", "H", 2),
    ("Cape Verde",    "Saudi Arabia",       "2026-06-26", "22:00", "H", 3),
    ("Uruguay",       "Spain",              "2026-06-26", "22:00", "H", 3),
    # Grup I
    ("France",        "Senegal",            "2026-06-19", "22:00", "I", 1),
    ("Iraq",          "Norway",             "2026-06-20", "01:00", "I", 1),
    ("France",        "Iraq",               "2026-06-23", "01:00", "I", 2),
    ("Norway",        "Senegal",            "2026-06-23", "19:00", "I", 2),
    ("Senegal",       "Iraq",               "2026-06-27", "22:00", "I", 3),
    ("Norway",        "France",             "2026-06-27", "22:00", "I", 3),
    # Grup J
    ("Argentina",     "Algeria",            "2026-06-20", "22:00", "J", 1),
    ("Austria",       "Jordan",             "2026-06-21", "01:00", "J", 1),
    ("Argentina",     "Austria",            "2026-06-24", "01:00", "J", 2),
    ("Algeria",       "Jordan",             "2026-06-24", "19:00", "J", 2),
    ("Algeria",       "Austria",            "2026-06-28", "22:00", "J", 3),
    ("Jordan",        "Argentina",          "2026-06-28", "22:00", "J", 3),
    # Grup K
    ("Portugal",      "Uzbekistan",         "2026-06-21", "22:00", "K", 1),
    ("Colombia",      "DR Congo",           "2026-06-22", "01:00", "K", 1),
    ("Portugal",      "Colombia",           "2026-06-25", "01:00", "K", 2),
    ("Uzbekistan",    "DR Congo",           "2026-06-25", "19:00", "K", 2),
    ("Uzbekistan",    "Colombia",           "2026-06-29", "22:00", "K", 3),
    ("DR Congo",      "Portugal",           "2026-06-29", "22:00", "K", 3),
    # Grup L
    ("England",       "Croatia",            "2026-06-22", "22:00", "L", 1),
    ("Ghana",         "Panama",             "2026-06-23", "01:00", "L", 1),
    ("England",       "Ghana",              "2026-06-26", "01:00", "L", 2),
    ("Panama",        "Croatia",            "2026-06-26", "19:00", "L", 2),
    ("Panama",        "England",            "2026-06-30", "22:00", "L", 3),
    ("Croatia",       "Ghana",              "2026-06-30", "22:00", "L", 3),
]
# ── 6. Ana işlem ────────────────────────────────────────────────────────────
def main():
    results_csv = DATA / "results.csv"

    if not results_csv.exists():
        print(f"⚠  {results_csv} bulunamadı, Kaggle'dan indiriliyor...")
        download()

    print("📖  Veri okunuyor...")
    df = pd.read_csv(results_csv, parse_dates=["date"])
    df = df.dropna(subset=["home_score", "away_score"])
    df["home_score"] = df["home_score"].astype(int)
    df["away_score"] = df["away_score"].astype(int)

    print(f"   Toplam maç: {len(df):,} ({df['date'].min().year}–{df['date'].max().year})")

    recent = df[df["date"] >= "2018-01-01"].copy()
    r3     = df[df["date"] >= "2021-01-01"].copy()

    print("⚙️   ELO hesaplanıyor (tüm tarih)...")
    elo_all = compute_elo(df)
    print("⚙️   ELO hesaplanıyor (2018+)...")
    elo_rec = compute_elo(recent)

    # Son 3 yıl ortalama gol
    home_avg = r3["home_score"].mean()
    away_avg = r3["away_score"].mean()

    def team_lam(team, is_home):
        gf = pd.concat([
            r3[r3["home_team"] == team]["home_score"],
            r3[r3["away_team"] == team]["away_score"]
        ])
        return gf.mean() if len(gf) >= 5 else (home_avg if is_home else away_avg)

    print(f"\n🔮  {len(FIXTURES)} maç için tahmin üretiliyor...\n")
    out = []

    for idx, (home, away, date, kickoff, group, hafta) in enumerate(FIXTURES):
        elo_h = elo_rec.get(home, elo_all.get(home, 1500))
        elo_a = elo_rec.get(away, elo_all.get(away, 1500))
        diff  = elo_h - elo_a
        factor = 10 ** (diff / 400)

        lam_h = float(np.clip(team_lam(home, True)  * factor**0.5, 0.4, 4.0))
        lam_a = float(np.clip(team_lam(away, False) / factor**0.5, 0.4, 4.0))
        exp_g = round(lam_h + lam_a, 1)

        ms, ov, un, by, bn = poisson_probs(lam_h, lam_a)
        ht_ms, *_ = poisson_probs(lam_h * 0.44, lam_a * 0.44)

        conf = "high" if abs(diff) > 150 else "mid" if abs(diff) > 60 else "low"

        form_h = get_form(home, df)
        form_a = get_form(away, df)

        out.append({
            "id": f"{home[:3].lower().replace(' ','')}-{away[:3].lower().replace(' ','')}-{idx}",
            "date": date, "kickoff": kickoff,
            "stage": f"Grup {group} · {hafta}. hafta",
            "group": group, "confidence": conf,
            "home": {
                "code": home[:3].upper(), "name": home,
                "flag": FLAGS.get(home, "🏳️"),
                "elo": round(elo_h), "fifaRank": 0, "marketValue": 0,
                "form": form_h, "group": group,
            },
            "away": {
                "code": away[:3].upper(), "name": away,
                "flag": FLAGS.get(away, "🏳️"),
                "elo": round(elo_a), "fifaRank": 0, "marketValue": 0,
                "form": form_a, "group": group,
            },
            "ms": {
                "home": {"label":"MS 1", "value":odd(ms["home"]), "probability":round(ms["home"],3)},
                "draw": {"label":"MS X", "value":odd(ms["draw"]), "probability":round(ms["draw"],3)},
                "away": {"label":"MS 2", "value":odd(ms["away"]), "probability":round(ms["away"],3)},
            },
            "overUnder": {
                "line": 2.5, "expectedGoals": exp_g,
                "over":  {"label":"2.5 Üst","value":odd(ov),"probability":round(ov,3)},
                "under": {"label":"2.5 Alt","value":odd(un),"probability":round(un,3)},
            },
            "btts": {
                "yes": {"label":"KG Var","value":odd(by),"probability":round(by,3)},
                "no":  {"label":"KG Yok","value":odd(bn),"probability":round(bn,3)},
            },
            "htMs": {
                "home": {"label":"İY 1","value":odd(ht_ms["home"]),"probability":round(ht_ms["home"],3)},
                "draw": {"label":"İY X","value":odd(ht_ms["draw"]),"probability":round(ht_ms["draw"],3)},
                "away": {"label":"İY 2","value":odd(ht_ms["away"]),"probability":round(ht_ms["away"],3)},
            },
        })
        bar = "W" if conf=="high" else "~" if conf=="mid" else "?"
        print(f"  [{bar}] {home:20s} vs {away:20s} | "
              f"1:{ms['home']:.0%}  X:{ms['draw']:.0%}  2:{ms['away']:.0%} | "
              f"ELO {round(elo_h)} vs {round(elo_a)} | {exp_g} gol")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(out, ensure_ascii=False, indent=2))
    print(f"\n✅  {len(out)} maç → {OUTPUT}")
    print("   Şimdi: npm run dev")

if __name__ == "__main__":
    main()
