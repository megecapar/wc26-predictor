"""
WC26 Predictor — Canlı Güncelleme Scripti
==========================================
Kullanım:
  python scripts/update_live.py --key YOUR_RAPIDAPI_KEY
  ya da:
  export API_FOOTBALL_KEY=YOUR_KEY
  python scripts/update_live.py

Test modu (API çağrısı yapmaz, sadece ELO günceller):
  python scripts/update_live.py --dry-run
"""

import os, json, time, sys, argparse
from pathlib import Path
from math import exp, factorial
from datetime import datetime, date

try:
    import requests
    import pandas as pd
    import numpy as np
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "requests", "pandas", "numpy"])
    import requests
    import pandas as pd
    import numpy as np

# ── Argümanlar ────────────────────────────────────────────────────────────────
parser = argparse.ArgumentParser(description="WC26 canlı güncelleme")
parser.add_argument("--key",    default="",   help="RapidAPI key")
parser.add_argument("--league", default="1",  help="League ID (default: 1 = FIFA World Cup)")
parser.add_argument("--season", default="2026", help="Sezon yılı (default: 2026)")
parser.add_argument("--dry-run", action="store_true", help="API çağrısı yapma")
parser.add_argument("--test",    action="store_true", help="Bağlantı testi yapıp çık")
args = parser.parse_args()

API_KEY = args.key or os.environ.get("API_FOOTBALL_KEY", "92ef36574bmsh104fc7ba464c9ebp10afc9jsndfb2dd1f31d4")
BASE_URL = "https://v3.football.api-sports.io"

ROOT         = Path(__file__).parent.parent
RESULTS_CSV  = ROOT / "data_raw" / "fifa" / "results.csv"
MATCHES_JSON = ROOT / "src" / "data" / "matches_real.json"
CACHE_FILE   = ROOT / "data_raw" / "live_cache.json"
ROOT.joinpath("data_raw").mkdir(parents=True, exist_ok=True)

# ── API Helper ────────────────────────────────────────────────────────────────
def api_get(endpoint: str, params: dict = {}) -> dict:
    headers = {
        "x-rapidapi-host": "v3.football.api-sports.io",
        "x-rapidapi-key":  API_KEY,
    }
    url  = f"{BASE_URL}/{endpoint}"
    resp = requests.get(url, headers=headers, params=params, timeout=15)
    resp.raise_for_status()
    data = resp.json()
    remaining = resp.headers.get("x-ratelimit-requests-remaining", "?")
    used      = resp.headers.get("x-ratelimit-requests-limit", "?")
    results   = data.get("response", [])
    errors    = data.get("errors", {})
    print(f"   [API] GET /{endpoint} → {len(results)} sonuç | kalan: {remaining}/{used} istek/gün")
    if errors:
        print(f"   [API] ⚠  Hata: {errors}")
    time.sleep(0.3)
    return data

def test_connection():
    print("=" * 55)
    print("API-Football Bağlantı Testi")
    print("=" * 55)
    print(f"Key: {API_KEY[:12]}...{API_KEY[-4:]}\n")
    try:
        data = api_get("status")
        # /status response bir dict döner (list değil)
        raw  = data.get("response", {})
        info = raw if isinstance(raw, dict) else (raw[0] if raw else {})
        acct = info.get("account", {})
        sub  = info.get("subscription", {})
        req  = info.get("requests", {})
        print(f"✅  Bağlantı başarılı!")
        print(f"   Kullanıcı : {acct.get('firstname','')} {acct.get('lastname','')}")
        print(f"   Email     : {acct.get('email','')}")
        print(f"   Plan      : {sub.get('plan','')}")
        print(f"   Bitiş     : {sub.get('end','')}")
        print(f"   Bugün     : {req.get('current',0)} / {req.get('limit_day',0)} istek")
        return True
    except requests.HTTPError as e:
        print(f"❌  HTTP Hatası: {e.response.status_code} — {e.response.text[:200]}")
        if e.response.status_code == 403:
            print("\n   → API-Football'a henüz subscribe olmadın.")
            print("   → Şu linke git ve 'Subscribe to Test' butonuna bas:")
            print("   → https://rapidapi.com/api-sports/api/api-football")
        return False
    except Exception as e:
        print(f"❌  Bağlantı hatası: {e}")
        return False

