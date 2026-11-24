"""Jumbo: productpagina via de browser; prijs en actie uit de Nuxt-payload (__NUXT_DATA__).

Zelfde logica als src/parsers/jumbo.ts in de Worker: zoek het product-object met id == SKU uit
de URL; price.price / price.promoPrice (centen) en promotions[].tags[].text.
"""
from __future__ import annotations

import json
import re

from extract import Mislukt, Waarneming, generiek

WRAPPERS = {"Reactive", "ShallowReactive", "Ref", "ShallowRef", "EmptyRef"}


def sku_uit_url(url: str) -> str | None:
    m = re.search(r"-([0-9]+[A-Z]+)/?(?:\?.*)?$", url)
    return m.group(1) if m else None


def _los(a: list, i, diepte: int = 0):
    if not isinstance(i, int) or isinstance(i, bool) or diepte > 8 or i >= len(a):
        return None
    v = a[i]
    if isinstance(v, list):
        if v and isinstance(v[0], str) and v[0] in WRAPPERS:
            return _los(a, v[1], diepte + 1)
        return [_los(a, x, diepte + 1) for x in v]
    if isinstance(v, dict):
        return {k: _los(a, x, diepte + 1) for k, x in v.items()}
    return v


def jumbo(doc: str, url: str, url_na_redirect: str | None = None) -> Waarneming:
    if "__MISSING_PRODUCT__" in doc:
        raise Mislukt("jumbo: product niet meer in assortiment")
    kop = doc[:200000]
    if re.search(r"schema\.org/(Discontinued|OutOfStock|SoldOut)", kop) and "schema.org/InStock" not in kop:
        raise Mislukt("jumbo: niet leverbaar (JSON-LD availability)")
    sku = sku_uit_url(url_na_redirect or "") or sku_uit_url(url)
    m = re.search(r'<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)</script>', doc)
    if m and sku:
        a = json.loads(m.group(1))
        try:
            idx = a.index(sku)
        except ValueError:
            idx = -1
        for v in a:
            if isinstance(v, dict) and v.get("id") == idx and "price" in v:
                price = _los(a, v.get("price")) or {}
                promos = _los(a, v.get("promotions")) or []
                tags = [t.get("text") for p in promos if isinstance(p, dict) for t in (p.get("tags") or []) if isinstance(t, dict) and t.get("text")]
                if not price.get("price"):
                    break
                normaal = price["price"] / 100
                promo = price["promoPrice"] / 100 if price.get("promoPrice") else None
                return Waarneming(prijs=promo or normaal, normale_prijs=normaal if promo else None, actie_label=" | ".join(tags) or None)
    return generiek(doc, [], "jumbo")  # terugval: JSON-LD zonder actie
