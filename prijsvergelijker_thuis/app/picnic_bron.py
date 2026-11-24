"""Picnic via de app-API (python-picnic-api2), met jouw eigen account.

Inloggen met 2FA (Picnic vraagt dat bij een nieuw apparaat):
1. Start de add-on met picnic_email + picnic_password. De add-on vraagt een sms-code aan
   en logt: "Vul de Picnic-code in bij picnic_2fa_code en herstart".
2. Vul de code in bij de add-on-opties en herstart. Het token wordt bewaard in /data, dus
   daarna is geen code meer nodig (tot Picnic het token intrekt).
"""
from __future__ import annotations

import json
import logging
import os
import re

from extract import Mislukt, Waarneming, kies_label

log = logging.getLogger("picnic")
TOKEN_BESTAND = os.environ.get("PICNIC_TOKEN_BESTAND", "/data/picnic.json")


def _laad() -> dict:
    try:
        with open(TOKEN_BESTAND) as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def _bewaar(d: dict) -> None:
    with open(TOKEN_BESTAND, "w") as f:
        json.dump(d, f)


def product_id(url: str) -> str | None:
    m = re.search(r"/(s\d{5,})/?$", url)
    return m.group(1) if m else None


class PicnicBron:
    def __init__(self, email: str, wachtwoord: str, code_2fa: str = ""):
        from python_picnic_api2 import Picnic2FARequired, PicnicAPI  # lazy: alleen nodig met Picnic

        st = _laad()
        if st.get("token") and not st.get("wacht_op_2fa"):
            self.api = PicnicAPI(auth_token=st["token"])
            return
        if st.get("wacht_op_2fa") and st.get("token"):
            if not code_2fa:
                raise Mislukt("picnic: wacht op sms-code; vul picnic_2fa_code in en herstart de add-on")
            api = PicnicAPI(auth_token=st["token"])
            api.verify_2fa_code(code_2fa.strip())
            _bewaar({"token": api.session.auth_token})
            log.info("Picnic: 2FA geverifieerd, token bewaard")
            self.api = api
            return
        if not (email and wachtwoord):
            raise Mislukt("picnic: picnic_email/picnic_password niet ingevuld")
        api = PicnicAPI()
        try:
            api.login(email, wachtwoord)
        except Picnic2FARequired:
            api.generate_2fa_code("SMS")
            _bewaar({"token": api.session.auth_token, "wacht_op_2fa": True})
            raise Mislukt("picnic: sms-code aangevraagd; vul picnic_2fa_code in en herstart de add-on")
        _bewaar({"token": api.session.auth_token})
        self.api = api

    def vergeet_token(self) -> None:
        _bewaar({})

    def haal(self, url: str) -> Waarneming:
        from python_picnic_api2 import PicnicAuthError
        from python_picnic_api2.models.article import Article
        from python_picnic_api2.models.pml import text_of, walk

        pid = product_id(url)
        if not pid:
            raise Mislukt("picnic: geen product-id (s1234567) in url")
        try:
            data = self.api._get(f"/pages/product-details-page-root?id={pid}&show_category_action=true", add_picnic_headers=True)
        except PicnicAuthError:
            self.vergeet_token()
            raise Mislukt("picnic: token verlopen; herstart de add-on om opnieuw in te loggen")
        art = Article.from_page(data, pid)
        if art is None or not art.price:
            raise Mislukt("picnic: geen prijs (product niet meer in assortiment?)")
        prijs = art.price / 100
        normaal = art.original_price / 100 if art.original_price and art.original_price > art.price else None
        # Actielabel: teksten op de pagina vóór de beschrijving (daarna volgen aanbevelingen).
        teksten: list[str] = []
        for node in walk(data):
            if str(node.get("id", "")).startswith(("product-page-description", "product-page-highlights")):
                break
            t = text_of(node)
            if t:
                teksten.append(t)
        tekst = " ".join(x for x in (art.name, art.unit_quantity) if x) or None
        return Waarneming(prijs=prijs, normale_prijs=normaal, actie_label=kies_label(teksten), verpakking_tekst=tekst)
