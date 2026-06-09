/**
 * Nosy API — İddaa oranları çekici
 * WC 2026 maçlarını otomatik filtreler
 */

export interface NosyOdds {
  ms1: number
  msX: number
  ms2: number
  over25: number
  under25: number
}

// Nosy takım adı → bizim takım adı eşleştirmesi
const TEAM_NAME_MAP: Record<string, string> = {
  'ABD':            'USA',
  'Amerika':        'USA',
  'United States':  'USA',
  'Brezilya':       'Brazil',
  'Fransa':         'France',
  'Almanya':        'Germany',
  'Hollanda':       'Netherlands',
  'Portekiz':       'Portugal',
  'İspanya':        'Spain',
  'Japonya':        'Japan',
  'Arjantin':       'Argentina',
  'İngiltere':      'England',
  'Türkiye':        'Turkey',
  'Fas':            'Morocco',
  'Senegal':        'Senegal',
  'Hırvatistan':    'Croatia',
  'İsviçre':        'Switzerland',
  'Danimarka':      'Denmark',
  'Polonya':        'Poland',
  'Uruguay':        'Uruguay',
  'Meksika':        'Mexico',
  'Güney Kore':     'South Korea',
  'G. Kore':        'South Korea',
  'Sırbistan':      'Serbia',
  'Avustralya':     'Australia',
  'Kamerun':        'Cameroon',
  'G. Afrika':      'South Africa',
  'Güney Afrika':   'South Africa',
  'Kolombiya':      'Colombia',
  'Ekvador':        'Ecuador',
  'Cezayir':        'Algeria',
  'Nijerya':        'Nigeria',
  'Gana':           'Ghana',
  'İskoçya':        'Scotland',
  'Norveç':         'Norway',
  'Belçika':        'Belgium',
  'Şili':           'Chile',
  'Peru':           'Peru',
  'İran':           'Iran',
  'Kanada':         'Canada',
  'Katar':          'Qatar',
  'Irak':           'Iraq',
  'Ürdün':          'Jordan',
  'Özbekistan':     'Uzbekistan',
  'Haiti':          'Haiti',
  'Bosna Hersek':   'Bosnia & Herzegovina',
  'Bosna-Hersek':   'Bosnia & Herzegovina',
  'Paraguay':       'Paraguay',
  'Fildişi Sahili': 'Ivory Coast',
  'Kongo DR':       'DR Congo',
  'Yeni Zelanda':   'New Zealand',
  'S. Arabistan':   'Saudi Arabia',
  'Suudi Arabistan':'Saudi Arabia',
  'Venezuela':      'Venezuela',
  'Panama':         'Panama',
  'Kürasao':        'Curaçao',
  'Çekya':          'Czech Republic',
  'Cabo Verde':     'Cape Verde',
}

function normTeam(name: string): string {
  return TEAM_NAME_MAP[name.trim()] ?? name.trim()
}

// WC 2026 lig anahtar kelimeleri
const WC_KEYWORDS = [
  'Dünya Kupası', 'World Cup', 'FIFA', 'WC 2026', 'Dünya Kup',
  '2026 Dünya', 'Dünya Kupasi'
]

function isWCMatch(league: string): boolean {
  const l = league.toLowerCase()
  // Kadınlar maçlarını çıkar
  if (l.includes('kadın') || l.includes('women') || l.includes('kadin')) return false
  return WC_KEYWORDS.some(kw => league.toLowerCase().includes(kw.toLowerCase()))
}

export async function fetchNosyOdds(apiKey: string): Promise<Record<string, NosyOdds>> {
  if (!apiKey) return {}

  try {
    // Bugün ve yarın için oranları çek
    const today = new Date().toISOString().slice(0, 10)
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    
    const results: Record<string, NosyOdds> = {}

    for (const date of [today, tomorrow]) {
      const res = await fetch(
        `https://www.nosyapi.com/apiv2/service/bettable-matches?apiKey=${apiKey}&date=${date}`,
        { cache: 'no-store' }
      )
      if (!res.ok) continue
      const data = await res.json()
      if (data.status !== 'success') continue

      for (const match of data.data ?? []) {
        // WC maçı mı?
        if (!isWCMatch(match.League ?? '')) continue

        const team1 = normTeam(match.Team1 ?? '')
        const team2 = normTeam(match.Team2 ?? '')

        if (!match.HomeWin || !match.Draw || !match.AwayWin) continue

        const key = `${team1}__${team2}`
        results[key] = {
          ms1:     parseFloat(match.HomeWin),
          msX:     parseFloat(match.Draw),
          ms2:     parseFloat(match.AwayWin),
          over25:  parseFloat(match.Over25 ?? '0'),
          under25: parseFloat(match.Under25 ?? '0'),
        }
        console.log(`[nosy] ✓ ${team1} vs ${team2}: ${match.HomeWin}/${match.Draw}/${match.AwayWin}`)
      }
    }

    console.log(`[nosy] ${Object.keys(results).length} WC maçı oranı alındı`)
    return results

  } catch (e) {
    console.error('[nosy] Hata:', e)
    return {}
  }
}
