# Prijsvergelijker

Persoonlijke prijsvergelijker. Houdt per productcategorie dagelijks de laagste **prijs per
eenheid** bij over winkels en gelijkwaardige merken, om te zien of een Picnic-actie echt
goedkoop is.

Stack: Cloudflare Worker (TypeScript) + D1, gratis plan.
Live: https://prijsvergelijker.overtime-web.workers.dev (invoerpagina op `/`, API onder `/api/*`).

## Opzet

```
src/index.ts        routes (API + invoerpagina) en cron-handler
src/db.ts           opslaan van waarnemingen, benchmark, samenvatting
src/normalize.ts    actielabel -> effectieve prijs per eenheid (unit tests in test/)
src/scrape.ts       cloud-scraper: batches, sequentieel, 1 verzoek per listing per dag
src/parsers/*.ts    één parser per winkel (jumbo, amazon, plus actief; rest -> thuis)
src/fetcher.ts      fetch met browserheaders, JSON-LD/meta-helpers
migrations/         D1-schema
seed/listings.py    startcategorieën + listings -> seed/seed.sql
VERKENNING.md       welke winkel werkt vanuit Cloudflare en welke niet
```

## Eenheden
| eenheid | prijs per | `stuks_per_verpakking` betekent |
|---|---|---|
| doekje | doekje | aantal doekjes (18x56 = 1008) |
| tablet | tablet | aantal tabletten |
| ml | **100 ml** | aantal ml |
| liter | liter | aantal liter (650 ml = 0.65) |

## Normalisatie
Prijs bij het **minimale aantal** voor de actie, met de normale prijs als basis:

| label | min. aantal | totaal |
|---|---|---|
| `x+y gratis`, `2e gratis` | x+y | x × prijs |
| `x voor €y` | x | y |
| `2e halve prijs` | 2 | 1,5 × prijs |
| `2e = z% korting` | 2 | (2 − z/100) × prijs |
| `z% korting` | 1 | (1 − z/100) × normale prijs |
| `nu €y` | 1 | y |
| onbekend label | 1 | prijs zonder actie (label wordt ruw bewaard) |

**Benchmark** = laagste prijs per eenheid van de laatste 90 dagen over alle listings van de
categorie. Na elke run wordt dit gecachet in `category.benchmark_prijs`/`benchmark_listing_id`.

## API (alles met `Authorization: Bearer <API_KEY>`)
| | |
|---|---|
| `GET /api/zoek?q=` | zoeken in gevolgde artikelen: per winkel laatste prijs, actie, prijs per eenheid |
| `GET /api/summary` | per categorie: beste prijs nu (winkel, URL), Picnic nu, benchmark, plus `listings_3_dagen_fout` |
| `GET/POST /api/categories` | categorieën |
| `GET/POST /api/listings`, `PATCH /api/listings/:id` | listings (`?scrape_methode=thuis&actief=1`, `?winkel=`) |
| `POST /api/observations` | waarnemingen van de thuis-scraper of handmatig (zie VERKENNING.md) |
| `GET /api/observations?listing_id=` | geschiedenis |
| `POST /api/scrape` | handmatig een cloud-batch (zelfde regels als de cron) |
| `POST /api/probe` | verkenning: één URL ophalen vanuit de Worker |
| `GET /api/runs` | laatste scrape-runs |

## Cron
`*/5 4-5 * * *` (UTC). De handler werkt alleen als het in Europe/Amsterdam 06:xx is, en pakt
dan per aanroep 4 listings die vandaag nog niet geprobeerd zijn. Zo zijn er 12 aanroepen,
dus maximaal 48 cloud-listings per dag.

## Beheer
```bash
npm test                      # unit tests
npm run deploy                # wrangler deploy (CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID)
npx wrangler secret put API_KEY
npm run db:migrate
python3 seed/listings.py && npm run db:seed   # LET OP: wist alle data en zet de seed opnieuw
```

## Thuis-scraper (Home Assistant-add-on)
Map `prijsvergelijker_thuis/` en `repository.yaml` vormen een add-on-repository. Voeg in
Home Assistant de repo-URL toe als add-on-repository. Zie `prijsvergelijker_thuis/DOCS.md`.
Tests: `python3 -m pytest prijsvergelijker_thuis/tests`.
