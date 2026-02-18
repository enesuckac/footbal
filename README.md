# Süper Lig Maç Önü Karşılaştırma Kartı

Bu proje, Süper Lig takımları için **iki takım karşılaştırmalı maç önü kartı** üretir.  
Arayüz modern bir infografik panel olarak tasarlandı ve veri katmanı iki kaynağa ayrıldı:

- **Transfermarkt:** kadro piyasa değeri, yaş ortalaması, transfer bilançosu, en değerli oyuncular.
- **TFF:** resmi puan cetveli + fikstür (puan, sıra, maç, galibiyet, beraberlik, mağlubiyet, gol, son form).

> Not: Varsayılan olarak TFF resmi web kaynağından canlı çekim yapılır.

---

## Özellikler

- Süper Lig takımlarından ev sahibi + deplasman seçimi
- Modern karşılaştırma kart tasarımı (responsive)
- Kritik metrikler için fark barları
- Her takım için son 5 form görünümü
- En değerli ilk 3 oyuncu kartları
- Kaynak/fallback durumu ve uyarı sistemi

---

## Kurulum

```bash
npm install
npm start
```

Uygulama: `http://localhost:3000`

---

## Özel TFF API Entegrasyonu (Opsiyonel)

Varsayılan TFF web scraping yerine kendi TFF API endpoint'ini kullanmak istersen:

```bash
TFF_API_BASE_URL=https://<senin-tff-api-adresin>
TFF_API_KEY=<opsiyonel-token>
```

Beklenen örnek endpoint:

`GET {TFF_API_BASE_URL}/teams/{teamSlug}/prematch`

Örnek JSON alanları:

```json
{
  "leaguePosition": 1,
  "points": 84,
  "matchesPlayed": 34,
  "wins": 27,
  "draws": 3,
  "losses": 4,
  "goalsFor": 86,
  "goalsAgainst": 31,
  "cleanSheets": 16,
  "avgPossession": 58.4,
  "ppda": 7.9,
  "recentForm": ["W", "W", "D", "W", "W"]
}
```

---

## API Endpointleri

- `GET /api/health`
- `GET /api/teams`
- `GET /api/compare?home=galatasaray&away=fenerbahce`

---

## Notlar

- Transfermarkt erişiminde anti-bot/erişim kısıtı olursa endpoint, arayüzü kırmamak için fallback döner.
- TFF tarafında önce resmi `Default.aspx?pageId=198` puan/fikstür sayfası denenir, engel olduğunda anasayfadaki resmi puan durumu modülüne düşülür.
- TFF'de bulunmayan metrikler (ör. possession, PPDA) bilinçli olarak `N/A` bırakılır; uydurma değer üretilmez.
- Geriye dönük uyumluluk için `TIF_API_BASE_URL` ve `TIF_API_KEY` değişkenleri de desteklenir.
