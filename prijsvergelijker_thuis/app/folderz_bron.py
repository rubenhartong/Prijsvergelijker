"""Folderacties via Folderz.nl (voor Kruidvat en Action, die zelf niet uit te lezen zijn).

Folderz staat achter een AWS-WAF-JavaScript-check (geen captcha); de gewone Chromium van
de add-on voert die uit zoals elke browser. Per dag: 1 overzichtspagina per winkel en daarna
alleen de aanbiedingen die op een trefwoord van onze categorieën lijken (max MAX_PER_WINKEL).

Het HTML-formaat van Folderz is vanuit de cloud niet te zien; daarom logt deze module wat
er gevonden wordt, zodat de extractie bijgesteld kan worden.
"""
from __future__ import annotations

import json
import logging
import random
import re
import time
from datetime import date

from extract import bedrag, kies_label

log = logging.getLogger("folderz")
MAX_PER_WINKEL = 20
BASIS = "https://www.folderz.nl/winkels/{w}/aanbiedingen"
MERK = "https://www.folderz.nl/aanbiedingen/{t}"   # alle winkels, per merk/trefwoord
MAANDEN = {m: i + 1 for i, m in enumerate(["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"])}

JS_LINKS = """() => [...document.querySelectorAll('a[href*="/aanbiedingen/"]')]
  .map(a => ({href: a.href, tekst: (a.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 200)}))"""
JS_TEKSTEN = """() => {
  const out = [];
  for (const el of document.querySelectorAll('h1, h2, [class*="label" i], [class*="badge" i], [class*="discount" i], [class*="promo" i], [class*="price" i], [class*="valid" i], [class*="date" i]')) {
    const t = (el.innerText || '').replace(/\\s+/g, ' ').trim();
    if (t && t.length <= 160) out.push(t);
    if (out.length > 80) break;
  }
  return {h1: (document.querySelector('h1') || {}).innerText || '', teksten: out, body: (document.body.innerText || '').slice(0, 4000)};
}"""

DATUM = re.compile(r"(\d{1,2})[-/.](\d{1,2})(?:[-/.](\d{2,4}))?")


def offer_links(links: list[dict], winkel: str) -> list[dict]:
    """Alleen links naar losse aanbiedingen van deze winkel, uniek."""
    pat = re.compile(rf"/winkels/{re.escape(winkel)}/aanbiedingen/[^/?#]+-\d+/?$")
    gezien, uit = set(), []
    for l in links:
        h = l.get("href", "").split("?")[0]
        if pat.search(h) and h not in gezien:
            gezien.add(h)
            uit.append({"href": h, "tekst": l.get("tekst", "")})
    return uit


def past_bij(link: dict, trefwoorden: list[str]) -> bool:
    t = " " + re.sub(r"[^a-z0-9]+", " ", (link["href"].rsplit("/", 2)[-2] + " " + link["tekst"]).lower()) + " "
    return any(f" {w} " in t for w in trefwoorden)


def _iso(dag: str, maand: str, jaar: str | None, vandaag: date) -> str | None:
    try:
        j = int(jaar) if jaar else vandaag.year
        if j < 100:
            j += 2000
        d = date(j, int(maand), int(dag))
        if not jaar and (d - vandaag).days < -200:  # jaarwisseling
            d = date(j + 1, int(maand), int(dag))
        return d.isoformat()
    except ValueError:
        return None


def geldigheid(tekst: str, vandaag: date) -> tuple[str | None, str | None]:
    """'Geldig: 24 nov t/m 29 nov' / 'geldig van 23-11 t/m 29-11' / 'Geldig t/m 29-11-2026' -> (van, tot)."""
    t = tekst.lower()
    md = r"(\d{1,2})\s*(jan|feb|mrt|maa|apr|mei|jun|jul|aug|sep|okt|nov|dec)[a-z]*\.?(?:\s*(\d{4}))?"
    m = re.search(md + r"\s*(?:t/m|tot en met|-|–)\s*" + md, t)
    if m:
        g = m.groups()
        mnd = lambda x: str(MAANDEN.get(x[:3], 3 if x.startswith("maa") else 0))
        return _iso(g[0], mnd(g[1]), g[2], vandaag), _iso(g[3], mnd(g[4]), g[5], vandaag)
    m = re.search(r"(?:t/m|tot en met)\s*" + md, t)
    if m:
        g = m.groups()
        return None, _iso(g[0], str(MAANDEN.get(g[1][:3], 0)), g[2], vandaag)
    m = re.search(r"(\d{1,2}[-/.]\d{1,2}(?:[-/.]\d{2,4})?)\s*(?:t/m|tot en met|tot|-|–)\s*(\d{1,2}[-/.]\d{1,2}(?:[-/.]\d{2,4})?)", t)
    if m:
        a, b = DATUM.match(m.group(1)), DATUM.match(m.group(2))
        return _iso(*a.groups(), vandaag), _iso(*b.groups(), vandaag)
    m = re.search(r"(?:t/m|tot en met|geldig tot)\s*(\d{1,2}[-/.]\d{1,2}(?:[-/.]\d{2,4})?)", t)
    if m:
        return None, _iso(*DATUM.match(m.group(1)).groups(), vandaag)
    return None, None


