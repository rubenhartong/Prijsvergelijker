"""Kruidvat via api.kruidvat.nl (EXPERIMENTEEL).

Kruidvat draait op SAP Commerce; de app gebruikt vermoedelijk de standaard OCC-REST-API:
  GET https://api.kruidvat.nl/api/v2/kvn/products/{code}?fields=FULL&lang=nl&curr=EUR
Vanaf Cloudflare/datacenters geeft dat pad een Akamai-403 (het bestaat dus). Vanaf een
thuisverbinding werkt het mogelijk, net als de AH-app-API. Het antwoordformaat is nog niet
geverifieerd: bij een onverwacht antwoord wordt een fragment gelogd zodat de parser kan
worden bijgesteld. Geen omzeiling: lukt het niet, dan is het een gewone fout.
"""
from __future__ import annotations

import re

import requests

from extract import Mislukt, Waarneming, bedrag, kies_label

BASIS = "https://api.kruidvat.nl/api/v2/kvn/products/"


def kv_code(url: str) -> str | None:
    m = re.search(r"/p/(\d+)", url)
    return m.group(1) if m else None


def naar_waarneming(d: dict) -> Waarneming:
    """OCC-productantwoord -> waarneming (velden volgens SAP Commerce OCC)."""
    prijs = bedrag((d.get("price") or {}).get("value"))
    if not prijs:
        raise Mislukt("kruidvat: geen price.value in API-antwoord")
    normaal = None
    for key in ("oldPrice", "basePrice", "strikeThroughPrice", "originalPrice"):
        v = bedrag((d.get(key) or {}).get("value")) if isinstance(d.get(key), dict) else None
        if v and v > prijs:
            normaal = v
            break
    teksten: list[str] = []
    for p in d.get("potentialPromotions") or d.get("promotions") or []:
        if isinstance(p, dict):
            teksten += [str(p.get(k)) for k in ("title", "description", "name", "promotionLabel") if p.get(k)]
    return Waarneming(prijs=prijs, normale_prijs=normaal, actie_label=kies_label(teksten, procent_toestaan=normaal is not None))


class KruidvatBron:
    def __init__(self):
        self.s = requests.Session()
        self.s.headers.update({"accept": "application/json", "accept-language": "nl-NL"})

    def haal(self, url: str) -> Waarneming:
        code = kv_code(url)
        if not code:
            raise Mislukt("kruidvat: geen productcode (/p/1234567) in url")
        r = self.s.get(BASIS + code, params={"fields": "FULL", "lang": "nl", "curr": "EUR"}, timeout=20)
        if r.status_code != 200 or "json" not in r.headers.get("content-type", ""):
            raise Mislukt(f"kruidvat-api: HTTP {r.status_code} · {r.text[:80]!r}")
        try:
            return naar_waarneming(r.json())
        except Mislukt as e:
            raise Mislukt(f"{e} · sleutels: {sorted(r.json().keys())[:25]}")
