# Süper Lig Maç Önü Karşılaştırma Kartı

Bu proje, Süper Lig takımları için **iki takım karşılaştırmalı maç önü kartı** üretir.  
Arayüz modern bir infografik panel olarak tasarlandı ve veri katmanı iki kaynağa ayrıldı:

- **Transfermarkt:** kadro piyasa değeri, yaş ortalaması, transfer bilançosu, en değerli oyuncular.
- **TFF:** lig performans metrikleri (puan, form, gol, possession, PPDA vb).

> Not: TFF canlı endpoint tanımlı değilse uygulama otomatik olarak fallback veriyle çalışır.

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

## TFF Entegrasyonu (Opsiyonel)

Canlı TFF verisi kullanmak için environment değişkenleri:

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
- TFF canlı API tanımlanmadığında `TFF Fallback` veri katmanı devreye girer.
- Geriye dönük uyumluluk için `TIF_API_BASE_URL` ve `TIF_API_KEY` değişkenleri de desteklenir.
