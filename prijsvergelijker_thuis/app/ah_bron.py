"""Albert Heijn via de app-API (api.ah.nl), met een anoniem token. Geen account nodig.

Werkwijze zoals open-source-wrappers (bv. github.com/RinseV/albert-heijn-wrapper):
  POST /mobile-auth/v1/auth/token/anonymous {"clientId": "appie-android"}
  POST /graphql  product(id) { priceV2 { now was discount { description ... } } }
De website (www.ah.nl) blokkeert browsers met Akamai; deze API werkt vanaf een
thuisverbinding wel (vanaf Cloudflare/datacenters niet).
"""
from __future__ import annotations

import re
import time
from datetime import date

import requests

from extract import Mislukt, Waarneming

BASIS = "https://api.ah.nl"
QUERY = """query Product($id: Int!) {
  product(id: $id) {
    id title salesUnitSize
    availability { online { status } }
    priceV2 {
      now { amount }
      was { amount }
      discount { description promotionType productCount multipleItemPromotion availability { startDate endDate } }
    }
  }
}"""


def ah_id(url: str) -> int | None:
    m = re.search(r"/wi(\d+)", url)
    return int(m.group(1)) if m else None


def naar_waarneming(product: dict | None, vandaag: str) -> Waarneming:
    """Pure vertaling van het GraphQL-antwoord (getest)."""
    if not product:
        raise Mislukt("ah: product niet gevonden (niet meer in assortiment?)")
    p = product.get("priceV2") or {}
    nu = (p.get("now") or {}).get("amount")
    was = (p.get("was") or {}).get("amount")
    if not nu:
        raise Mislukt("ah: geen prijs (niet leverbaar?)")
    label = None
    d = p.get("discount") or {}
    beschikbaar = d.get("availability") or {}
    start, eind = (beschikbaar.get("startDate") or "")[:10], (beschikbaar.get("endDate") or "")[:10]
    if d.get("description") and (not start or start <= vandaag) and (not eind or vandaag <= eind):
        label = d["description"].strip()
    normaal = float(was) if was and float(was) > float(nu) else None
    tekst = " ".join(x for x in (product.get("title"), product.get("salesUnitSize")) if x) or None
    return Waarneming(prijs=float(nu), normale_prijs=normaal, actie_label=label, verpakking_tekst=tekst)


class AhBron:
    def __init__(self):
        self.s = requests.Session()
        self.s.headers.update({"content-type": "application/json", "accept": "application/json"})
        self._token: str | None = None
        self._verloopt = 0.0

    def _token_ophalen(self) -> str:
        if self._token and time.time() < self._verloopt:
            return self._token
        r = self.s.post(f"{BASIS}/mobile-auth/v1/auth/token/anonymous", json={"clientId": "appie-android"}, timeout=20)
        if r.status_code != 200:
            raise Mislukt(f"ah: token geweigerd (HTTP {r.status_code})")
        j = r.json()
        self._token = j["access_token"]
        self._verloopt = time.time() + max(60, int(j.get("expires_in", 3600)) - 60)
        return self._token

    def haal(self, url: str) -> Waarneming:
        pid = ah_id(url)
        if not pid:
            raise Mislukt("ah: geen wi-nummer in url")
        r = self.s.post(
            f"{BASIS}/graphql",
            json={"query": QUERY, "variables": {"id": pid}},
            headers={"authorization": f"Bearer {self._token_ophalen()}"},
            timeout=20,
        )
        if r.status_code != 200:
            raise Mislukt(f"ah: HTTP {r.status_code} op graphql")
        j = r.json()
        if j.get("errors") and not (j.get("data") or {}).get("product"):
            raise Mislukt(f"ah: {j['errors'][0].get('message', 'graphql-fout')[:120]}")
        return naar_waarneming((j.get("data") or {}).get("product"), date.today().isoformat())