def uit_jsonld(doc: str) -> dict:
    """Naam, prijs en geldigheid uit JSON-LD (Offer/Product), als Folderz dat heeft."""
    uit: dict = {}
    for m in re.finditer(r'<script[^>]+application/ld\+json[^>]*>([\s\S]*?)</script>', doc, re.I):
        try:
            blok = json.loads(m.group(1))
        except ValueError:
            continue
        for o in blok if isinstance(blok, list) else [blok]:
            if not isinstance(o, dict):
                continue
            offers = o.get("offers") if isinstance(o.get("offers"), (dict, list)) else o
            for off in offers if isinstance(offers, list) else [offers]:
                if not isinstance(off, dict):
                    continue
                uit.setdefault("naam", o.get("name"))
                p = bedrag(off.get("price"))
                if p:
                    uit.setdefault("prijs", p)
                for k_in, k_uit in (("validFrom", "van"), ("validThrough", "tot"), ("priceValidUntil", "tot")):
                    if isinstance(off.get(k_in), str):
                        uit.setdefault(k_uit, off[k_in][:10])
    return uit


def lees_actie(winkel: str, url: str, doc: str, info: dict, vandaag: date) -> dict:
    """Aanbiedingspagina: h1 = titel (vaak met label), daarna 'Geldig: … t/m …' en '€ oud' '€ nieuw'.
    Alleen de tekst vóór 'Anderen bekeken' telt (daarna staan andere aanbiedingen)."""
    titel = (info.get("h1") or "").strip()
    body = info.get("body", "")
    for stop in ("Anderen bekeken", "Vergelijkbare aanbiedingen", "Bekijk folder"):
        if stop in body:
            body = body.split(stop, 1)[0]
    i = body.find(titel) if titel else -1
    hoofd = body[i:] if i >= 0 else body
    label = kies_label([titel, hoofd[:400]])
    van, tot = geldigheid(hoofd, vandaag)
    bedragen = [bedrag(x) for x in re.findall(r"€\s*\d+(?:[.,]\d{1,2})?", hoofd)]
    bedragen = [x for x in bedragen if x]
    was, nu = (bedragen[0], bedragen[1]) if len(bedragen) >= 2 and bedragen[1] < bedragen[0] else (None, bedragen[0] if bedragen else None)
    ld = uit_jsonld(doc)
    return {"winkel": winkel, "titel": titel or ld.get("naam") or url.rsplit("/", 2)[-2], "actie_label": label,
            "prijs": nu or ld.get("prijs"), "prijs_was": was, "geldig_van": van or ld.get("van"), "geldig_tot": tot or ld.get("tot"), "url": url}


def ronde(browser, winkels: list[str], trefwoorden: list[str], pauze: int) -> list[dict]:
    """Per trefwoord de merkpagina (alle winkels) lezen, alleen `winkels` houden, en per
    aanbieding de detailpagina openen voor label, geldigheid en prijzen."""
    vandaag = date.today()
    gevonden: dict[str, dict] = {}
    for t in trefwoorden:
        try:
            links = browser.links(MERK.format(t=t), JS_LINKS)
        except Exception as e:  # noqa: BLE001
            log.warning("folderz %s: merkpagina mislukt: %s", t, e)
            continue
        n = 0
        for w in winkels:
            for l in offer_links(links, w):
                if past_bij(l, [t]) and l["href"] not in gevonden:
                    gevonden[l["href"]] = {"winkel": w, **l}
                    n += 1
        log.info("folderz '%s': %d links, %d aanbiedingen bij %s", t, len(links), n, "/".join(winkels))
        time.sleep(random.uniform(pauze, pauze * 2))
    acties: list[dict] = []
    for l in list(gevonden.values())[: MAX_PER_WINKEL * max(1, len(winkels))]:
        time.sleep(random.uniform(pauze, pauze * 2))
        try:
            status, doc, info = browser.pagina_info(l["href"], JS_TEKSTEN)
            if status and status >= 400:
                log.warning("folderz: HTTP %s op %s", status, l["href"])
                continue
            a = lees_actie(l["winkel"], l["href"], doc, info, vandaag)
            log.info("folderz ✓ %s: %s | %s | €%s→€%s | %s t/m %s", a["winkel"], a["titel"][:60], a["actie_label"], a["prijs_was"], a["prijs"], a["geldig_van"], a["geldig_tot"])
            acties.append(a)
        except Exception as e:  # noqa: BLE001
            log.warning("folderz: %s mislukt: %s", l["href"], e)
    return acties
