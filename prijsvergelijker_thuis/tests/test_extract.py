from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest

from extract import Mislukt, bedrag, blokkade, kies_label, uit_pagina
from main import te_doen, volgende_start, volgorde
from picnic_bron import product_id

FX = Path(__file__).resolve().parents[2] / "test" / "fixtures"


def lees(n):
    return (FX / n).read_text(encoding="utf-8")


@pytest.mark.parametrize("s,v", [("€ 5,99", 5.99), ("5.99", 5.99), ("1.299,00", 1299.0), ("&euro;&nbsp;17,99 met", 17.99), (3, 3.0), ("0.0", None), (None, None)])
def test_bedrag(s, v):
    assert bedrag(s) == v


def test_amazon_buybox():
    assert uit_pagina("amazon", 200, lees("amazon-huggies-B0111AIZ68.html")).prijs == 17.99


def test_amazon_geen_buybox():
    with pytest.raises(Mislukt):
        uit_pagina("amazon", 200, lees("amazon-taft-geen-buybox.html"))


def test_jsonld_generiek():
    r = uit_pagina("ah", 200, lees("jumbo-dreft-676439ZK.html"), ["Bekijk alles", "1+1 gratis", "2e halve prijs"])
    assert r.prijs == 13.99
    assert r.actie_label == "1+1 gratis"


@pytest.mark.parametrize(
    "kand,label",
    [
        (["Nieuw", "2e halve prijs"], "2e halve prijs"),
        (["3 VOOR 9.99"], "3 VOOR 9.99"),
        (["BONUS", "2 voor €5,00"], "2 voor €5,00"),
        (["25% korting"], "25% korting"),
        (["2e = 70% korting"], "2e = 70% korting"),
        (["Nu €3,99"], "Nu €3,99"),
        (["Gratis bezorging"], None),
        (["Op = op"], None),
    ],
)
def test_kies_label(kand, label):
    assert kies_label(kand) == label


@pytest.mark.parametrize(
    "status,doc,verwacht",
    [
        (403, "<title>Access Denied</title>", "HTTP 403"),
        (200, "<title>Just a moment...</title>", "blokkade"),
        (200, "<title>Product</title>" + "x" * 50000, None),
    ],
)
def test_blokkade(status, doc, verwacht):
    r = blokkade(status, doc)
    assert (r is None) if verwacht is None else (verwacht in r)


def test_niet_leverbaar():
    doc = '<script type="application/ld+json">{"@type":"Product","offers":{"price":"4.99","availability":"https://schema.org/OutOfStock"}}</script>'
    with pytest.raises(Mislukt, match="niet leverbaar"):
        uit_pagina("etos", 200, doc)


def test_volgorde_om_en_om():
    l = [{"winkel": "ah", "id": 1}, {"winkel": "ah", "id": 2}, {"winkel": "bol", "id": 3}]
    assert [x["id"] for x in volgorde(l)] == [1, 3, 2]


def test_te_doen_slaat_vandaag_over():
    l = [{"winkel": "ah", "laatste_datum": "2026-11-23"}, {"winkel": "ah", "laatste_datum": None}, {"winkel": "jumbo", "laatste_datum": None}]
    assert len(te_doen(l, ["ah"], "2026-11-23")) == 1


def test_volgende_start():
    tz = ZoneInfo("Europe/Amsterdam")
    assert volgende_start("06:30", datetime(2026, 11, 23, 5, 0, tzinfo=tz)).hour == 6
    assert volgende_start("06:30", datetime(2026, 11, 23, 7, 0, tzinfo=tz)).day == 24


def test_picnic_id():
    assert product_id("https://picnic.app/nl/producten/s1163321") == "s1163321"
