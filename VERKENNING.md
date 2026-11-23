# Verkenning: welke winkel werkt vanuit de Cloudflare Worker?

Getest op **2026-11-23** via `POST /api/probe`. De Worker haalt dan één pagina op met gewone
browserheaders (User-Agent, Accept-Language `nl-NL`) en meldt status, `<title>`, JSON-LD,
meta-prijs en Nuxt/Next-state. Per winkel is één productpagina getest, plus de homepage.
Er is **niets** gedaan om bot-bescherming te omzeilen: geen captcha's, geen gespoofte app-clients.
Wat geblokkeerd wordt, gaat naar de thuis-scraper (`scrape_methode = 'thuis'`).

| Winkel | Resultaat vanuit Worker | Bron van de prijs | Actielabel | Methode |
|---|---|---|---|---|
| **Jumbo** | ✅ 200, ~750 KB server-side HTML (Nuxt) | JSON-LD `offers.price` en Nuxt-payload `__NUXT_DATA__` → `product.price.price` / `promoPrice` (centen) | ✅ `product.promotions[].tags[].text`, bv. "1+1 gratis" | **cloud** |
| **Amazon** | ✅ 200, ~1,5 MB HTML (soms 202 op de homepage) | HTML: `#apex-pricetopay-accessibility-label` ("€ 17,99 met een besparing van 7 procent"), de buybox-prijs | ❌ geen; de "besparing" is t.o.v. de mediaanprijs en is geen actie. Coupons worden genegeerd. | **cloud** (gedeeltelijk, zie hieronder) |
| AH | ❌ 403 "Access Denied" (Akamai), zowel homepage als product | – | – | thuis |
| Kruidvat | ❌ 403 "Access Denied" (Akamai) | – | – | thuis |
| Etos | ❌ 403 | – | – | thuis |
| Action | ❌ 403 "Just a moment..." (Cloudflare-challenge) | – | – | thuis |
| HEMA | ❌ 403 "Verboden toegang" (homepage); productpagina gaf 500 | – | – | thuis |
| bol | ❌ 403 | – | – | thuis |
| Plus | ⚠️ 200, maar ~11 KB OutSystems-app-shell. Geen prijs, geen JSON-LD in de HTML. | De site haalt de data client-side op via een interne `screenservices`-API. Die is niet gebruikt (zie onder). | – | thuis |
| Picnic | ⚠️ picnic.app is een WordPress-marketingsite zonder productpagina's | Alleen via de ingelogde app-API (account nodig) | – | thuis |

## Details en valkuilen

### Jumbo
- De SKU staat aan het eind van de URL (`...-676439ZK`). De parser zoekt in `__NUXT_DATA__`
  (devalue-formaat: een platte array met verwijzingen naar indices) het object met dat `id`.
  Na een redirect geldt de SKU van de uiteindelijke URL: `...25-capsules-620022ZK` wordt
  bijvoorbeeld "Regular 27 Stuks".
- Op dezelfde pagina staan ook carrousel-producten met hun eigen acties. Daarom matchen we
  precies op SKU en niet op de eerste "1+1 gratis" in de HTML.
- `availability: Discontinued` en `__MISSING_PRODUCT__` geven een fout ("niet leverbaar").
  Voorbeelden: WaterWipes 3x60 en Taft Power Wax bij Jumbo.
- **Rate-limit:** na ~16 snelle verzoeken kwam er een 403 van Akamai. De cron haalt daarom
  maar 4 listings per aanroep op, wisselt winkels af en pauzeert 2,5 s tussen verzoeken.
  Toch kwam er bij de eerste volledige run nog 1 keer een 403.
- Op 2026-11-23 stonden alle Finish-producten bij Jumbo op "1+1 gratis" (Finish Ultimate 16:
  €0,31 per tablet).

### Amazon
- Werkt voor listings met een eigen buybox. Bij de eerste run gaven 8 van de 15
  Amazon-listings "geen buybox-prijs" of "momenteel niet verkrijgbaar". Vanuit een
  datacenter-IP (Amazon denkt "Bezorgen aan Amsterdam") ontbreekt de buybox vaak, of het
  product is echt alleen via derden te koop. Na 3 mislukte dagen verschijnen ze in
  `/api/summary` → `listings_3_dagen_fout`; zet ze dan op `thuis`.
- Gesponsorde producten op dezelfde pagina hebben ook prijzen (`a-offscreen`). Die negeren we
  bewust; alleen `apex-pricetopay` telt.
- De pagina is groot (1,5 MB). Op het gratis plan (10 ms CPU per aanroep) is dat de reden
  voor kleine batches.

### Plus (niet gedaan, mogelijk later)
De Plus-site laadt productdata via OutSystems-`screenservices` (bv.
`ECP_Product_CW/ProductDetails/PDPContent/DataActionGetProductDetailsAndAgeInfo`). Dat
endpoint vraagt een `moduleVersion`, een `apiVersion` uit de JS-bundel en een CSRF-header
die bij elke release kunnen wijzigen. Het is niet geprobeerd, omdat het buiten "een
productpagina ophalen" valt. Wil je het toch, dan is het een kleine aparte parser. Tot die tijd gaat Plus via de thuis-scraper (Playwright).

### Picnic
Picnic heeft geen publieke productpagina's. De listing-URL `https://picnic.app/nl/producten/<id>`
is een **pseudo-URL** die alleen het Picnic-product-id (`s1163321`) bevat voor de
thuis-scraper. Die kan met jouw Picnic-account de app-API gebruiken. De Picnic-prijzen van
2026-11-23 zijn één keer handmatig ingevoerd (`bron = 'handmatig'`) via de Picnic-koppeling.
Ze zijn zonder actielabel opgeslagen.

## Thuis-scraper (later)
Een Home Assistant-add-on (Python + Playwright, ARM64) haalt de werklijst op en stuurt de
ruwe prijzen terug. De Worker normaliseert, dus de add-on hoeft geen actielogica te kennen.

```
GET  /api/listings?scrape_methode=thuis&actief=1      (Authorization: Bearer <API_KEY>)
POST /api/observations
{
  "bron": "thuis",
  "observations": [
    { "listing_id": 12, "prijs": 4.29, "normale_prijs": null, "actie_label": "2e halve prijs" },
    { "listing_id": 13, "bron_ok": false, "foutmelding": "captcha" }
  ]
}
```
`datum` is optioneel (standaard: vandaag, NL-tijd). Per listing en dag is er één rij. Een
mislukte waarneming overschrijft nooit een geslaagde van dezelfde dag.
