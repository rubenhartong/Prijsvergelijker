"""Prijsvergelijker thuis-scraper (Home Assistant-add-on).

Elke dag op `tijd` (Europe/Amsterdam):
  1. GET  /api/listings?scrape_methode=thuis&actief=1
  2. per listing (sequentieel, met pauze; max 1x per dag) prijs + actielabel ophalen
  3. POST /api/observations (bron 'thuis'); de Worker normaliseert.
"""
from __future__ import annotations

import json
import logging
import os
import random
import time
from collections import defaultdict
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from api import WorkerAPI
from extract import Mislukt, uit_pagina

TZ = ZoneInfo("Europe/Amsterdam")
OPTIES = os.environ.get("OPTIES_BESTAND", "/data/options.json")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("thuis")


def lees_opties() -> dict:
    with open(OPTIES) as f:
        return json.load(f)


def vandaag() -> str:
    return datetime.now(TZ).strftime("%Y-%m-%d")


def volgorde(listings: list[dict]) -> list[dict]:
    """Winkels om-en-om, zodat dezelfde winkel niet snel achter elkaar bezocht wordt."""
    per = defaultdict(list)
    for l in listings:
        per[l["winkel"]].append(l)
    uit = []
    while any(per.values()):
        for w in sorted(per):
            if per[w]:
                uit.append(per[w].pop(0))
    return uit


def te_doen(listings: list[dict], winkels: list[str], dag: str) -> list[dict]:
    return [l for l in listings if l["winkel"] in winkels and l.get("laatste_datum") != dag]


def ronde(opt: dict) -> None:
    api = WorkerAPI(opt["api_url"], opt["api_key"])
    dag = vandaag()
    lijst = volgorde(te_doen(api.werklijst(), opt.get("winkels", []), dag))
    log.info("Ronde %s: %d listings te doen", dag, len(lijst))
    if not lijst:
        return

    browser = None
    picnic = None
    picnic_fout = None
    buffer: list[dict] = []
    stats = defaultdict(lambda: [0, 0])
    pauze = max(2, int(opt.get("pauze_seconden", 8)))

    try:
        for i, l in enumerate(lijst):
            if i:
                time.sleep(random.uniform(pauze, pauze * 2))
            w = l["winkel"]
            try:
                if w == "picnic":
                    if picnic is None and picnic_fout is None:
                        try:
                            from picnic_bron import PicnicBron

                            picnic = PicnicBron(opt.get("picnic_email", ""), opt.get("picnic_password", ""), opt.get("picnic_2fa_code", ""))
                        except Mislukt as e:
                            picnic_fout = str(e)
                    if picnic_fout:
                        raise Mislukt(picnic_fout)
                    r = picnic.haal(l["url"])
                else:
                    if browser is None:
                        from browser import Browser_

                        browser = Browser_()
                    status, doc, labels = browser.haal(l["url"])
                    r = uit_pagina(w, status, doc, labels)
                obs = {"listing_id": l["id"], "datum": dag, "prijs": r.prijs, "normale_prijs": r.normale_prijs, "actie_label": r.actie_label}
                stats[w][0] += 1
                log.info("✓ #%s %s %s: €%s %s", l["id"], w, l["productnaam"], r.prijs, r.actie_label or "")
            except Exception as e:  # noqa: BLE001 - elke fout wordt een mislukte waarneming
                msg = str(e) if isinstance(e, Mislukt) else f"{w}: {type(e).__name__}: {e}"
                obs = {"listing_id": l["id"], "datum": dag, "bron_ok": False, "foutmelding": msg[:300]}
                stats[w][1] += 1
                log.warning("✗ #%s %s %s: %s", l["id"], w, l["productnaam"], msg)
            buffer.append(obs)
            if len(buffer) >= 10:
                api.stuur(buffer)
                buffer = []
    finally:
        try:
            api.stuur(buffer)
        finally:
            if browser:
                browser.sluit()
    log.info("Klaar. Per winkel (ok/fout): %s", {k: tuple(v) for k, v in stats.items()})


def volgende_start(tijd: str, nu: datetime) -> datetime:
    uur, minuut = (int(x) for x in tijd.split(":"))
    t = nu.replace(hour=uur, minute=minuut, second=0, microsecond=0)
    return t if t > nu else t + timedelta(days=1)


def main() -> None:
    opt = lees_opties()
    if not opt.get("api_key"):
        log.error("api_key ontbreekt in de add-on-opties")
    if opt.get("direct_bij_start"):
        try:
            ronde(opt)
        except Exception:
            log.exception("Ronde mislukt")
    while True:
        nu = datetime.now(TZ)
        start = volgende_start(opt.get("tijd", "06:30"), nu)
        log.info("Volgende ronde: %s", start.isoformat())
        time.sleep(max(1, (start - nu).total_seconds()))
        try:
            ronde(lees_opties())
        except Exception:
            log.exception("Ronde mislukt")


if __name__ == "__main__":
    main()
