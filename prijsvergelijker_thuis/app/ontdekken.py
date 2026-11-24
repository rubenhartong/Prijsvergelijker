"""Producten ontdekken voor categorieën met zoektermen (huishouden): Picnic en AH doorzoeken
en de resultaten als kandidaten naar de Worker sturen (POST /api/kandidaten). Daaruit worden
listings gekozen. Draait alleen als de optie `ontdekken` aan staat, max. 1x per dag.
"""
from __future__ import annotations

import logging
import random
import time

log = logging.getLogger("ontdekken")
MAX_PER_TERM = 15
AH_ZOEK = """query Search($input: SearchProductsInput!) {
  searchProductsExperimental(input: $input) {
    products { id title brand salesUnitSize webPath priceV2 { now { amount } } }
  }
}"""


def picnic_kandidaten(api, cid: int, term: str) -> list[dict]:
    res = api.search(term)
    uit = []
    for it in (res.items or [])[:MAX_PER_TERM]:
        uit.append({"category_id": cid, "winkel": "picnic", "zoekterm": term, "extern_id": it.id, "naam": it.name or it.id,
                    "hoeveelheid": it.unit_quantity, "prijs": (it.display_price or 0) / 100 or None,
                    "url": f"https://picnic.app/nl/producten/{it.id}"})
    return uit


def ah_kandidaten(ah, cid: int, term: str) -> list[dict]:
    r = ah.s.post(f"{ah_basis()}/graphql", json={"query": AH_ZOEK, "variables": {"input": {"query": term}}},
                  headers={"authorization": f"Bearer {ah._token_ophalen()}"}, timeout=20)
    j = r.json()
    if j.get("errors"):
        log.warning("AH-zoeken '%s': %s", term, j["errors"][0].get("message"))
    prods = (((j.get("data") or {}).get("searchProductsExperimental") or {}).get("products")) or []
    uit = []
    for p in prods[:MAX_PER_TERM]:
        prijs = ((p.get("priceV2") or {}).get("now") or {}).get("amount")
        uit.append({"category_id": cid, "winkel": "ah", "zoekterm": term, "extern_id": f"wi{p['id']}", "naam": p.get("title") or "",
                    "merk": p.get("brand"), "hoeveelheid": p.get("salesUnitSize"), "prijs": prijs,
                    "url": "https://www.ah.nl" + (p.get("webPath") or f"/producten/product/wi{p['id']}")})
    return uit


def ah_basis() -> str:
    from ah_bron import BASIS
    return BASIS


def ronde(api, categorieen: list[dict], picnic, ah, pauze: int) -> int:
    totaal = 0
    for c in categorieen:
        for term in [t.strip() for t in (c.get("zoektermen") or "").split(",") if t.strip()]:
            kand: list[dict] = []
            for naam, bron, fn in (("picnic", picnic, picnic_kandidaten), ("ah", ah, ah_kandidaten)):
                if bron is None:
                    continue
                try:
                    kand += fn(bron if naam == "ah" else bron.api, c["id"], term)
                except Exception as e:  # noqa: BLE001
                    log.warning("%s zoeken '%s' mislukt: %s", naam, term, e)
                time.sleep(random.uniform(pauze / 2, pauze))
            if kand:
                api.stuur_kandidaten(kand)
                totaal += len(kand)
            log.info("ontdekken '%s' (%s): %d kandidaten", term, c["naam"], len(kand))
    return totaal
