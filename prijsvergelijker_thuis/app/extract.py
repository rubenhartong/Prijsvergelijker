"""Pure extractie uit HTML en tekst: prijs, actielabel en blokkade-detectie.

Geen browser- of netwerkcode, zodat dit met fixtures te testen is.
De Worker normaliseert het actielabel; hier verzamelen we alleen ruwe waarden.
"""
from __future__ import annotations

import html as htmllib
import json
import re
from dataclasses import dataclass


@dataclass
class Waarneming:
    prijs: float | None
    normale_prijs: float | None = None
    actie_label: str | None = None


class Mislukt(Exception):
    """Pagina geladen, maar geen bruikbare prijs. Bericht gaat mee naar de Worker."""


def bedrag(s: str | float | int | None) -> float | None:
    """'€ 5,99' / '5.99' / '1.299,00' / 5.99 -> float."""
    if s is None:
        return None
    if isinstance(s, (int, float)):
        return float(s) if s > 0 else None
    t = htmllib.unescape(str(s)).replace("\xa0", " ")
    m = re.search(r"(\d{1,3}(?:[.\s]\d{3})*|\d+)(?:[.,](\d{1,2}))?", t)
    if not m:
        return None
    heel = int(re.sub(r"[.\s]", "", m.group(1)))
    dec = int(m.group(2).ljust(2, "0")) / 100 if m.group(2) else 0
    v = round(heel + dec, 2)
    return v if v > 0 else None


# ---------------------------------------------------------------- blokkades
BLOK_TITELS = re.compile(
    r"access denied|just a moment|verboden toegang|attention required|robot check|captcha|"
    r"pardon our interruption|toegang geweigerd|are you a robot|ben je een robot",
    re.I,
)


def titel(doc: str) -> str:
    m = re.search(r"<title[^>]*>([\s\S]*?)</title>", doc, re.I)
    return re.sub(r"\s+", " ", htmllib.unescape(m.group(1))).strip()[:120] if m else ""


def blokkade(status: int | None, doc: str) -> str | None:
    """Geeft een reden terug als de pagina een blokkade/captcha is."""
    t = titel(doc)
    if status and status >= 400:
        return f"HTTP {status} · titel '{t}'"
    if BLOK_TITELS.search(t):
        return f"blokkade/captcha · titel '{t}'"
    if re.search(r"captcha", doc[:20000], re.I) and len(doc) < 30000:
        return f"captcha · titel '{t}'"
    return None


# ---------------------------------------------------------------- JSON-LD
def _objecten(x):
    if isinstance(x, list):
        for y in x:
            yield from _objecten(y)
    elif isinstance(x, dict):
        yield x
        for v in x.values():
            if isinstance(v, (dict, list)):
                yield from _objecten(v)


def _is_type(o: dict, t: str) -> bool:
    v = o.get("@type")
    return v == t or (isinstance(v, list) and t in v)


def jsonld_product(doc: str) -> tuple[float | None, str | None]:
    """(prijs, availability) uit het eerste Product met offers in JSON-LD."""
    for m in re.finditer(r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>([\s\S]*?)</script>', doc, re.I):
        try:
            blok = json.loads(m.group(1).strip())
        except (ValueError, TypeError):
            continue
        for o in _objecten(blok):
            if not _is_type(o, "Product"):
                continue
            for off in _objecten(o.get("offers")):
                p = bedrag(off.get("price", off.get("lowPrice")))
                if p:
                    av = off.get("availability")
                    return p, av if isinstance(av, str) else None
    return None, None


def meta_prijs(doc: str) -> float | None:
    for pat in (
        r'<meta[^>]+(?:property|name)=["\'](?:product|og):price:amount["\'][^>]+content=["\']([\d.,]+)["\']',
        r'<meta[^>]+content=["\']([\d.,]+)["\'][^>]+(?:property|name)=["\'](?:product|og):price:amount["\']',
        r'itemprop=["\']price["\'][^>]*content=["\']([\d.,]+)["\']',
    ):
        m = re.search(pat, doc, re.I)
        if m and bedrag(m.group(1)):
            return bedrag(m.group(1))
    return None


# ---------------------------------------------------------------- actielabels
# Herkent dezelfde soorten als src/normalize.ts in de Worker. We kiezen hier alleen
# welke tekst het label is; de Worker rekent.
ACTIE = re.compile(
    r"(\d+\s*\+\s*\d+\s*gratis"
    r"|\d+e?\s*(?:artikel\s*)?(?:halve\s*prijs|gratis)"
    r"|(?:2e|2de|tweede)\s*(?:artikel\s*|stuk\s*)?(?:halve\s*prijs|gratis|(?:=|voor|aan)?\s*\d+\s*%\s*korting)"
    r"|\d+\s*(?:stuks\s*)?voor\s*(?:€|eur)?\s*\d+(?:[.,]\d{1,2}|,-)?"
    r"|\d+\s*%\s*korting"
    r"|nu\s*(?:voor\s*)?€\s*\d+(?:[.,]\d{1,2})?)",
    re.I,
)


def kies_label(kandidaten: list[str]) -> str | None:
    """Eerste kandidaat-tekst (in documentvolgorde) die op een actie lijkt."""
    for k in kandidaten:
        t = re.sub(r"\s+", " ", htmllib.unescape(k or "")).strip()
        if not t or len(t) > 120:
            continue
        m = ACTIE.search(t)
        if m:
            return m.group(1).strip()
    return None


# ---------------------------------------------------------------- per winkel
def amazon(doc: str) -> Waarneming:
    i = doc.find('id="apex-pricetopay-accessibility-label"')
    if i < 0:
        if "Momenteel niet verkrijgbaar" in doc:
            raise Mislukt("Amazon: momenteel niet verkrijgbaar")
        raise Mislukt("Amazon: geen buybox-prijs (alleen via andere verkopers?)")
    start = doc.find(">", i) + 1
    tekst = re.sub(r"<[^>]+>", " ", doc[start : doc.find("</span>", start)])
    p = bedrag(htmllib.unescape(tekst))
    if not p:
        raise Mislukt(f"Amazon: prijs onleesbaar: {tekst.strip()[:60]}")
    # 'besparing van x procent' is t.o.v. de mediaanprijs, geen actie.
    return Waarneming(prijs=p)


NIET_LEVERBAAR = ("Discontinued", "OutOfStock", "SoldOut")


def generiek(doc: str, label_kandidaten: list[str] | None = None, winkel: str = "") -> Waarneming:
    p, av = jsonld_product(doc)
    if av and any(x in av for x in NIET_LEVERBAAR):
        raise Mislukt(f"{winkel}: niet leverbaar ({av.rsplit('/', 1)[-1]})")
    p = p or meta_prijs(doc)
    if not p:
        raise Mislukt(f"{winkel}: geen prijs in JSON-LD/meta · titel '{titel(doc)}'")
    return Waarneming(prijs=p, actie_label=kies_label(label_kandidaten or []))


def uit_pagina(winkel: str, status: int | None, doc: str, label_kandidaten: list[str] | None = None) -> Waarneming:
    reden = blokkade(status, doc)
    if reden:
        raise Mislukt(f"{winkel}: {reden}")
    if winkel == "amazon":
        return amazon(doc)
    return generiek(doc, label_kandidaten, winkel)