# ── ELO ──────────────────────────────────────────────────────────────────────
TOURNAMENT_WEIGHTS = {
    "FIFA World Cup": 2.0, "UEFA Euro": 1.8, "Copa América": 1.8,
    "Africa Cup of Nations": 1.6, "AFC Asian Cup": 1.6,
    "UEFA Nations League": 1.4, "CONCACAF Gold Cup": 1.4,
    "Confederations Cup": 1.4, "FIFA World Cup qualification": 1.3,
    "UEFA Euro qualification": 1.2, "Friendly": 0.7,
}
def get_weight(t):
    for k, w in TOURNAMENT_WEIGHTS.items():
        if k.lower() in str(t).lower(): return w
    return 1.0

K_BASE = 30
def expected_score(ra, rb): return 1 / (1 + 10 ** ((rb - ra) / 400))

def build_elo_from_csv():
    if not RESULTS_CSV.exists():
        print("   ⚠  results.csv yok — ELO 1500 baseline")
        return {}
    df = pd.read_csv(RESULTS_CSV, parse_dates=["date"])
    df = df.dropna(subset=["home_score","away_score"])
    df["home_score"] = df["home_score"].astype(int)
    df["away_score"]  = df["away_score"].astype(int)
    elo = {}
    for _, r in df.sort_values("date").iterrows():
        h, a = r["home_team"], r["away_team"]
        elo.setdefault(h, 1500); elo.setdefault(a, 1500)
        gh, ga = r["home_score"], r["away_score"]
        score = 1.0 if gh > ga else 0.5 if gh == ga else 0.0
        K  = K_BASE * get_weight(r.get("tournament",""))
        ea = expected_score(elo[h], elo[a])
        elo[h] += K * (score - ea)
        elo[a] += K * ((1 - score) - (1 - ea))
    print(f"   {len(elo)} takım ELO hesaplandı ({df['date'].min().year}–{df['date'].max().year})")
    return elo

def update_elo_with_result(elo, home, away, gh, ga):
    elo.setdefault(home, 1500); elo.setdefault(away, 1500)
    score = 1.0 if gh > ga else 0.5 if gh == ga else 0.0
    K  = K_BASE * 2.0  # WC maçı ağırlığı
    ea = expected_score(elo[home], elo[away])
    elo[home] += K * (score - ea)
    elo[away] += K * ((1 - score) - (1 - ea))
    return elo

# ── Poisson ───────────────────────────────────────────────────────────────────
def poisson_probs(lh, la, max_g=7):
    def p(lam, k): return (lam**k * exp(-lam)) / factorial(k)
    ms = {"home":0,"draw":0,"away":0}; ov = bt = 0.0
    for gh in range(max_g+1):
        for ga in range(max_g+1):
            prob = p(lh,gh)*p(la,ga)
            if gh>ga:    ms["home"]+=prob
            elif gh==ga: ms["draw"]+=prob
            else:        ms["away"]+=prob
            if gh+ga>2.5: ov+=prob
            if gh>0 and ga>0: bt+=prob
    return ms, ov, 1-ov, bt, 1-bt

def odd(p, m=0.05): return round(1/max(p,0.01)/(1+m), 2)

# ── Gol lambdaları ────────────────────────────────────────────────────────────
def build_lam_table():
    if not RESULTS_CSV.exists():
        return {"global": 1.3}
    df = pd.read_csv(RESULTS_CSV, parse_dates=["date"])
    r3 = df[df["date"] >= "2021-01-01"]
    lam = {"global": float((r3["home_score"].mean() + r3["away_score"].mean()) / 2)}
    for team in df["home_team"].unique():
        gf = pd.concat([
            r3[r3["home_team"]==team]["home_score"],
            r3[r3["away_team"]==team]["away_score"]
        ])
        if len(gf) >= 5:
            lam[team] = float(gf.mean())
    return lam

