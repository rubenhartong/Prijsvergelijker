"""Klein klientje voor de Worker-API."""
from __future__ import annotations

import logging

import requests

log = logging.getLogger("api")


class WorkerAPI:
    def __init__(self, basis: str, sleutel: str):
        self.basis = basis.rstrip("/")
        self.s = requests.Session()
        self.s.headers.update({"authorization": f"Bearer {sleutel}", "user-agent": "prijsvergelijker-thuis/0.1"})

    def werklijst(self) -> list[dict]:
        r = self.s.get(f"{self.basis}/api/listings", params={"scrape_methode": "thuis", "actief": "1"}, timeout=30)
        r.raise_for_status()
        return r.json()

    def stuur(self, waarnemingen: list[dict]) -> None:
        if not waarnemingen:
            return
        r = self.s.post(f"{self.basis}/api/observations", json={"bron": "thuis", "observations": waarnemingen}, timeout=60)
        if r.status_code >= 400:
            log.error("Worker weigerde waarnemingen: %s %s", r.status_code, r.text[:300])
        r.raise_for_status()

    def categorieen(self) -> list[dict]:
        r = self.s.get(f"{self.basis}/api/categories", timeout=30)
        r.raise_for_status()
        return r.json()

    def stuur_acties(self, acties: list[dict]) -> dict:
        r = self.s.post(f"{self.basis}/api/acties", json={"acties": acties}, timeout=60)
        r.raise_for_status()
        return r.json()

    def stuur_kandidaten(self, kandidaten: list[dict]) -> None:
        r = self.s.post(f"{self.basis}/api/kandidaten", json={"kandidaten": kandidaten}, timeout=60)
        r.raise_for_status()
