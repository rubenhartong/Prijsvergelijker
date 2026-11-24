"""Plus via de anonieme data-API van plus.nl (zelfde als src/parsers/plus.ts in de Worker).

1. DataActionGetProductDetailsAndAgeInfo -> ProductOut.Overview.Price
2. DataActionGetPromotionOffer           -> Offer.DisplayInfo_Label ("2+3 GRATIS")
"""
from __future__ import annotations

import re
from datetime import date

import requests

from extract import Mislukt, Waarneming, bedrag

BASIS = "https://www.plus.nl"
PAD = "/screenservices/ECP_Product_CW/ProductDetails/PDPContent/"
BUNDEL = "/ECOP/scripts/ECP_Product_CW.ProductDetails.PDPContent.mvc.js"
ANONIEM_CSRF = "T6C+9iB49TLra4jEsMeSckDMNhQ="  # publiek, in /scripts/OutSystems.js
UA = "Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36"


def plus_sku(url: str) -> str | None:
    m = re.search(r"-(\d+)/?$", url.split("?")[0])
    return m.group(1) if m else None


def naar_waarneming(overview: dict | None, offer: dict | None, vandaag: str) -> Waarneming:
    prijs = bedrag((overview or {}).get("Price"))
    if not prijs:
        raise Mislukt("plus: geen prijs (product niet meer leverbaar?)")
    o = offer or {}
    actief = o.get("StartDate") and o.get("EndDate") and o["StartDate"] <= vandaag <= o["EndDate"]
    if not actief or o.get("IsFreeDeliveryOffer"):
        return Waarneming(prijs=prijs)
    label = (o.get("DisplayInfo_Label") or "").strip() or None
    nieuw, orig = bedrag(o.get("NewPrice")), bedrag(o.get("PriceOriginal_Product"))
    if nieuw and nieuw < prijs:
        return Waarneming(prijs=nieuw, normale_prijs=orig or prijs, actie_label=label)
    return Waarneming(prijs=prijs, actie_label=label)


class PlusBron:
    def __init__(self):
        self.s = requests.Session()
        self.s.headers.update({"user-agent": UA, "accept-language": "nl-NL,nl;q=0.9"})
        self.module: str | None = None
        self.api = {"DataActionGetProductDetailsAndAgeInfo": "TIMRoYZ6I2gwIxYu4Xk+Jg", "DataActionGetPromotionOffer": "pRmIEBbjlwOG2dJVuRaytA"}

    def _module(self, vers: bool = False) -> str:
        if not self.module or vers:
            r = self.s.get(BASIS + "/moduleservices/moduleversioninfo", timeout=15)
            if r.status_code != 200:
                raise Mislukt(f"plus: HTTP {r.status_code} op moduleversioninfo")
            self.module = r.json()["versionToken"]
        return self.module

    def _ververs_api(self) -> None:
        mi = self.s.get(BASIS + "/moduleservices/moduleinfo", timeout=15).json()
        v = (mi.get("manifest") or {}).get("urlVersions", {}).get(BUNDEL)
        if not v:
            return
        js = self.s.get(BASIS + BUNDEL + v, timeout=20).text
        for actie in self.api:
            m = re.search(rf'callDataAction\("{actie}", "[^"]+", "([^"]+)"', js)
            if m:
                self.api[actie] = m.group(1)

    def _roep(self, actie: str, sku: str, poging: int = 0) -> dict:
        body = {"versionInfo": {"moduleVersion": self._module(poging > 0), "apiVersion": self.api[actie]},
                "viewName": "MainFlow.ProductDetailsPage", "screenData": {"variables": {"SKU": sku}}}
        r = self.s.post(BASIS + PAD + actie, json=body, timeout=15,
                        headers={"accept": "application/json", "x-csrftoken": ANONIEM_CSRF})
        if r.status_code in (403, 429):
            raise Mislukt(f"plus: HTTP {r.status_code}")
        j = r.json() if "json" in r.headers.get("content-type", "") else {}
        vi = j.get("versionInfo") or {}
        if (vi.get("hasModuleVersionChanged") or vi.get("hasApiVersionChanged") or j.get("exception")) and poging == 0:
            if vi.get("hasApiVersionChanged") or j.get("exception"):
                self._ververs_api()
            return self._roep(actie, sku, 1)
        if j.get("exception"):
            raise Mislukt(f"plus: {j['exception'].get('message', 'fout')} ({actie})")
        if not j.get("data"):
            raise Mislukt(f"plus: leeg antwoord ({actie}, HTTP {r.status_code})")
        return j["data"]

    def haal(self, url: str) -> Waarneming:
        sku = plus_sku(url)
        if not sku:
            raise Mislukt("plus: geen SKU in url")
        details = self._roep("DataActionGetProductDetailsAndAgeInfo", sku)
        promo = self._roep("DataActionGetPromotionOffer", sku)
        return naar_waarneming((details.get("ProductOut") or {}).get("Overview"), promo.get("Offer"), date.today().isoformat())