# ── Tahmin güncelle ───────────────────────────────────────────────────────────
def recalculate(match, elo, lam):
    home = match["home"]["name"]
    away = match["away"]["name"]
    eh   = elo.get(home, 1500)
    ea   = elo.get(away, 1500)
    diff = eh - ea
    fac  = 10 ** (diff / 400)
    base = lam.get("global", 1.3)
    lh   = float(np.clip(lam.get(home, base) * fac**0.5, 0.4, 4.0))
    la   = float(np.clip(lam.get(away, base) / fac**0.5, 0.4, 4.0))
    exp_g = round(lh + la, 1)
    ms, ov, un, by, bn = poisson_probs(lh, la)
    ht_ms, *_ = poisson_probs(lh*0.44, la*0.44)
    conf = "high" if abs(diff)>150 else "mid" if abs(diff)>60 else "low"
    match.update({
        "confidence": conf,
        "ms": {
            "home": {"label":"MS 1","value":odd(ms["home"]),"probability":round(ms["home"],3)},
            "draw": {"label":"MS X","value":odd(ms["draw"]),"probability":round(ms["draw"],3)},
            "away": {"label":"MS 2","value":odd(ms["away"]),"probability":round(ms["away"],3)},
        },
        "overUnder": {
            **match["overUnder"],
            "expectedGoals": exp_g,
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
    match["home"]["elo"] = round(eh)
    match["away"]["elo"] = round(ea)
    return match

# ── API'den biten maçları çek ─────────────────────────────────────────────────
def fetch_finished(league_id=1, season=2026):
    """WC 2026 — tüm biten maçlar"""
    print("⬇  Biten WC maçları çekiliyor...")
    data = api_get("fixtures", {"league": league_id, "season": season, "status": "FT"})
    fixtures = []
    for f in data.get("response", []):
        fixtures.append({
            "api_id":     f["fixture"]["id"],
            "date":       f["fixture"]["date"][:10],
            "home":       f["teams"]["home"]["name"],
            "away":       f["teams"]["away"]["name"],
            "home_score": f["goals"]["home"],
            "away_score": f["goals"]["away"],
            "status":     f["fixture"]["status"]["short"],
            "round":      f["league"]["round"],
        })
    return fixtures

# ── Ana akış ──────────────────────────────────────────────────────────────────
def main():
    print("=" * 55)
    print("WC26 Predictor — Güncelleme")
    print(f"Zaman : {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print(f"Key   : {API_KEY[:12]}...{API_KEY[-4:]}")
    print(f"Mod   : {'DRY-RUN' if args.dry_run else 'CANLI'}")
    print("=" * 55)

    # matches_real.json yükle
    if not MATCHES_JSON.exists():
        print(f"❌  {MATCHES_JSON} bulunamadı!")
        print("   Önce: python scripts/fetch_and_process.py")
        sys.exit(1)

    matches = json.loads(MATCHES_JSON.read_text())
    print(f"\n✓  {len(matches)} maç yüklendi")

    # ELO baseline
    print("\n⚙️  ELO hesaplanıyor...")
    elo = build_elo_from_csv()
    lam = build_lam_table()

    # Cache
    cache = {"finished": []}
    if CACHE_FILE.exists():
        cache = json.loads(CACHE_FILE.read_text())
    cached_ids = {m["api_id"] for m in cache["finished"]}
    print(f"✓  Cache: {len(cache['finished'])} biten maç")

    # API'den çek
    new_results = []
    if not args.dry_run:
        try:
            finished = fetch_finished(league_id=int(args.league), season=int(args.season))
            for f in finished:
                if f["api_id"] not in cached_ids and f["home_score"] is not None:
                    new_results.append(f)
                    cache["finished"].append(f)
            print(f"✓  {len(new_results)} yeni sonuç")
            for r in new_results:
                print(f"   {r['home']:20s} {r['home_score']}-{r['away_score']} {r['away']}")
        except Exception as e:
            print(f"⚠  API hatası: {e}")
    else:
        print("   [DRY-RUN] API atlandı")

    # ELO güncelle (biten tüm WC maçlarıyla)
    print("\n⚙️  ELO WC maç sonuçlarıyla güncelleniyor...")
    for r in cache["finished"]:
        if r["home_score"] is not None:
            elo = update_elo_with_result(
                elo, r["home"], r["away"],
                int(r["home_score"]), int(r["away_score"])
            )

    # Tahminleri yeniden hesapla
    print("\n🔮  Tahminler yenileniyor...")
    finished_pairs = {(r["home"], r["away"]) for r in cache["finished"]}
    updated = finished_count = 0

    for match in matches:
        home = match["home"]["name"]
        away = match["away"]["name"]
        if (home, away) in finished_pairs:
            # Biten maç — sonucu ekle
            r = next((x for x in cache["finished"] if x["home"]==home and x["away"]==away), None)
            if r:
                match["result"] = {
                    "home_score": r["home_score"],
                    "away_score": r["away_score"],
                    "status": "FT"
                }
            finished_count += 1
        else:
            # Bitmemiş — tahminleri güncelle
            match = recalculate(match, elo, lam)
            updated += 1

    print(f"   {updated} maç tahmini güncellendi")
    print(f"   {finished_count} biten maç işaretlendi")

    # Kaydet
    CACHE_FILE.write_text(json.dumps(cache, ensure_ascii=False, indent=2))
    MATCHES_JSON.write_text(json.dumps(matches, ensure_ascii=False, indent=2))
    print(f"\n✅  {MATCHES_JSON.name} güncellendi → {datetime.now().strftime('%H:%M:%S')}")

if __name__ == "__main__":
    if args.test:
        sys.exit(0 if test_connection() else 1)
    main()
